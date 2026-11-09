import mongoose from 'mongoose';
const schema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    kind: { type: String, required: true, enum: ['price_above', 'price_below', 'daily_move', 'concentration'] },
    threshold: { type: Number, required: true, min: 0, validate: Number.isFinite },
    enabled: { type: Boolean, default: true },
    lastTriggeredAt: { type: Date, default: null },
    lastValue: Number,
    message: String,
}, { timestamps: true });
export default mongoose.model('AlertRule', schema);
