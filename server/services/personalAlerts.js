import Position from '../models/Position.js';
import AlertRule from '../models/AlertRule.js';
import PushConfig from '../models/PushConfig.js';
import { getQuote } from './stockDataService.js';
import { projectPendingPush, flushPushQueue } from './webPush.js';

export function observeRule(rule, quotes, positions) {
    const quote = quotes.get(rule.symbol);
    if (!quote || quote.stale || !Number.isFinite(quote.c) || quote.c <= 0) return null;
    let value;
    if (rule.kind.startsWith('price_')) value = quote.c;
    else if (rule.kind === 'daily_move') { if (!Number.isFinite(quote.dp)) return null; value = Math.abs(quote.dp); }
    else {
        if (positions.some(p => { const q = quotes.get(p.symbol); return !q || q.stale || !Number.isFinite(q.c) || q.c <= 0; })) return null;
        const total = positions.reduce((sum, p) => sum + p.quantity * quotes.get(p.symbol).c, 0);
        const target = positions.filter(p => p.symbol === rule.symbol).reduce((sum, p) => sum + p.quantity * quotes.get(p.symbol).c, 0);
        if (!total) return null;
        value = target / total * 100;
    }
    return value;
}

export function evaluateRule(rule, quotes, positions) {
    const value = observeRule(rule, quotes, positions);
    if (value === null) return null;
    return (rule.kind === 'price_below' ? value <= rule.threshold : value >= rule.threshold) ? value : null;
}

export async function checkPersonalAlertStatus(userId, quoteProvider = getQuote, pushSender) {
    const [rules, positions] = await Promise.all([
        AlertRule.find({ user: userId, enabled: true }).lean(),
        Position.find({ user: userId, isDeleted: { $ne: true }, quantity: { $gt: 0 } }).select('symbol quantity').lean(),
    ]);
    const symbols = [...new Set(positions.map(p => p.symbol))];
    const quotes = new Map();
    // Bound provider concurrency and share each symbol across all rules.
    if (rules.length) for (let i = 0; i < symbols.length; i += 4) await Promise.all(symbols.slice(i, i + 4).map(async symbol => {
        try { quotes.set(symbol, await quoteProvider(symbol)); } catch { /* unavailable is not a trigger */ }
    }));
    const triggered = [], evaluations = [];
    for (const rule of rules) {
        if (!symbols.includes(rule.symbol)) { evaluations.push({ ruleId: String(rule._id), status: 'no_holding' }); continue; }
        const observed = observeRule(rule, quotes, positions);
        const value = evaluateRule(rule, quotes, positions);
        if (value === null) { evaluations.push({ ruleId: String(rule._id), status: observed === null ? 'unavailable' : 'not_met', value: observed }); continue; }
        const oneTime = rule.kind.startsWith('price_');
        const now = new Date(), cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const message = `${rule.symbol}: ${rule.kind.replaceAll('_', ' ')} ${rule.threshold}; observed ${value.toFixed(2)}${oneTime ? ' USD' : '%'}`;
        const updated = await AlertRule.findOneAndUpdate({ _id: rule._id, user: userId, enabled: true, $or: [{ lastTriggeredAt: null }, { lastTriggeredAt: { $lt: cutoff } }] }, { $set: { lastTriggeredAt: now, lastValue: value, message, pushEvent: `${rule._id}:${now.getTime()}`, ...(oneTime ? { enabled: false } : {}) } }, { new: true });
        if (updated) triggered.push(updated);
        evaluations.push({ ruleId: String(rule._id), status: updated ? 'triggered' : 'cooldown', value });
    }
    try { await projectPendingPush(userId); await flushPushQueue({ userId, limit: 4, sender: pushSender }); }
    catch { console.warn('Push delivery deferred; pending events will retry.'); }
    return { triggered, evaluations, checkedAt: new Date().toISOString() };
}

export async function checkPersonalAlerts(userId, quoteProvider = getQuote) {
    return (await checkPersonalAlertStatus(userId, quoteProvider)).triggered;
}

let checking = false;
export async function pollPersonalAlerts(io) {
    if (checking) return;
    checking = true;
    try {
        const users = await AlertRule.distinct('user', { enabled: true });
        for (const user of users) {
            try {
                const triggered = await checkPersonalAlerts(user);
                if (triggered.length && io) {
                    for (const socket of await io.fetchSockets()) if (socket.userId === String(user)) socket.emit('personal-alert', { count: triggered.length });
                }
            } catch { console.warn('One personal-alert portfolio check deferred; continuing with other users.'); }
        }
        // Includes paused one-time rules and retries when no rules remain active.
        await projectPendingPush();
        await flushPushQueue();
        await PushConfig.updateOne({ _id: 'vapid-v1' }, { $set: { lastWorkerAt: new Date() } });
    } finally { checking = false; }
}
