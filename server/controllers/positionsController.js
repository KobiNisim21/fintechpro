import Position from '../models/Position.js';
import * as stockData from '../services/stockDataService.js';

// @desc    Get all positions for logged-in user
// @route   GET /api/positions
// @access  Private
export const getPositions = async (req, res) => {
    try {
        const positions = await Position.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(positions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add new position
// @route   POST /api/positions
// @access  Private

export const addPosition = async (req, res) => {
    try {
        const { symbol, name, quantity, averagePrice } = req.body;

        // 1. Validate symbol existence
        try {
            await stockData.getQuote(symbol);
        } catch (error) {
            console.warn(`❌ Validation failed for symbol ${symbol}: ${error.message}`);
            return res.status(400).json({
                message: `Invalid ticker symbol: ${symbol.toUpperCase()}. Please check and try again.`
            });
        }

        const position = await Position.create({
            user: req.user._id,
            symbol: symbol.toUpperCase(), // Ensure uppercase
            name,
            quantity,
            averagePrice
        });

        res.status(201).json(position);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update position
// @route   PUT /api/positions/:id
// @access  Private
export const updatePosition = async (req, res) => {
    try {
        const position = await Position.findById(req.params.id);

        if (!position) {
            return res.status(404).json({ message: 'Position not found' });
        }

        // Make sure user owns the position
        if (position.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const { quantity, averagePrice } = req.body;

        if (quantity !== undefined) position.quantity = quantity;
        if (averagePrice !== undefined) position.averagePrice = averagePrice;

        const updatedPosition = await position.save();
        res.json(updatedPosition);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete position
// @route   DELETE /api/positions/:id
// @access  Private
export const deletePosition = async (req, res) => {
    try {
        const position = await Position.findById(req.params.id);

        if (!position) {
            return res.status(404).json({ message: 'Position not found' });
        }

        // Make sure user owns the position
        if (position.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        await position.deleteOne();
        res.json({ message: 'Position deleted', id: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
