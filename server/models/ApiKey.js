import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: [true, 'Key name is required'],
        trim: true,
        default: 'Claude'
    },
    keyHash: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    keyPrefix: {
        type: String,
        required: true
    },
    scopes: {
        type: [String],
        enum: ['read', 'write'],
        default: ['read']
    },
    expiresAt: {
        type: Date,
        default: null
    },
    lastUsedAt: {
        type: Date,
        default: null
    },
    revoked: {
        type: Boolean,
        default: false,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

export default ApiKey;
