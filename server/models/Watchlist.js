import mongoose from 'mongoose';

const watchlistSchema = new mongoose.Schema({
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
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Prevent duplicate symbols per user
watchlistSchema.index({ user: 1, symbol: 1 }, { unique: true });

const Watchlist = mongoose.model('Watchlist', watchlistSchema);

export default Watchlist;
