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
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        date: { type: Date, default: Date.now }
    }],
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0, 'Quantity must be positive']
    },
    averagePrice: {
        type: Number,
        required: [true, 'Average price is required'],
        min: [0, 'Price must be positive']
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

// Update timestamp & aggregates on save
positionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();

    // Auto-calculate aggregates if lots exist
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

const Position = mongoose.model('Position', positionSchema);

export default Position;
