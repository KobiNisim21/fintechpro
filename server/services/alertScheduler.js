import { timingSafeEqual } from 'node:crypto';
import connectDB from '../config/database.js';
import { pollPersonalAlerts } from './personalAlerts.js';

export default async function alertScheduler(req, res) {
    const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
    const provided = req.headers.authorization || '';
    if (!expected) return res.status(503).json({ message: 'Alert scheduler is not configured' });
    if (typeof provided !== 'string' || Buffer.byteLength(provided) !== Buffer.byteLength(expected)
        || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return res.status(401).json({ message: 'Unauthorized' });
    try { await connectDB(); await pollPersonalAlerts(null); res.json({ checked: true }); }
    catch { res.status(503).json({ message: 'Alert scheduler unavailable' }); }
}
