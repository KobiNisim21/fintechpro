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

        // Get live USD/ILS rate from Yahoo Finance (cached 6h)
        const forexData = await stockData.getForexRate();
        const liveRate = forexData?.rate || 3.65;
        console.log(`[TASE Raw Test] Live USD/ILS rate: ${liveRate}`);

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
                price_usd: cached.price / liveRate,
                exchange_rate: liveRate,
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
            const result = await refreshFundPriceViaProxy(id, liveRate);

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

        // Use live rate if not explicitly provided
        let rate = exchangeRate;
        if (!rate) {
            const forexData = await stockData.getForexRate();
            rate = forexData?.rate || 3.65;
        }
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

        // Use live rate if not explicitly provided
        let rate = exchangeRate;
        if (!rate) {
            const forexData = await stockData.getForexRate();
            rate = forexData?.rate || 3.65;
        }
        console.log(`[Refresh] Starting proxy refresh for fund ${fundId} with rate ${rate}...`);
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

// @desc    Admin one-time fix: update position data directly
// @route   POST /api/stocks/admin-fix-position
// @access  Public (TEMPORARY — remove after use)
export const adminFixPosition = async (req, res) => {
    try {
        const { oldSymbol, newSymbol, newName, quantity, averagePrice } = req.body;

        if (!oldSymbol) {
            return res.status(400).json({ error: 'Missing oldSymbol' });
        }

        // Find position with old symbol
        const position = await Position.findOne({ symbol: oldSymbol.toUpperCase() });
        if (!position) {
            return res.status(404).json({ error: `Position not found for symbol ${oldSymbol}` });
        }

        // Apply fixes
        if (newSymbol) position.symbol = newSymbol.toUpperCase();
        if (newName) position.name = newName;
        if (quantity !== undefined) position.quantity = quantity;
        if (averagePrice !== undefined) position.averagePrice = averagePrice;

        // Update lots to match new values
        if (quantity !== undefined && averagePrice !== undefined) {
            position.lots = [{
                quantity: quantity,
                price: averagePrice,
                date: position.lots?.[0]?.date || new Date()
            }];
            position.markModified('lots');
        }

        const saved = await position.save();

        res.json({
            success: true,
            message: `Position updated: ${oldSymbol} → ${saved.symbol}`,
            position: {
                id: saved._id,
                symbol: saved.symbol,
                name: saved.name,
                quantity: saved.quantity,
                averagePrice: saved.averagePrice,
                lots: saved.lots
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
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

// @desc    Get historical data for multiple symbols in one request
// @route   GET /api/stocks/batch-history?symbols=NVDA,AAPL&from=123&to=456
// @access  Private
export const getBatchHistory = async (req, res) => {
    try {
        const { symbols, from, to } = req.query;

        if (!symbols || !from || !to) {
            return res.status(400).json({ message: 'Missing parameters' });
        }

        const symbolList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

        const results = {};
        const fetchPromises = symbolList.map(async (symbol) => {
            if (symbol.startsWith('FUND:')) {
                results[symbol] = { c: [], t: [], s: 'no_data' };
                return;
            }

            const cacheKey = `candles_yahoo_${symbol}_${from}_${to}`;
            const cached = candleCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
                results[symbol] = cached.data;
                return;
            }

            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${to}&interval=1d&includePrePost=false`;
            
            const response = await fetch(yahooUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                results[symbol] = { c: [], t: [], s: 'no_data', error: `HTTP ${response.status}` };
                return;
            }

            const data = await response.json();
            const chart = data?.chart?.result?.[0];
            if (!chart || !chart.timestamp || !chart.indicators?.quote?.[0]?.close) {
                results[symbol] = { c: [], t: [], s: 'no_data' };
                return;
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
            results[symbol] = result;
        });

        await Promise.allSettled(fetchPromises);
        res.json(results);
    } catch (error) {
        console.error(`❌ Error in getBatchHistory:`, error.message);
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

// @desc    Get complete portfolio snapshot (positions + prices + sparklines) in one call
// @route   GET /api/stocks/portfolio-snapshot
// @access  Private  
export const getPortfolioSnapshot = async (req, res) => {
    try {
        // 1. Fetch user positions from DB
        const positions = await Position.find({ user: req.user._id }).lean();
        
        if (!positions || positions.length === 0) {
            return res.json({ positions: [] });
        }

        const symbols = [...new Set(positions.map(p => p.symbol))];

        // 2. Get batch extended quotes for all symbols
        const quotesPromise = stockData.getBatchExtendedQuotes(symbols);

        // 3. Get batch history (30-day) for sparklines
        const to = Math.floor(Date.now() / 1000);
        const from = to - (30 * 24 * 60 * 60); // 30 days ago
        
        // Use local batch history logic directly or create a helper.
        // We'll just construct the internal fetch logic to avoid making an HTTP call to our own API
        const historyResults = {};
        const historyPromises = symbols.map(async (symbol) => {
            if (symbol.startsWith('FUND:')) {
                historyResults[symbol] = { c: [], t: [], s: 'no_data' };
                return;
            }

            const cacheKey = `candles_yahoo_${symbol}_${from}_${to}`;
            const cached = candleCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
                historyResults[symbol] = cached.data;
                return;
            }

            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${to}&interval=1d&includePrePost=false`;
            
            try {
                const response = await fetch(yahooUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });

                if (!response.ok) {
                    historyResults[symbol] = { c: [], t: [], s: 'no_data', error: `HTTP ${response.status}` };
                    return;
                }

                const data = await response.json();
                const chart = data?.chart?.result?.[0];
                if (!chart || !chart.timestamp || !chart.indicators?.quote?.[0]?.close) {
                    historyResults[symbol] = { c: [], t: [], s: 'no_data' };
                    return;
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
                historyResults[symbol] = result;
            } catch (err) {
                historyResults[symbol] = { c: [], t: [], s: 'error', error: err.message };
            }
        });

        // Wait for quotes and history
        const [quotes] = await Promise.all([
            quotesPromise,
            Promise.allSettled(historyPromises)
        ]);

        // 4. Combine data
        const enrichedPositions = positions.map(pos => {
            const quote = quotes[pos.symbol] || {};
            const history = historyResults[pos.symbol] || { c: [], t: [], s: 'no_data' };
            
            return {
                ...pos,
                quote,
                sparkline: history
            };
        });

        res.json({ positions: enrichedPositions });
    } catch (error) {
        console.error('❌ Error in getPortfolioSnapshot:', error.message);
        res.status(500).json({ message: error.message });
    }
};
