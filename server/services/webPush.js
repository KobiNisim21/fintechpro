import * as webpush from 'web-push';
import { createHash } from 'node:crypto';
import PushConfig from '../models/PushConfig.js';
import PushSubscription from '../models/PushSubscription.js';
import PushDelivery from '../models/PushDelivery.js';
import AlertRule from '../models/AlertRule.js';

export const endpointHash = endpoint => createHash('sha256').update(endpoint).digest('hex');
export function validPushSubscription(value) {
    try {
        const url = new URL(value?.endpoint);
        const host = url.hostname;
        const allowed = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com'
            || host.endsWith('.push.services.mozilla.com') || host === 'web.push.apple.com'
            || host.endsWith('.notify.windows.com');
        if (!allowed || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || value.endpoint.length > 2048) return false;
        const { p256dh, auth } = value.keys || {};
        if (typeof p256dh !== 'string' || p256dh.length > 100 || typeof auth !== 'string' || auth.length > 32
            || !/^[\w-]+={0,2}$/.test(p256dh) || !/^[\w-]+={0,2}$/.test(auth)) return false;
        const key = Buffer.from(p256dh, 'base64url');
        return key.length === 65 && key[0] === 4 && Buffer.from(auth, 'base64url').length === 16;
    } catch { return false; }
}

export async function getPushConfig() {
    // One durable identity shared by serverless instances and the background worker.
    // Never expose or log the private key; no ephemeral key generation per request.
    let config = await PushConfig.findById('vapid-v1').select('+privateKey').lean();
    if (!config) {
        const keys = webpush.generateVAPIDKeys();
        try { await PushConfig.updateOne({ _id: 'vapid-v1' }, { $setOnInsert: keys }, { upsert: true }); }
        catch (error) { if (error.code !== 11000) throw error; }
        config = await PushConfig.findById('vapid-v1').select('+privateKey').lean();
    }
    return config;
}

export function pushPayload(language, { symbol, eventKey, test = false }) {
    const he = language === 'he';
    return {
        title: 'FinTechPro',
        body: test ? (he ? 'התראות הפוש מוכנות. זו התראת בדיקה.' : 'Push notifications are ready. This is a test notification.')
            : (he ? `ההתראה האישית עבור ${symbol} הופעלה. פתחו את התיק לפרטים.` : `Your personal alert for ${symbol} was triggered. Open your portfolio for details.`),
        tag: test ? 'fintechpro-push-test' : `personal-${eventKey}`,
        url: '/?panel=alerts', language: he ? 'he' : 'en',
    };
}

export async function sendPush(subscription, payload, sender = webpush.sendNotification) {
    if (!validPushSubscription(subscription)) throw new Error('Invalid push subscription');
    const config = await getPushConfig();
    return sender(subscription, JSON.stringify(payload), {
        vapidDetails: { subject: 'https://fintechpro.vercel.app', publicKey: config.publicKey, privateKey: config.privateKey },
        TTL: 3600, urgency: 'normal', timeout: 5000,
    });
}

export async function projectPendingPush(userId) {
    await PushDelivery.init();
    const rules = await AlertRule.find({ ...(userId ? { user: userId } : {}), pushEvent: { $ne: null } }).limit(50).lean();
    for (const rule of rules) {
        if (!rule.pushEvent) continue;
        const devices = await PushSubscription.find({ user: rule.user }).select('_id').lean();
        for (const device of devices) {
            try {
                await PushDelivery.updateOne({ eventKey: rule.pushEvent, subscription: device._id }, {
                    $setOnInsert: { user: rule.user, symbol: rule.symbol, expiresAt: new Date(Date.now() + 86400000) },
                }, { upsert: true });
            } catch (error) { if (error.code !== 11000) throw error; }
        }
        await AlertRule.updateOne({ _id: rule._id, pushEvent: rule.pushEvent }, { $unset: { pushEvent: 1 } });
    }
}

export async function flushPushQueue({ userId, sender, limit = 12 } = {}) {
    let sent = 0;
    // Durable leases coordinate overlapping HTTP checks and worker instances.
    for (let i = 0; i < limit; i++) {
        const now = new Date();
        const job = await PushDelivery.findOneAndUpdate({
            ...(userId ? { user: userId } : {}), expiresAt: { $gt: now }, attempts: { $lt: 5 },
            $or: [{ state: 'pending', nextAttemptAt: { $lte: now } }, { state: 'sending', leaseUntil: { $lte: now } }],
        }, { $set: { state: 'sending', leaseUntil: new Date(Date.now() + 60000) }, $inc: { attempts: 1 } }, { new: true }).lean();
        if (!job) break;
        const device = await PushSubscription.findOne({ _id: job.subscription, user: job.user }).select('+subscription').lean();
        if (!device) { await PushDelivery.updateOne({ _id: job._id }, { $set: { state: 'failed' } }); continue; }
        try {
            await sendPush(device.subscription, pushPayload(device.language, job), sender);
            await PushDelivery.updateOne({ _id: job._id }, { $set: { state: 'sent' } }); sent++;
        } catch (error) {
            const gone = error.statusCode === 404 || error.statusCode === 410;
            if (gone) await PushSubscription.deleteOne({ _id: device._id, user: job.user });
            await PushDelivery.updateOne({ _id: job._id }, { $set: {
                state: gone || job.attempts >= 5 ? 'failed' : 'pending',
                nextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** (job.attempts - 1))),
            } });
        }
    }
    return { sent };
}
