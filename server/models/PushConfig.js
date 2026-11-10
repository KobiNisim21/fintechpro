import mongoose from 'mongoose';
const schema = new mongoose.Schema({
    _id: String,
    publicKey: { type: String, required: true },
    privateKey: { type: String, required: true, select: false },
    lastWorkerAt: Date,
}, { timestamps: true });
export default mongoose.model('PushConfig', schema);
