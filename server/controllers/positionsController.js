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

// @desc    Add new position
// @route   POST /api/positions
// @access  Private
export const addPosition = async (req, res) => {
    try {
        const { symbol, name, quantity, averagePrice, date } = req.body;

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
            symbol: symbol.toUpperCase(),
            name,
            quantity,
            averagePrice,
            lots: [{
                quantity,
                price: averagePrice,
                date: date || Date.now()
            }]
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

        const { quantity, averagePrice, lots } = req.body;

        console.log(`[UPDATE] Updating position ${position.symbol} (${position._id})`);
        console.log(`[UPDATE] Payload lots:`, lots ? `${lots.length} lots provided` : 'No lots provided');

        // If 'lots' are provided, they take precedence and will trigger auto-calc
        if (lots && Array.isArray(lots)) {
            // FIX: Explicitly map to new objects to force Mongoose to replace the array content
            // instead of trying to update/merge existing subdocuments by ID.
            position.lots = lots.map(lot => ({
                quantity: Number(lot.quantity),
                price: Number(lot.price),
                date: lot.date ? new Date(lot.date) : new Date() // Ensure standard Date object
            }));

            // Mark as modified to ensure save hooks run
            position.markModified('lots');
        } else {
            // Fallback for legacy updates (though UI should send lots)
            if (quantity !== undefined) position.quantity = quantity;
            if (averagePrice !== undefined) position.averagePrice = averagePrice;
        }

        const updatedPosition = await position.save();
        console.log(`[UPDATE] Saved successfully. New Qty: ${updatedPosition.quantity}, AvgPrice: ${updatedPosition.averagePrice}, Lots: ${updatedPosition.lots.length}`);

        res.json(updatedPosition);
    } catch (error) {
        console.error('[UPDATE] Error saving position:', error);
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
