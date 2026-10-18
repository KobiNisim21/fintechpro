import Position from '../models/Position.js';
import * as stockData from '../services/stockDataService.js';

// @desc    Get all positions for logged-in user
// @route   GET /api/positions
// @access  Private
export const getPositions = async (req, res) => {
    try {
        const positions = await Position.find({ user: req.user._id, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
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
        let { symbol, name, quantity, averagePrice, date, broker } = req.body;

        if (!symbol || typeof symbol !== 'string') {
            return res.status(400).json({ message: 'Symbol is required' });
        }

        let cleanSymbol = symbol.trim().toUpperCase();
        if (cleanSymbol === 'TA125' || cleanSymbol === 'TA-125' || cleanSymbol === '^TA125') {
            cleanSymbol = '^TA125.TA';
            if (!name) name = 'מדד ת"א 125';
        } else if (/^\d{6,8}$/.test(cleanSymbol)) {
            cleanSymbol = `FUND:${cleanSymbol}`;
        }

        // 1. Validate symbol existence
        try {
            const quote = await stockData.getQuote(cleanSymbol);
            if (!name && quote && quote.name) {
                name = quote.name;
            }
        } catch (error) {
            console.warn(`❌ Validation failed for symbol ${cleanSymbol}: ${error.message}`);
            return res.status(400).json({
                message: `Invalid ticker symbol: ${symbol.toUpperCase()}. Please check and try again.`
            });
        }

        const assignedBroker = (broker && typeof broker === 'string' && broker.trim()) ? broker.trim() : 'Default';

        // Check if an existing position for this user, symbol, and broker already exists
        let existingPosition = await Position.findOne({
            user: req.user._id,
            symbol: cleanSymbol,
            broker: assignedBroker,
            isDeleted: { $ne: true }
        });

        if (existingPosition) {
            existingPosition.lots.push({
                quantity: Number(quantity),
                price: Number(averagePrice),
                date: date ? new Date(date) : new Date()
            });
            existingPosition.markModified('lots');
            const saved = await existingPosition.save();
            return res.status(200).json(saved);
        }

        const position = await Position.create({
            user: req.user._id,
            symbol: cleanSymbol,
            name: name || cleanSymbol,
            broker: assignedBroker,
            quantity: Number(quantity),
            averagePrice: Number(averagePrice),
            lots: [{
                quantity: Number(quantity),
                price: Number(averagePrice),
                date: date ? new Date(date) : new Date()
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

        const { quantity, averagePrice, lots, broker } = req.body;

        console.log(`[UPDATE] Updating position ${position.symbol} (${position._id})`);
        console.log(`[UPDATE] Payload lots:`, lots ? `${lots.length} lots provided` : 'No lots provided');

        if (broker !== undefined) {
            position.broker = (typeof broker === 'string' && broker.trim()) ? broker.trim() : 'Default';
        }

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
