import express from 'express';
import PushSubscription from '../models/PushSubscription.js';
import { protect } from '../middleware/auth.js';
import { endpointHash, validPushSubscription, getPushConfig, pushPayload, sendPush } from '../services/webPush.js';

export function createPushRoutes({ sender } = {}) {
    const router = express.Router();
    router.use(protect);
    router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    router.get('/config', async (req, res) => {
        try {
            const config = await getPushConfig();
            const age = Date.now() - new Date(config.lastWorkerAt || 0).getTime();
            res.json({ publicKey: config.publicKey, backgroundChecks: age >= 0 && age < 180000 });
        }
        catch { res.status(503).json({ message: 'Push service unavailable. Please retry.' }); }
    });
    router.post('/status', async (req, res) => {
        if (typeof req.body.endpoint !== 'string' || req.body.endpoint.length > 2048) return res.status(400).json({ message: 'Invalid push subscription' });
        try { res.json({ subscribed: !!await PushSubscription.exists({ user: req.user._id, endpointHash: endpointHash(req.body.endpoint) }) }); }
        catch { res.status(503).json({ message: 'Push service unavailable. Please retry.' }); }
    });
    router.post('/subscriptions', async (req, res) => {
        const { subscription, language } = req.body;
        if (!validPushSubscription(subscription)) return res.status(400).json({ message: 'Invalid push subscription' });
        try {
            await PushSubscription.init();
            const hash = endpointHash(subscription.endpoint);
            const existing = await PushSubscription.findOne({ endpointHash: hash });
            if ((!existing || String(existing.user) !== String(req.user._id)) && await PushSubscription.countDocuments({ user: req.user._id }) >= 10) return res.status(400).json({ message: 'Maximum 10 push devices. Disable an old device first.' });
            // The same browser endpoint moves to the newly opted-in account.
            await PushSubscription.findOneAndUpdate({ endpointHash: hash }, { $set: {
                user: req.user._id, subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
                language: language === 'he' ? 'he' : 'en',
            } }, { upsert: true });
            res.status(201).json({ subscribed: true });
        } catch { res.status(503).json({ message: 'Could not enable push notifications. Please retry.' }); }
    });
    router.delete('/subscriptions', async (req, res) => {
        if (typeof req.body.endpoint !== 'string' || req.body.endpoint.length > 2048) return res.status(400).json({ message: 'Invalid push subscription' });
        try { await PushSubscription.deleteOne({ user: req.user._id, endpointHash: endpointHash(req.body.endpoint) }); res.json({ subscribed: false }); }
        catch { res.status(503).json({ message: 'Could not disable push notifications. Please retry.' }); }
    });
    router.post('/test', async (req, res) => {
        if (typeof req.body.endpoint !== 'string' || req.body.endpoint.length > 2048) return res.status(400).json({ message: 'Invalid push subscription' });
        try {
            const device = await PushSubscription.findOneAndUpdate({ user: req.user._id, endpointHash: endpointHash(req.body.endpoint),
                $or: [{ lastTestAt: null }, { lastTestAt: { $lt: new Date(Date.now() - 30000) } }],
            }, { $set: { lastTestAt: new Date() } }, { new: true }).select('+subscription').lean();
            if (!device) return res.status(429).json({ message: 'Enable push first, or wait 30 seconds before another test.' });
            try { await sendPush(device.subscription, pushPayload(device.language, { test: true }), sender); }
            catch (error) {
                if (error.statusCode === 404 || error.statusCode === 410) await PushSubscription.deleteOne({ _id: device._id, user: req.user._id });
                return res.status(503).json({ message: 'Could not send the test notification. Try enabling push again.' });
            }
            res.json({ accepted: true });
        } catch { res.status(503).json({ message: 'Push service unavailable. Please retry.' }); }
    });
    return router;
}
export default createPushRoutes();
