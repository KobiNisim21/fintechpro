/**
 * Stock Controller
 * All data fetching is delegated to stockDataService for shared cache & dedup.
 */

import * as stockData from '../services/stockDataService.js';

// ============================================
// LEGACY: Keep local cache only for candles (Yahoo chart API)
// since stockDataService doesn't handle chart data
// ============================================
const candleCache = new Map();

// @desc    Search for stocks
// @route   GET /api/stocks/search?q=query
// @access  Private
export const searchStocks = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ message: 'Missing search query' });
        }
        const data = await stockData.searchStocks(q);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get stock quote (price, change, etc.)
// @route   GET /api/stocks/:symbol/quote
// @access  Private
export const getQuote = async (req, res) => {
    try {
        const { symbol } = req.params;
        const data = await stockData.getQuote(symbol);
        res.json(data);
    } catch (error) {
        console.error(`❌ Error in getQuote for ${symbol}:`, error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get stock-specific news
// @route   GET /api/stocks/:symbol/news
// @access  Private
export const getNews = async (req, res) => {
    try {
        const { symbol } = req.params;
        const data = await stockData.getCompanyNews(symbol);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get general market news
// @route   GET /api/stocks/market/news
// @access  Private
export const getMarketNews = async (req, res) => {
    try {
        const data = await stockData.getMarketNews();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get forex exchange rate (USD to ILS)
// @route   GET /api/stocks/forex/usd-ils
// @access  Private
export const getForexRate = async (req, res) => {
    try {
        const data = await stockData.getForexRate();
        res.json(data);
    } catch (error) {
        console.error('❌ Error fetching forex rate:', error.message);
        res.json({ rate: 3.6, source: 'fallback', error: error.message, lastUpdate: new Date().toISOString() });
    }
};

// @desc    Get stock candles (historical data) from Yahoo Finance
// @route   GET /api/stocks/:symbol/history
// @access  Private
export const getStockCandles = async (req, res) => {
    try {
        const { symbol } = req.params;
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({ message: 'Missing from/to parameters' });
        }

        const cacheKey = `candles_yahoo_${symbol}_${from}_${to}`;

        // Check cache (1 hour)
        const cached = candleCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
            return res.json(cached.data);
        }

        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${to}&interval=1d&includePrePost=false`;

        const response = await fetch(yahooUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            console.error(`❌ Yahoo Finance error for ${symbol}: HTTP ${response.status}`);
            return res.json({ c: [], t: [], s: 'no_data', error: `HTTP ${response.status}` });
        }

        const data = await response.json();
        const chart = data?.chart?.result?.[0];
        if (!chart || !chart.timestamp || !chart.indicators?.quote?.[0]?.close) {
            return res.json({ c: [], t: [], s: 'no_data' });
        }

        const timestamps = chart.timestamp;
        const closes = chart.indicators.quote[0].close;

        const validData = timestamps.reduce((acc, ts, i) => {
            if (closes[i] !== null) {
                acc.t.push(ts);
                acc.c.push(closes[i]);
            }
            return acc;
        }, { t: [], c: [] });

        const result = { ...validData, s: 'ok' };

        candleCache.set(cacheKey, { data: result, timestamp: Date.now() });
        res.json(result);
    } catch (error) {
        console.error(`❌ Error in getStockCandles:`, error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get extended hours quote from Yahoo Finance
// @route   GET /api/stocks/:symbol/extended-quote
// @access  Private
export const getExtendedQuote = async (req, res) => {
    try {
        const { symbol } = req.params;
        const data = await stockData.getExtendedQuote(symbol);
        res.json(data);
    } catch (error) {
        console.error(`❌ Error in getExtendedQuote for ${req.params.symbol}:`, error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get extended hours quotes for multiple symbols in one call
// @route   GET /api/stocks/batch-extended-quote?symbols=NVDA,TSLA,GOOG
// @access  Private
export const getBatchExtendedQuote = async (req, res) => {
    try {
        const { symbols } = req.query;

        if (!symbols) {
            return res.status(400).json({ message: 'Missing symbols query parameter' });
        }

        const symbolList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

        if (symbolList.length === 0) {
            return res.status(400).json({ message: 'No valid symbols provided' });
        }

        const data = await stockData.getBatchExtendedQuotes(symbolList);
        res.json(data);
    } catch (error) {
        console.error(`❌ Error in getBatchExtendedQuote:`, error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Analyst Recommendations
// @route   GET /api/stocks/:symbol/recommendation
export const getAnalystRecommendations = async (req, res) => {
    try {
        const { symbol } = req.params;
        const data = await stockData.getAnalystRecommendations(symbol);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Price Target
// @route   GET /api/stocks/:symbol/price-target
export const getPriceTarget = async (req, res) => {
    try {
        const { symbol } = req.params;
        const data = await stockData.getPriceTarget(symbol);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Company Profile (Sector/Industry)
// @route   GET /api/stocks/:symbol/profile
export const getCompanyProfile = async (req, res) => {
    try {
        const { symbol } = req.params;
        const data = await stockData.getCompanyProfile(symbol);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
