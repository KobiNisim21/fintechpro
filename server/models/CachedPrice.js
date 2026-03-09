import mongoose from 'mongoose';

/**
 * Cached prices for Israeli securities (funds, stocks)
 * Updated daily via manual refresh or background job
 * Served instantly to the dashboard from this cache
 */
const cachedPriceSchema = new mongoose.Schema({
    fundId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    symbol: {
        type: String,  // e.g. FUND:5131425
        required: true
    },
    name: {
        type: String,
        default: ''
    },
    priceILS: {
        type: Number,
        required: true
    },
    priceUSD: {
        type: Number,
        required: true
    },
    changePercent: {
        type: Number,
        default: 0
    },
    exchangeRate: {
        type: Number,  // ILS/USD rate used for conversion
        default: 3.65
    },
    source: {
        type: String,  // 'manual', 'tase_proxy', 'funder'
        default: 'manual'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const CachedPrice = mongoose.model('CachedPrice', cachedPriceSchema);

export default CachedPrice;
