import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth.js';
import AlertRule from '../models/AlertRule.js';
import Position from '../models/Position.js';
import { checkPersonalAlertStatus } from '../services/personalAlerts.js';

export function createAlertRoutes(quoteProvider, { pushSender } = {}) {
    const router = express.Router();
    router.use(protect);
    router.get('/', async (req, res) => {
        try { res.set('Cache-Control', 'no-store'); res.json(await AlertRule.find({ user: req.user._id }).sort({ createdAt: -1 }).lean()); }
        catch { res.status(503).json({ message: 'Alert rules unavailable' }); }
    });
    router.post('/', async (req, res) => {
        try {
            const { kind } = req.body, symbol = String(req.body.symbol || '').trim().toUpperCase(), threshold = Number(req.body.threshold);
            if (!['price_above', 'price_below', 'daily_move', 'concentration'].includes(kind) || req.body.threshold == null || req.body.threshold === '' || !Number.isFinite(threshold) || threshold <= 0 || (kind === 'concentration' && threshold > 100)) return res.status(400).json({ message: 'Invalid rule or threshold' });
            if (!await Position.exists({ user: req.user._id, symbol, isDeleted: { $ne: true }, quantity: { $gt: 0 } })) return res.status(400).json({ message: 'Choose an active holding' });
            if (await AlertRule.countDocuments({ user: req.user._id }) >= 50) return res.status(400).json({ message: 'Maximum 50 rules; remove an old rule first' });
            res.status(201).json(await AlertRule.create({ user: req.user._id, symbol, kind, threshold }));
        } catch { res.status(503).json({ message: 'Could not create alert rule' }); }
    });
    router.post('/check', async (req, res) => {
        try { res.set('Cache-Control', 'no-store'); res.json(await checkPersonalAlertStatus(req.user._id, quoteProvider, pushSender)); }
        catch { res.status(503).json({ message: 'Alert check unavailable; try again' }); }
    });
    router.put('/:id', async (req, res) => {
        try {
            if (!mongoose.isValidObjectId(req.params.id) || typeof req.body.enabled !== 'boolean') return res.status(400).json({ message: 'Invalid rule update' });
            const rule = await AlertRule.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: { enabled: req.body.enabled, ...(req.body.rearm === true ? { lastTriggeredAt: null } : {}) } }, { new: true });
            if (!rule) return res.status(404).json({ message: 'Rule not found' });
            res.json(rule);
        } catch { res.status(503).json({ message: 'Could not update rule' }); }
    });
    router.delete('/:id', async (req, res) => {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid rule' });
            const rule = await AlertRule.findOneAndDelete({ _id: req.params.id, user: req.user._id });
            res.status(rule ? 200 : 404).json({ message: rule ? 'Rule deleted' : 'Rule not found' });
        } catch { res.status(503).json({ message: 'Could not delete rule' }); }
    });
    return router;
}
export default createAlertRoutes();
