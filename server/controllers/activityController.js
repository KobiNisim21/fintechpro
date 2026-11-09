import mongoose from 'mongoose';
import Position from '../models/Position.js';
import CashBalance from '../models/CashBalance.js';
import { applySale, legacyEvents } from '../services/positionActivity.js';
import { createExcelWorkbook } from '../services/excelExport.js';

export async function readActivity(userId) {
    const positions = await Position.find({ user: userId }).lean();
    const events = positions.flatMap(position => (position.activity?.length ? position.activity : legacyEvents(position)).map((event, i) => ({
        ...event, _id: String(event._id || `${position._id}-legacy-${i}`), positionId: String(position._id),
        symbol: position.symbol, name: position.name, currency: 'USD', broker: event.broker || position.broker,
    })));
    events.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt) || new Date(b.recordedAt) - new Date(a.recordedAt));
    return { positions, events };
}

export async function getActivity(req, res) {
    try {
        const { events, positions } = await readActivity(req.user._id);
        const offset = Math.max(0, Number(req.query.offset) || 0), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const filtered = events.filter(event => (!req.query.type || event.type === req.query.type) && (!req.query.symbol || event.symbol === String(req.query.symbol).toUpperCase()));
        res.set('Cache-Control', 'no-store');
        const accounts = positions.map(p => ({ _id: p._id, symbol: p.symbol, broker: p.broker, quantity: p.quantity, isDeleted: Boolean(p.isDeleted) }));
        res.json({ accounts, events: filtered.slice(offset, offset + limit), total: filtered.length, historyNotice: 'Opening entries reconstruct remaining lots only. Earlier sales, fees and dividends cannot be recovered automatically. Corrections/removals are not priced trades. Amounts use the USD-normalized cost convention. Recorded income/fees do not update cash balances.' });
    } catch { res.status(503).json({ message: 'Activity temporarily unavailable' }); }
}

export async function recordActivity(req, res) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid position' });
        const position = await Position.findOne({ _id: req.params.id, user: req.user._id });
        if (!position) return res.status(404).json({ message: 'Position not found' });
        const requestId = req.body.requestId;
        if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId))) return res.status(400).json({ message: 'Invalid request identifier' });
        const existing = requestId && position.activity.find(event => event.requestId === requestId);
        if (existing) return res.json({ event: existing, duplicate: true });
        const { type, amount, date, note } = req.body;
        if (type === 'SELL') {
            if (position.isDeleted || position.quantity <= 0) return res.status(400).json({ message: 'Only active holdings can be sold' });
            applySale(position, req.body);
        } else if (['DIVIDEND', 'FEE'].includes(type)) {
            const occurredAt = date ? new Date(date) : new Date();
            if (amount == null || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ message: 'Amount must be positive' });
            if (!Number.isFinite(occurredAt.getTime()) || occurredAt > new Date()) return res.status(400).json({ message: 'Date must be valid and cannot be in the future' });
            position.$locals.activityEvent = { type, amount: Number(amount), occurredAt, note: String(note || '').slice(0, 500) };
        } else return res.status(400).json({ message: 'Unsupported activity type' });
        if (requestId) position.$locals.activityEvent.requestId = requestId;
        await position.save();
        res.status(201).json({ event: position.activity.at(-1) });
    } catch (error) {
        if (error.name === 'VersionError' && req.body.requestId) {
            const saved = await Position.findOne({ _id: req.params.id, user: req.user._id, 'activity.requestId': req.body.requestId }).catch(() => null);
            const existing = saved?.activity.find(event => event.requestId === req.body.requestId);
            if (existing) return res.json({ event: existing, duplicate: true });
        }
        res.status(error.name === 'VersionError' ? 409 : 400).json({ message: error.name === 'VersionError' ? 'Holding changed; refresh before retrying' : error.message });
    }
}

export async function exportPortfolio(req, res) {
    try {
        const [{ positions, events }, cash] = await Promise.all([readActivity(req.user._id), CashBalance.find({ user: req.user._id }).lean()]);
        if (events.length > 100000) return res.status(400).json({ message: 'Export exceeds 100,000 events; contact support for a complete archive' });
        const iso = value => value ? new Date(value).toISOString() : '';
        const workbook = createExcelWorkbook([
            { name: 'Read me', rows: [['Portfolio backup', new Date().toISOString()], ['Cost currency', 'USD-normalized; cash keeps its stated currency'], ['History', 'Opening entries reconstruct remaining lots. Earlier trades may be missing.'], ['Realized P&L', 'FIFO gross cost basis, less recorded sale fee; excludes other fees/taxes and historical corrections.'], ['Income and fees', 'Manual records; not automatically posted to cash.'], ['Scope', 'Holdings, purchase lots, activity and cash only; market quotes and app settings are not included. This export has no automatic restore function.']] },
            { name: 'Holdings', rows: [['ID', 'Symbol', 'Name', 'Broker', 'Quantity', 'Average cost USD', 'Removed', 'Updated UTC'], ...positions.map(p => [String(p._id), p.symbol, p.name, p.broker, p.quantity, p.averagePrice, Boolean(p.isDeleted) ? 'Yes' : 'No', iso(p.updatedAt)])] },
            { name: 'Lots', rows: [['Position ID', 'Symbol', 'Broker', 'Date UTC', 'Quantity', 'Unit cost USD'], ...positions.flatMap(p => (p.lots || []).map(lot => [String(p._id), p.symbol, p.broker, iso(lot.date), lot.quantity, lot.price]))] },
            { name: 'Activity', rows: [['ID', 'Position ID', 'Symbol', 'Broker', 'Type', 'Date UTC', 'Quantity', 'Price USD', 'Amount USD', 'Sale fee USD', 'FIFO basis USD', 'Realized USD', 'Note', 'Recorded UTC', 'Before snapshot', 'After snapshot'], ...events.map(e => [e._id, e.positionId, e.symbol, e.broker, e.type, iso(e.occurredAt), e.quantity, e.price, e.amount, e.fee, e.costBasis, e.realizedGain, e.note, iso(e.recordedAt), e.before ? JSON.stringify(e.before) : '', e.after ? JSON.stringify(e.after) : ''])] },
            { name: 'Cash', rows: [['Broker', 'Currency', 'Type', 'Name', 'Amount'], ...cash.map(c => [c.broker, c.currency, c.type, c.name, c.amount])] },
        ]);
        res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="FinTechPro-backup.xlsx"', 'Cache-Control': 'no-store' });
        res.send(workbook);
    } catch { res.status(503).json({ message: 'Export temporarily unavailable' }); }
}
