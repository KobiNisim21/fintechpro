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
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0.00001, 'Quantity must be positive']
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

// Update timestamp on save
positionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const Position = mongoose.model('Position', positionSchema);

export default Position;
