import mongoose from 'mongoose';

const positionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    symbol: {
        type: String,
        required: [true, 'Stock symbol is required'],
        uppercase: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Stock name is required'],
        trim: true
    },
    lots: [{
        quantity: {
            type: Number, required: true,
            validate: { validator: value => Number.isFinite(value) && value > 0, message: 'Lot quantity must be a finite number greater than zero' }
        },
        price: {
            type: Number, required: true, min: 0,
            validate: { validator: Number.isFinite, message: 'Lot price must be finite' }
        },
        date: { type: Date, default: Date.now }
    }],
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        validate: { validator: Number.isFinite, message: 'Quantity must be finite' },
        min: [0, 'Quantity must be positive']
    },
    averagePrice: {
        type: Number,
        required: [true, 'Average price is required'],
        validate: { validator: Number.isFinite, message: 'Average price must be finite' },
        min: [0, 'Price must be positive']
    },
    broker: {
        type: String,
        default: 'Default',
        trim: true,
        set: v => (v && typeof v === 'string' && v.trim()) ? v.trim() : 'Default'
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for broker-based position splitting
positionSchema.index({ user: 1, symbol: 1, broker: 1 });

// Derive totals before validation so required/min validators check the new totals.
positionSchema.pre('validate', function (next) {
    if (this.lots && this.lots.length > 0) {
        let totalQty = 0;
        let totalCost = 0;

        for (const lot of this.lots) {
            totalQty += lot.quantity;
            totalCost += (lot.quantity * lot.price);
        }

        this.quantity = totalQty;
        this.averagePrice = totalQty > 0 ? totalCost / totalQty : 0;
    }

    next();
});

positionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const Position = mongoose.model('Position', positionSchema);

export default Position;
