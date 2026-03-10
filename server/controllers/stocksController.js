import Position from '../models/Position.js';
import * as stockData from '../services/stockDataService.js';
import { searchIsraeliSecurities, setCachedPrice, refreshFundPriceViaProxy, getAllCachedPrices } from '../services/israeliSecuritiesService.js';
import { makeProxyRequest } from '../utils/proxyUtils.js';

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
        let data = [];

        // Use separate try/catch blocks so one failure doesn't crash the whole endpoint
        let localData = [];
        try {
            localData = searchIsraeliSecurities(q) || [];
        } catch (err) {
            console.error('[Search] Failed to search local Israeli catalog:', err.message);
        }

        // If local catalog fails completely, we still want to return empty array cleanly,
        // but let's ensure the auto-detect Hebrew works.
        if (/[\u0590-\u05FF]/.test(q)) {
            // It's Hebrew. Return local catalog matches. 
            // Finnhub doesn't support Hebrew ticker search, so we stop here.
            data = localData;
        } else {
            // Search global Finnhub API safely
            let finnhubData = [];
            try {
                finnhubData = await stockData.searchStocks(q) || [];
            } catch (err) {
                console.error('[Search] Failed to search Finnhub API:', err.message);
            }

            // Combine, deduplicate by symbol, taking local first
            const seen = new Set(localData.map(d => d.symbol));
            const filteredFinnhub = finnhubData.filter(d => {
                if (!d || !d.symbol) return false;
                if (seen.has(d.symbol)) return false;
                seen.add(d.symbol);
                return true;
            });

            data = [...localData, ...filteredFinnhub];
        }

        res.json(data);
    } catch (error) {
        console.error('[Search] Search endpoint critical failure:', error);
        // Silent Failure: return empty array [] to the frontend instead of 500 error
        res.json([]);
    }
};

// Temporary endpoint for debugging Vercel catalog bundling
export const listAllIsraeli = async (req, res) => {
    try {
        const { israeliCatalog } = await import('../data/israeliCatalog.js');
        res.json({ count: israeliCatalog.length, sample: israeliCatalog.slice(0, 10) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Global variables for caching token specifically for testTaseRaw
let taseAccessToken = null;
let taseTokenExpiresAt = 0;
let taseCookies = '';

// @desc    Direct raw TASE API connection test for debugging production keys
// @route   GET /api/stocks/tase-raw-test
// @access  Public
export const testTaseRaw = async (req, res) => {
    const startTime = Date.now();
    try {
        const { id, refresh } = req.query;
        if (!id) {
            return res.status(400).json({ error: 'Missing id parameter (e.g. ?id=5131425)' });
        }

        // === CACHE-FIRST: Read from MongoDB instantly ===
        const { fetchFundNAV: getFundFromCache } = await import('../services/israeliSecuritiesService.js');
        const cached = await getFundFromCache(id);

        if (cached && cached.price > 0 && !cached.error && refresh !== 'true') {
            // Return cached data immediately (< 100ms)
            return res.json({
                success: true,
                source: 'db_cache',
                elapsed_ms: Date.now() - startTime,
                fund_id: id,
                price_ils: cached.price,
                price_usd: cached.price / 3.65,
                change_percent: cached.changePercent,
                age_hours: cached.ageHours || 'unknown',
                from_cache: true,
                hint: 'Add ?refresh=true to force a proxy refresh (slow, ~30s)'
            });
        }

        // === If no cache OR refresh=true, try proxy refresh ===
        console.log(`[TASE Raw Test] No cache or refresh requested for fund ${id}. Trying proxy...`);

        try {
            const { refreshFundPriceViaProxy } = await import('../services/israeliSecuritiesService.js');
            const result = await refreshFundPriceViaProxy(id, 3.65);

            return res.json({
                success: true,
                source: 'proxy_refresh',
                elapsed_ms: Date.now() - startTime,
                fund_id: id,
                price_ils: result.priceILS,
                price_usd: result.priceUSD,
                price_agorot: result.priceAgorot,
                change_percent: result.changePercent,
                hint: 'Price has been saved to DB cache for instant future access'
            });
        } catch (proxyErr) {
            // Proxy failed — return whatever we have (even if price=0)
            return res.status(502).json({
                error: 'Proxy refresh failed',
                proxy_error: proxyErr.message,
                elapsed_ms: Date.now() - startTime,
                fund_id: id,
                cached_data: cached || null,
                hint: 'Use POST /api/stocks/set-israeli-price to manually set the price'
            });
        }

    } catch (err) {
        res.status(500).json({ error: err.message, elapsed_ms: Date.now() - startTime });
    }
};

// @desc    Manually set the cached price for an Israeli fund
// @route   POST /api/stocks/set-israeli-price
// @access  Public (for admin use — add auth later)
export const setIsraeliPrice = async (req, res) => {
    try {
        const { fundId, priceILS, exchangeRate, name } = req.body;

        if (!fundId || !priceILS) {
            return res.status(400).json({ error: 'Missing fundId or priceILS in body' });
        }

        const rate = exchangeRate || 3.65;
        const result = await setCachedPrice(fundId, priceILS, rate, { name, source: 'manual' });

        res.json({
            success: true,
            message: `Price cached for fund ${fundId}`,
            data: result
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Get all cached Israeli fund prices
// @route   GET /api/stocks/israeli-prices
// @access  Public
export const getIsraeliPrices = async (req, res) => {
    try {
        const prices = await getAllCachedPrices();
        res.json({ success: true, count: prices.length, data: prices });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Refresh Israeli fund price via TASE proxy (slow — background use only)
// @route   POST /api/stocks/refresh-israeli-prices
// @access  Public (for admin use)
export const refreshIsraeliPrices = async (req, res) => {
    try {
        const { fundId, exchangeRate } = req.body || {};

        if (!fundId) {
            return res.status(400).json({ error: 'Missing fundId in body' });
        }

        const rate = exchangeRate || 3.65;
        console.log(`[Refresh] Starting proxy refresh for fund ${fundId}...`);
        const result = await refreshFundPriceViaProxy(fundId, rate);

        res.json({
            success: true,
            message: `Price refreshed for fund ${fundId}`,
            data: result
        });
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
};

// ... (other exports) ...

// @desc    Get portfolio health score & benchmark comparison
// @route   GET /api/stocks/portfolio-analytics
// @access  Private
export const getPortfolioAnalytics = async (req, res) => {
    try {
        // Fetch positions from DB to ensure TWR accuracy with lots
        const positions = await Position.find({ user: req.user._id }).lean(); // .lean() for plain objects

        if (!positions || positions.length === 0) {
            // Return empty/default structure if no positions
            return res.json({
                healthScore: 0,
                components: { diversification: 0, volatility: 0, sentiment: 0 },
                portfolioBeta: 0,
                maxSectorPct: 0,
                benchmarkData: [],
                dividends: [],
                correlationMatrix: { symbols: [], matrix: [] }
            });
        }

        const data = await stockData.getPortfolioHealthAndBenchmark(positions);
        res.json(data);
    } catch (error) {
        console.error('❌ Error in getPortfolioAnalytics:', error.message);
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

        // TASE Mutual Funds don't have historical data on Yahoo Finance.
        if (symbol.startsWith('FUND:')) {
            console.log(`[HISTORY] Skipping Yahoo Finance history block for ${symbol}`);
            return res.json({ c: [], t: [], s: 'no_data' });
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

// @desc    Batch fetch insights (recs + targets + profiles) for multiple symbols
// @route   GET /api/stocks/batch-insights?symbols=NVDA,AAPL,...
// @access  Private
export const getBatchInsights = async (req, res) => {
    try {
        const { symbols } = req.query;
        if (!symbols) {
            return res.status(400).json({ message: 'Missing symbols query parameter' });
        }

        const symbolList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        if (symbolList.length === 0) {
            return res.status(400).json({ message: 'No valid symbols provided' });
        }

        const data = await stockData.getBatchInsights(symbolList);
        res.json(data);
    } catch (error) {
        console.error('❌ Error in getBatchInsights:', error.message);
        res.status(500).json({ message: error.message });
    }
};


// @desc    Get market calendar (economic events + holidays + stock splits)
// @route   GET /api/stocks/market-calendar?symbols=NVDA,AAPL,...
// @access  Private
export const getMarketCalendar = async (req, res) => {
    try {
        const { symbols } = req.query;
        const symbolList = symbols
            ? symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
            : [];

        // Fetch all three data sources in parallel
        const [economicEvents, marketHolidays, stockSplits] = await Promise.all([
            stockData.getEconomicEvents(),
            stockData.getMarketHolidays('US'),
            symbolList.length > 0 ? stockData.getStockSplits(symbolList) : [],
        ]);

        res.json({
            economicEvents,
            marketHolidays,
            stockSplits,
        });
    } catch (error) {
        console.error('❌ Error in getMarketCalendar:', error.message);
        res.status(500).json({ message: error.message });
    }
};
