import mongoose from 'mongoose';
const schema = new mongoose.Schema({
    eventKey: { type: String, required: true },
    subscription: { type: mongoose.Schema.Types.ObjectId, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, required: true },
    symbol: String,
    state: { type: String, enum: ['pending', 'sending', 'sent', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseUntil: Date,
    expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ eventKey: 1, subscription: 1 }, { unique: true });
schema.index({ state: 1, nextAttemptAt: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('PushDelivery', schema);
