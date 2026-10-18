import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    apiKeyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ApiKey',
        default: null
    },
    keyName: {
        type: String,
        default: 'AI Agent'
    },
    action: {
        type: String,
        required: true,
        enum: ['add_position', 'sell_position', 'remove_position', 'update_position', 'import_positions', 'update_cash_balance']
    },
    symbol: {
        type: String,
        uppercase: true,
        trim: true
    },
    details: {
        type: String,
        required: true
    },
    beforeState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    afterState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    canUndo: {
        type: Boolean,
        default: true
    },
    undone: {
        type: Boolean,
        default: false,
        index: true
    },
    undoneAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
