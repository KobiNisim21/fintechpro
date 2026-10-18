import mongoose from 'mongoose';

const cashBalanceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    broker: {
        type: String,
        default: 'Default',
        trim: true
    },
    currency: {
        type: String,
        required: true,
        uppercase: true,
        enum: ['USD', 'ILS', 'EUR'],
        default: 'USD'
    },
    amount: {
        type: Number,
        required: true,
        default: 0
    },
    type: {
        type: String,
        enum: ['cash', 'money_market'],
        default: 'cash'
    },
    name: {
        type: String,
        default: '',
        trim: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

cashBalanceSchema.index({ user: 1, broker: 1, currency: 1, type: 1 }, { unique: true });

const CashBalance = mongoose.model('CashBalance', cashBalanceSchema);

export default CashBalance;
