import mongoose from 'mongoose';
const schema = new mongoose.Schema({
    endpointHash: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    subscription: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
    language: { type: String, enum: ['en', 'he'], default: 'en' },
    lastTestAt: Date,
}, { timestamps: true });
export default mongoose.model('PushSubscription', schema);
