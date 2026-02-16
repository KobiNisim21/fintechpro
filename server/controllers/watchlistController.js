import Watchlist from '../models/Watchlist.js';
import * as stockData from '../services/stockDataService.js';

// @desc    Get all watchlist items for logged-in user
// @route   GET /api/watchlist
// @access  Private
export const getWatchlist = async (req, res) => {
    try {
        const items = await Watchlist.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add stock to watchlist
// @route   POST /api/watchlist
// @access  Private
export const addToWatchlist = async (req, res) => {
    try {
        const { symbol, name } = req.body;

        // Validate symbol existence
        try {
            await stockData.getQuote(symbol);
        } catch (error) {
            console.warn(`❌ Validation failed for symbol ${symbol}: ${error.message}`);
            return res.status(400).json({
                message: `Invalid ticker symbol: ${symbol.toUpperCase()}. Please check and try again.`
            });
        }

        // Check if already in watchlist
        const existing = await Watchlist.findOne({ user: req.user._id, symbol: symbol.toUpperCase() });
        if (existing) {
            return res.status(400).json({ message: `${symbol.toUpperCase()} is already in your watchlist.` });
        }

        const item = await Watchlist.create({
            user: req.user._id,
            symbol: symbol.toUpperCase(),
            name
        });

        res.status(201).json(item);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Remove stock from watchlist
// @route   DELETE /api/watchlist/:id
// @access  Private
export const removeFromWatchlist = async (req, res) => {
    try {
        const item = await Watchlist.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ message: 'Watchlist item not found' });
        }

        // Make sure user owns the item
        if (item.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        await item.deleteOne();
        res.json({ message: 'Removed from watchlist', id: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
