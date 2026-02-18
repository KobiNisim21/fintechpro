/**
 * Centralized Stock Data Service
 * Single source of truth for all stock data with:
 * - Shared cache across controller, alerts, and news services
 * - In-flight request deduplication (concurrent requests share one API call)
 * - Batch Yahoo Finance queries (one call for multiple symbols)
 * - Tiered cache durations
 */

import fetch from 'node-fetch';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// Helper to get API key
const getApiKey = () => {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
        console.error('ג CRITICAL: FINNHUB_API_KEY is not set!');
    }
    return key;
};

// ============================================
// CACHE LAYER
// ============================================
const cache = new Map();

const CACHE_DURATIONS = {
    quote: 30 * 1000,          // 30 seconds for price quotes
    extendedQuote: 30 * 1000,  // 30 seconds for extended hours
    news: 5 * 60 * 1000,      // 5 minutes for news
    marketNews: 5 * 60 * 1000, // 5 minutes for market news
    forex: 6 * 60 * 60 * 1000, // 6 hours for forex rates
};

function getCached(key, duration) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < duration) {
        return cached.data;
    }
    return null;
}

function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

// ============================================
// IN-FLIGHT DEDUPLICATION
// ============================================
const inFlightRequests = new Map(); // key -> Promise

/**
 * Execute a function with in-flight deduplication.
 * If a request with the same key is already in progress,
 * return the existing promise instead of making a new call.
 */
async function dedupedFetch(key, fetchFn) {
    // If there's already an in-flight request for this key, wait for it
    if (inFlightRequests.has(key)) {
        return inFlightRequests.get(key);
    }

    // Create new request and store promise
    const promise = fetchFn()
        .finally(() => {
            // Clean up after completion
            inFlightRequests.delete(key);
        });

    inFlightRequests.set(key, promise);
    return promise;
}

// ============================================
// FINNHUB QUOTE (shared by controller + alerts)
// ============================================

/**
 * Get Finnhub quote for a single symbol.
 * Uses cache + in-flight dedup. 
 * Called by both stocksController and liveAlertsService.
 */
export async function getQuote(symbol) {
    const cacheKey = `quote_${symbol}`;

    // Check cache first
    const cached = getCached(cacheKey, CACHE_DURATIONS.quote);
    if (cached) return cached;

    // HANDLE ISRAELI STOCKS (TASE) via Yahoo Finance
    if (symbol.endsWith('.TA')) {
        return dedupedFetch(cacheKey, async () => {
            console.log(`נ‡®נ‡± Fetching TASE quote for ${symbol} from Yahoo Finance...`);
            try {
                // Fetch quote and forex rate in parallel
                const [quote, forexData] = await Promise.all([
                    yahooFinance.quote(symbol),
                    getForexRate()
                ]);

                if (!quote || quote.regularMarketPrice === undefined) {
                    throw new Error(`No Yahoo Finance data for ${symbol}`);
                }

                // TASE prices are in Agorot (ILA) -> Convert to ILS (/100) -> Convert to USD (/rate)
                // If currency is already ILS, don't divide by 100.
                let priceInILS = quote.regularMarketPrice;
                if (quote.currency === 'ILA') {
                    priceInILS = priceInILS / 100;
                }

                const usdRate = forexData.rate || 3.65;
                const priceInUSD = priceInILS / usdRate;

                // Calculate change in USD (approximate using same rate)
                let changeInILS = quote.regularMarketChange || 0;
                if (quote.currency === 'ILA') {
                    changeInILS = changeInILS / 100;
                }
                const changeInUSD = changeInILS / usdRate;

                // Percent change remains the same
                const percentChange = quote.regularMarketChangePercent || 0;

                // Previous close in USD
                const prevCloseILS = (quote.regularMarketPreviousClose || (quote.regularMarketPrice - (quote.regularMarketChange || 0)));
                const prevCloseUSD = (quote.currency === 'ILA' ? prevCloseILS / 100 : prevCloseILS) / usdRate;

                const result = {
                    c: priceInUSD,
                    d: changeInUSD,
                    dp: percentChange,
                    h: (quote.regularMarketDayHigh || 0) / (quote.currency === 'ILA' ? 100 : 1) / usdRate,
                    l: (quote.regularMarketDayLow || 0) / (quote.currency === 'ILA' ? 100 : 1) / usdRate,
                    o: (quote.regularMarketOpen || 0) / (quote.currency === 'ILA' ? 100 : 1) / usdRate,
                    pc: prevCloseUSD,
                    t: Math.floor(Date.now() / 1000)
                };

                setCache(cacheKey, result);
                return result;
            } catch (error) {
                console.error(`ג Yahoo/TASE error for ${symbol}:`, error.message);
                throw error;
            }
        });
    }

    // STANDARD US STOCKS via FINNHUB
    // Deduped fetch
    return dedupedFetch(cacheKey, async () => {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('FINNHUB_API_KEY not configured');

        const url = `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Finnhub quote failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data || data.c === undefined) {
            // Finnhub returns {c: 0} for invalid symbols sometimes, or empty result
            if (data && data.c === 0 && data.pc === 0) {
                throw new Error(`Invalid symbol or no data: ${symbol}`);
            }
        }
        // Sanity check for 0 price
        if (data.c === 0 && symbol !== 'ETH-USD' && symbol !== 'BTC-USD') { // Crypto might be handled differently but assuming regular stocks
            // Proceed but warn? Or assume it's pre-market 0? Finnhub usually returns previous close.
        }

        setCache(cacheKey, data);
        return data;
    });
}

// ============================================
// SEARCH (Finnhub)
// ============================================

/**
 * Search for stocks/symbols using Finnhub.
 */
export async function searchStocks(query) {
    const cacheKey = `search_${query.toLowerCase()}`;
    const cached = getCached(cacheKey, 60 * 60 * 1000); // 1 hour cache for search
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('FINNHUB_API_KEY not configured');

        const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(query)}&token=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Finnhub search failed: ${response.status}`);
        }

        const data = await response.json();
        const result = data.result || [];

        setCache(cacheKey, result);
        return result;
    });
}

// ============================================
// YAHOO FINANCE EXTENDED QUOTE (batch support)
// ============================================

/**
 * Get extended hours quote for a single symbol from Yahoo Finance.
 * Uses cache + in-flight dedup.
 */
export async function getExtendedQuote(symbol) {
    const cacheKey = `extended_quote_${symbol}`;

    const cached = getCached(cacheKey, CACHE_DURATIONS.extendedQuote);
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        const quote = await yahooFinance.quote(symbol);

        if (!quote) {
            throw new Error(`No Yahoo Finance data for ${symbol}`);
        }

        const result = {
            symbol: quote.symbol,
            regularMarketPrice: quote.regularMarketPrice,
            regularMarketPreviousClose: quote.regularMarketPreviousClose,
            regularMarketChange: quote.regularMarketChange,
            regularMarketChangePercent: quote.regularMarketChangePercent,
            preMarketPrice: quote.preMarketPrice || null,
            preMarketChange: quote.preMarketChange || null,
            preMarketChangePercent: quote.preMarketChangePercent || null,
            postMarketPrice: quote.postMarketPrice || null,
            postMarketChange: quote.postMarketChange || null,
            postMarketChangePercent: quote.postMarketChangePercent || null,
            marketState: quote.marketState,
            exchangeTimezoneName: quote.exchangeTimezoneName,
        };

        setCache(cacheKey, result);
        return result;
    });
}

/**
 * Get extended hours quotes for MULTIPLE symbols in ONE Yahoo Finance call.
 * This is the key optimization - 1 call instead of 15+.
 */
export async function getBatchExtendedQuotes(symbols) {
    if (!symbols || symbols.length === 0) return {};

    // Filter out symbols that are already cached
    const uncachedSymbols = [];
    const results = {};

    for (const symbol of symbols) {
        const cached = getCached(`extended_quote_${symbol}`, CACHE_DURATIONS.extendedQuote);
        if (cached) {
            results[symbol] = cached;
        } else {
            uncachedSymbols.push(symbol);
        }
    }

    // If all cached, return immediately
    if (uncachedSymbols.length === 0) {
        console.log(`ג… Batch extended quotes: all ${symbols.length} from cache`);
        return results;
    }

    // Batch fetch uncached symbols from Yahoo Finance
    const batchKey = `batch_extended_${uncachedSymbols.sort().join(',')}`;

    try {
        const batchResults = await dedupedFetch(batchKey, async () => {
            console.log(`נ“ Batch fetching ${uncachedSymbols.length} extended quotes from Yahoo Finance: ${uncachedSymbols.join(', ')}`);

            // yahoo-finance2 supports array of symbols!
            const quotes = await yahooFinance.quote(uncachedSymbols);

            // quotes can be a single object or array
            const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

            const batchData = {};
            for (const quote of quotesArray) {
                if (!quote || !quote.symbol) continue;

                const result = {
                    symbol: quote.symbol,
                    regularMarketPrice: quote.regularMarketPrice,
                    regularMarketPreviousClose: quote.regularMarketPreviousClose,
                    regularMarketChange: quote.regularMarketChange,
                    regularMarketChangePercent: quote.regularMarketChangePercent,
                    preMarketPrice: quote.preMarketPrice || null,
                    preMarketChange: quote.preMarketChange || null,
                    preMarketChangePercent: quote.preMarketChangePercent || null,
                    postMarketPrice: quote.postMarketPrice || null,
                    postMarketChange: quote.postMarketChange || null,
                    postMarketChangePercent: quote.postMarketChangePercent || null,
                    marketState: quote.marketState,
                    exchangeTimezoneName: quote.exchangeTimezoneName,
                };

                // Cache each result individually
                setCache(`extended_quote_${quote.symbol}`, result);
                batchData[quote.symbol] = result;
            }

            console.log(`ג… Batch extended quotes: ${Object.keys(batchData).length} fetched, ${symbols.length - uncachedSymbols.length} from cache`);
            return batchData;
        });

        return { ...results, ...batchResults };
    } catch (error) {
        console.error(`ג Batch extended quote error:`, error.message);
        // Return whatever we had from cache
        return results;
    }
}

// ============================================
// NEWS (shared cache for stock-specific news)
// ============================================

/**
 * Get company news from Finnhub with caching.
 */
export async function getCompanyNews(symbol) {
    const cacheKey = `news_${symbol}`;

    const cached = getCached(cacheKey, CACHE_DURATIONS.news);
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('FINNHUB_API_KEY not configured');

        const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const to = new Date().toISOString().split('T')[0];

        const response = await fetch(
            `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`
        );

        if (!response.ok) {
            throw new Error(`Finnhub news failed: ${response.status}`);
        }

        const data = await response.json();
        const limitedNews = data.slice(0, 10);

        setCache(cacheKey, limitedNews);
        return limitedNews;
    });
}

/**
 * Get general market news from Finnhub with caching.
 */
export async function getMarketNews() {
    const cacheKey = 'market_news';

    const cached = getCached(cacheKey, CACHE_DURATIONS.marketNews);
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('FINNHUB_API_KEY not configured');

        const response = await fetch(
            `${FINNHUB_BASE_URL}/news?category=general&token=${apiKey}`
        );

        if (!response.ok) {
            throw new Error(`Finnhub market news failed: ${response.status}`);
        }

        const data = await response.json();
        const limitedNews = data.slice(0, 20);

        setCache(cacheKey, limitedNews);
        return limitedNews;
    });
}

// ============================================
// FOREX (shared forex rate with long cache)
// ============================================

/**
 * Get USD/ILS forex rate using Yahoo Finance (ILS=X)
 * Much more reliable than free tier APIs.
 */
export async function getForexRate() {
    const cacheKey = 'forex_usd_ils';

    const cached = getCached(cacheKey, CACHE_DURATIONS.forex);
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        console.log('נ“¡ Fetching USD/ILS rate from Yahoo Finance (ILS=X)...');

        try {
            const quote = await yahooFinance.quote('ILS=X');

            if (!quote || !quote.regularMarketPrice) {
                throw new Error('No forex data from Yahoo');
            }

            const rate = quote.regularMarketPrice;

            const result = {
                rate,
                source: 'yahoo-finance',
                base: 'USD',
                target: 'ILS',
                lastUpdate: new Date().toISOString()
            };

            console.log(`ג… USD/ILS exchange rate: ${rate}`);
            setCache(cacheKey, result);
            return result;
        } catch (error) {
            console.error('ג Forex fetch failed:', error.message);

            // Fallback
            const fallback = { rate: 3.65, source: 'fallback', lastUpdate: new Date().toISOString() };
            setCache(cacheKey, fallback);
            return fallback;
        }
    });
}

// ============================================
// PORTFOLIO INSIGHTS (Analyst Recs, Price Targets, Company Profile)
// ============================================

/**
 * Get Analyst Recommendations (Buy/Sell/Hold)
 * Finnhub Endpoint: /stock/recommendation?symbol=AAPL
 */
export async function getAnalystRecommendations(symbol) {
    const cacheKey = `recs_${symbol}`;
    const cached = getCached(cacheKey, 60 * 60 * 1000); // 1 hour cache
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('FINNHUB_API_KEY not configured');

        const url = `${FINNHUB_BASE_URL}/stock/recommendation?symbol=${symbol}&token=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 403) {
                console.warn(`Finnhub Premium required for recs on ${symbol}, returning empty.`);
                return [];
            }
            throw new Error(`Finnhub recs failed: ${response.status}`);
        }

        const data = await response.json();
        setCache(cacheKey, data);
        return data;
    });
}

/**
 * Get Price Target (High/Low/Avg/Median)
 * Finnhub Endpoint: /stock/price-target?symbol=AAPL
 */
export async function getPriceTarget(symbol) {
    const cacheKey = `target_${symbol}`;
    const cached = getCached(cacheKey, 24 * 60 * 60 * 1000); // 24 hour cache
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        // Try Finnhub first
        try {
            const apiKey = getApiKey();
            if (apiKey) {
                const url = `${FINNHUB_BASE_URL}/stock/price-target?symbol=${symbol}&token=${apiKey}`;
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    // Validate: Finnhub returns { targetMean: 0 } for invalid/missing data
                    if (data && data.targetMean && data.targetMean > 0) {
                        setCache(cacheKey, data);
                        return data;
                    }
                }
            }
        } catch (e) {
            console.log(`[INFO] Finnhub price-target failed for ${symbol}: ${e.message}`);
        }

        // Fallback: yahoo-finance2 quoteSummary (handles auth/crumb automatically)
        console.log(`[INFO] Falling back to yahoo-finance2 for ${symbol} price target`);
        try {
            const summary = await yahooFinance.quoteSummary(symbol, { modules: ['financialData'] });
            const financials = summary?.financialData;
            if (financials && financials.targetMeanPrice) {
                const result = {
                    targetHigh: financials.targetHighPrice || 0,
                    targetLow: financials.targetLowPrice || 0,
                    targetMean: financials.targetMeanPrice || 0,
                    targetMedian: financials.targetMedianPrice || 0,
                    lastUpdated: new Date().toISOString()
                };
                setCache(cacheKey, result);
                return result;
            }
        } catch (yError) {
            console.error(`yahoo-finance2 fallback failed for ${symbol}:`, yError.message);
        }

        return null;
    });
}

/**
 * Get Company Profile (Sector, Industry, etc.)
 * Finnhub Endpoint: /stock/profile2?symbol=AAPL
 */
export async function getCompanyProfile(symbol) {
    const cacheKey = `profile_${symbol}`;
    const cached = getCached(cacheKey, 7 * 24 * 60 * 60 * 1000); // 7 days cache (static data)
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('FINNHUB_API_KEY not configured');

        const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${symbol}&token=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 403) return null;
            throw new Error(`Finnhub profile failed: ${response.status}`);
        }

        const data = await response.json();
        setCache(cacheKey, data);
        return data;
    });
}

// ============================================
// BATCH INSIGHTS (single call for all symbols)
// ============================================

/**
 * Fetch recommendations, price targets, and profiles for multiple symbols
 * in a single batch call. Uses existing cache + dedup per symbol.
 */
export async function getBatchInsights(symbols) {
    if (!symbols || symbols.length === 0) return { recommendations: {}, priceTargets: {}, profiles: {} };

    const recommendations = {};
    const priceTargets = {};
    const profiles = {};

    // Fetch all insights in parallel across all symbols
    await Promise.all(symbols.map(async (symbol) => {
        const [recs, target, profile] = await Promise.all([
            getAnalystRecommendations(symbol).catch(() => []),
            getPriceTarget(symbol).catch(() => null),
            getCompanyProfile(symbol).catch(() => null)
        ]);

        if (recs && recs.length > 0) recommendations[symbol] = recs;
        if (target) priceTargets[symbol] = target;
        if (profile) profiles[symbol] = profile;
    }));

    return { recommendations, priceTargets, profiles };
}

// ============================================
// 52-WEEK LOW (Basic Financials)
// ============================================

/**
 * Get basic financials including 52-week high/low.
 * Finnhub Endpoint: /stock/metric?symbol=AAPL&metric=all
 */
export async function getBasicFinancials(symbol) {
    const cacheKey = `metrics_${symbol}`;
    const cached = getCached(cacheKey, 6 * 60 * 60 * 1000); // 6 hours cache
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('FINNHUB_API_KEY not configured');

        const url = `${FINNHUB_BASE_URL}/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 403) return null;
            throw new Error(`Finnhub metrics failed: ${response.status}`);
        }

        const data = await response.json();
        setCache(cacheKey, data);
        return data;
    });
}

// ============================================
// EARNINGS CALENDAR
// ============================================

/**
 * Get earnings calendar for a date range.
 * Finnhub Endpoint: /calendar/earnings?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function getEarningsCalendar(from, to) {
    const cacheKey = `earnings_${from}_${to}`;
    const cached = getCached(cacheKey, 60 * 60 * 1000); // 1 hour cache
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('FINNHUB_API_KEY not configured');

        const url = `${FINNHUB_BASE_URL}/calendar/earnings?from=${from}&to=${to}&token=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Finnhub earnings calendar failed: ${response.status}`);
        }

        const data = await response.json();
        const result = data.earningsCalendar || [];
        setCache(cacheKey, result);
        return result;
    });
}

// ============================================
// PORTFOLIO ANALYTICS (Health Score + Benchmark)
// ============================================

// Known ETF symbols to exclude from analyst sentiment
const ETF_SYMBOLS = new Set([
    'GLD', 'TLT', 'IVV', 'VTV', 'XBI', 'SPY', 'QQQ', 'VOO', 'VTI',
    'ARKK', 'VGT', 'XLK', 'XLF', 'XLE', 'IWM', 'DIA', 'EEM', 'HYG',
    'AGG', 'BND', 'LQD', 'IEFA', 'VEA', 'VWO', 'SCHD', 'JEPI',
]);

/**
 * Fetch Yahoo Finance chart data for a symbol.
 * Supports custom start date (period1). Default 1y.
 * Returns { dates: string[], closes: number[] }
 */
async function fetchYahooChart(symbol, startDate = null) {
    // Calculate period1 (start timestamp)
    const now = Math.floor(Date.now() / 1000);
    const startTimestamp = startDate
        ? Math.floor(new Date(startDate).getTime() / 1000)
        : (now - 365 * 24 * 60 * 60);

    const cacheKey = `chart_yahoo_${symbol}_${startTimestamp}`;
    const cached = getCached(cacheKey, 60 * 60 * 1000); // 1 hour
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        // Use yahoo-finance2 chart method if possible, or fallback to direct fetch URL?
        // existing code used direct fetch. Let's stick to direct text fetch for consistency with previous impl 
        // OR better: use yahooFinance.chart() like I planned?
        // The existing code used `fetch(url)`. I'll stick to that to avoid "YahooFinance" usage issues if the instance isn't configured for it (though line 11 says `const yahooFinance = new YahooFinance()`).
        // Actually, line 11 `import YahooFinance from 'yahoo-finance2'` and line 12 `const yahooFinance = new YahooFinance()` 
        // suggests `yahooFinance` instance is available.
        // But `yahoo-finance2` library default export IS a class, or instance? 
        // `import YahooFinance from 'yahoo-finance2'` usually imports the default instance.
        // Let's stick to the URL fetch pattern used in the file to be safe.

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startTimestamp}&period2=${now}&interval=1d&includePrePost=false`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                // Try yahoo-finance2 library as fallback? 
                // No, just throw or return empty.
                throw new Error(`Yahoo chart failed: ${response.status}`);
            }

            const data = await response.json();
            const chart = data?.chart?.result?.[0];
            if (!chart?.timestamp || !chart?.indicators?.quote?.[0]?.close) {
                return { dates: [], closes: [] };
            }

            const timestamps = chart.timestamp;
            const rawCloses = chart.indicators.quote[0].close;
            const dates = [];
            const closes = [];

            for (let i = 0; i < timestamps.length; i++) {
                if (rawCloses[i] !== null && rawCloses[i] !== undefined) {
                    dates.push(new Date(timestamps[i] * 1000).toISOString().split('T')[0]);
                    closes.push(rawCloses[i]);
                }
            }

            const result = { dates, closes };
            setCache(cacheKey, result);
            return result;
        } catch (err) {
            console.error(`[CHART] Failed for ${symbol}:`, err.message);
            return { dates: [], closes: [] };
        }
    });
}

/**
 * Fetch dividend info for a symbol using yahoo-finance2.
 * Returns { exDate, paymentDate, dividendRate } or null.
 */
async function fetchDividendInfo(symbol) {
    const cacheKey = `dividend_${symbol}`;
    const cached = getCached(cacheKey, 6 * 60 * 60 * 1000); // 6 hours
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        try {
            const result = await YahooFinance.quoteSummary(symbol, { modules: ['calendarEvents', 'summaryDetail'] });
            const cal = result?.calendarEvents;
            const detail = result?.summaryDetail;

            // Try calendarEvents first, fall back to summaryDetail
            const exDate = cal?.exDividendDate
                ? new Date(cal.exDividendDate).toISOString().split('T')[0]
                : (detail?.exDividendDate ? new Date(detail.exDividendDate).toISOString().split('T')[0] : null);

            const dividendRate = detail?.dividendRate || cal?.dividendRate || 0;
            const paymentDate = cal?.dividendDate
                ? new Date(cal.dividendDate).toISOString().split('T')[0]
                : null;

            const data = { exDate, paymentDate, dividendRate };
            if (exDate) setCache(cacheKey, data);
            return data;
        } catch (err) {
            console.error(`[DIVIDEND] Failed for ${symbol}:`, err.message);
            return null;
        }
    });
}
/**
 * Fetch dividend information with fallbacks
 */
async function fetchDividendInfo(symbol) {
    try {
        console.log(`[DIVIDEND] Fetching for ${symbol}...`);
        const result = await yahooFinance.quoteSummary(symbol, {
            modules: ['calendarEvents', 'summaryDetail', 'defaultKeyStatistics']
        });

        const calendar = result.calendarEvents || {};
        const summary = result.summaryDetail || {};

        // Priority 1: Calendar Events
        let exDate = calendar.exDividendDate;
        let paymentDate = calendar.dividendDate;

        // Priority 2: Summary Detail
        if (!exDate && summary.exDividendDate) {
            exDate = summary.exDividendDate;
        }

        // Rate fallback
        const rate = summary.dividendRate || summary.trailingAnnualDividendRate || 0;

        if (!exDate) {
            console.log(`[DIVIDEND] No ex-date found for ${symbol}`);
            return null;
        }

        console.log(`[DIVIDEND] Found ${symbol}: Ex=${exDate} (${new Date(exDate).toDateString()}), Pay=${paymentDate}, Rate=${rate}`);

        return {
            exDate,
            paymentDate,
            dividendRate: rate
        };
    } catch (error) {
        console.error(`[DIVIDEND] Error fetching ${symbol}:`, error.message);
        return null;
    }
}

/**
 * Get Portfolio Health Score and Benchmark data (TWR).
 * Accepts FULL positions array (with lots).
 * All data fetched in parallel. Result cached 1 hour.
 *
 * @param {Array} positions - Array of position objects with lots
 */
export async function getPortfolioHealthAndBenchmark(positions) {
    // Extract basic arrays for health score logic (using aggregates)
    const symbols = positions.map(p => p.symbol);
    const quantities = positions.map(p => p.quantity); // Total qty
    const prices = positions.map(p => p.averagePrice); // Avg price (cost basis)

    // Build a stable cache key
    const sortedKey = symbols.slice().sort().join(',');
    const cacheKey = `analytics_v2_${sortedKey}_${quantities.join(',')}_${positions.length}`;
    const cached = getCached(cacheKey, 60 * 60 * 1000);
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        // Calculate Portfolio Start Date (earliest lot date)
        let earliestDate = new Date();
        const lotEvents = []; // { date, symbol, quantity, price }

        positions.forEach(pos => {
            if (pos.lots && pos.lots.length > 0) {
                pos.lots.forEach(lot => {
                    const d = new Date(lot.date);
                    if (d < earliestDate) earliestDate = d;
                    lotEvents.push({
                        date: d.toISOString().split('T')[0],
                        symbol: pos.symbol,
                        quantity: lot.quantity,
                        price: lot.price
                    });
                });
            } else {
                // Fallback for migrated/legacy positions
                const d = pos.createdAt ? new Date(pos.createdAt) : new Date();
                if (d < earliestDate) earliestDate = d;
                lotEvents.push({
                    date: d.toISOString().split('T')[0],
                    symbol: pos.symbol,
                    quantity: pos.quantity,
                    price: pos.averagePrice
                });
            }
        });

        // ג”€ג”€ Parallel fetch ג”€ג”€
        const [metricsResults, profilesResults, recsResults, spyChart, dividendResults, ...symbolCharts] =
            await Promise.all([
                Promise.all(symbols.map(s => getBasicFinancials(s).catch(() => null))),
                Promise.all(symbols.map(s => getCompanyProfile(s).catch(() => null))),
                Promise.all(symbols.map(s => getAnalystRecommendations(s).catch(() => []))),
                fetchYahooChart('SPY', earliestDate),
                Promise.all(symbols.map(s => fetchDividendInfo(s).catch(() => null))),
                ...symbols.map(s => fetchYahooChart(s, earliestDate).catch(() => ({ dates: [], closes: [] })))
            ]);

        // ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
        // 1. HEALTH SCORE (Logic preserved)
        // ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
        const totalValue = quantities.reduce((acc, q, i) => acc + (q * prices[i]), 0);

        // -- Diversification --
        const sectorExposure = {};
        let maxSectorPct = 0;
        symbols.forEach((_, i) => {
            const sector = profilesResults[i]?.finnhubIndustry || 'Unknown';
            const val = quantities[i] * prices[i];
            sectorExposure[sector] = (sectorExposure[sector] || 0) + val;
        });
        Object.values(sectorExposure).forEach(val => {
            const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;
            if (pct > maxSectorPct) maxSectorPct = pct;
        });
        const diversificationScore = Math.max(0, 100 - Math.max(0, maxSectorPct - 30) * 2.5);

        // -- Volatility --
        let weightedBeta = 0;
        let validBetaWeight = 0;
        symbols.forEach((_, i) => {
            const beta = metricsResults[i]?.metric?.beta || 1;
            const weight = totalValue > 0 ? (quantities[i] * prices[i]) / totalValue : 0;
            weightedBeta += beta * weight;
            validBetaWeight += weight;
        });
        const portfolioBeta = validBetaWeight > 0 ? weightedBeta / validBetaWeight : 1;
        const volatilityScore = Math.max(0, 100 - Math.max(0, portfolioBeta - 1.0) * 50);

        // -- Sentiment --
        let totalBuyRatio = 0;
        let sentimentCount = 0;
        symbols.forEach((_, i) => {
            const isETF = profilesResults[i]?.finnhubIndustry === 'Exchange Traded Fund';
            if (isETF) return;
            const recs = recsResults[i];
            if (recs && recs.length > 0) {
                const latest = recs[0];
                const total = latest.buy + latest.hold + latest.sell + latest.strongBuy + latest.strongSell;
                if (total > 0) {
                    const buyRatio = (latest.buy + latest.strongBuy) / total;
                    totalBuyRatio += buyRatio;
                    sentimentCount++;
                }
            }
        });
        const sentimentScore = sentimentCount > 0 ? (totalBuyRatio / sentimentCount) * 100 : 50;

        const healthScore = Math.round(
            (diversificationScore * 0.4) + (volatilityScore * 0.3) + (sentimentScore * 0.3)
        );

        // ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
        // 2. BENCHMARK COMPARISON (TWR)
        // ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
        const benchmarkData = [];
        const symbolCloseLookup = symbolCharts.map(chart => {
            const map = {};
            if (chart.dates) {
                chart.dates.forEach((d, i) => map[d] = chart.closes[i]);
            }
            return map;
        });

        // Group inflows
        const inflowsByDate = {};
        lotEvents.forEach(e => {
            if (!inflowsByDate[e.date]) inflowsByDate[e.date] = [];
            inflowsByDate[e.date].push(e);
        });

        const allDates = spyChart.dates || [];
        let cumulativeTWR = 0;
        let spCumReturn = 0;
        const currentQty = {};
        symbols.forEach(s => currentQty[s] = 0);

        let prevPortfolioValue = 0;
        let prevSpyClose = null;

        for (let i = 0; i < allDates.length; i++) {
            const date = allDates[i];
            const spyClose = spyChart.closes[i];

            // 1. Process Inflows
            let dailyInflowValue = 0;
            const todaysInflows = inflowsByDate[date] || [];
            todaysInflows.forEach(inf => {
                currentQty[inf.symbol] = (currentQty[inf.symbol] || 0) + inf.quantity;
                dailyInflowValue += (inf.quantity * inf.price);
            });

            // 2. Calculate End Value
            let currentMarketValue = 0;
            let hasPrice = false;

            symbols.forEach((s, idx) => {
                const qty = currentQty[s];
                if (qty > 0) {
                    const price = symbolCloseLookup[idx][date];
                    if (price) {
                        currentMarketValue += qty * price;
                        hasPrice = true;
                    }
                }
            });

            // 3. TWR Step
            const startAdj = prevPortfolioValue + dailyInflowValue;
            let dailyReturn = 0;

            if (startAdj > 0) {
                dailyReturn = (currentMarketValue - startAdj) / startAdj;
            } else if (dailyInflowValue > 0) {
                dailyReturn = (currentMarketValue - dailyInflowValue) / dailyInflowValue;
            }

            cumulativeTWR = ((1 + cumulativeTWR) * (1 + dailyReturn)) - 1;

            // SPY Return
            if (prevSpyClose === null) {
                spCumReturn = 0;
            } else {
                const spyDaily = (spyClose - prevSpyClose) / prevSpyClose;
                spCumReturn = ((1 + spCumReturn) * (1 + spyDaily)) - 1;
            }

            if (hasPrice || dailyInflowValue > 0) {
                benchmarkData.push({
                    date,
                    portfolio: parseFloat((cumulativeTWR * 100).toFixed(2)),
                    spy: parseFloat((spCumReturn * 100).toFixed(2))
                });
            }

            prevPortfolioValue = currentMarketValue;
            prevSpyClose = spyClose;
        }

        // ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
        // 3. EXTRAS (Dividends, Correlation)
        // ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const dividends = [];
        const sixtyDaysFromNow = new Date();
        sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

        symbols.forEach((sym, i) => {
            const info = dividendResults[i];
            if (!info || !info.exDate) return;

            const exDate = new Date(info.exDate);

            // Logic: Show if Upcoming (next 60 days) OR Current Month (even if passed)
            const isUpcoming = exDate >= now && exDate <= sixtyDaysFromNow;
            const isCurrentMonth = exDate.getMonth() === currentMonth && exDate.getFullYear() === currentYear;

            if (!isUpcoming && !isCurrentMonth) return;

            dividends.push({
                symbol: sym,
                exDate: info.exDate,
                paymentDate: info.paymentDate || null,
                amount: info.dividendRate || 0,
                // Calculate Payout based on TOTAL Quantity (from DB aggregation)
                estimatedPayout: Math.round(((info.dividendRate || 0) * quantities[i]) * 100) / 100,
            });
        });
        dividends.sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime());

        // Correlation
        const dailyReturns = symbols.map((_, i) => {
            const chart = symbolCharts[i] || { dates: [], closes: [] };
            const closes = chart.closes;
            if (closes.length < 2) return [];
            const recent = closes.slice(-31);
            const returns = [];
            for (let j = 1; j < recent.length; j++) {
                if (recent[j - 1] > 0) returns.push((recent[j] - recent[j - 1]) / recent[j - 1]);
            }
            return returns;
        });

        function pearson(a, b) {
            const n = Math.min(a.length, b.length);
            if (n < 5) return null;
            const ax = a.slice(0, n), bx = b.slice(0, n);
            const meanA = ax.reduce((s, v) => s + v, 0) / n;
            const meanB = bx.reduce((s, v) => s + v, 0) / n;
            let num = 0, denA = 0, denB = 0;
            for (let j = 0; j < n; j++) {
                const da = ax[j] - meanA, db = bx[j] - meanB;
                num += da * db;
                denA += da * da;
                denB += db * db;
            }
            const den = Math.sqrt(denA * denB);
            return den === 0 ? 0 : Math.round((num / den) * 100) / 100;
        }

        const correlationMatrix = {
            symbols: symbols.slice(),
            matrix: symbols.map((_, i) =>
                symbols.map((_, j) => (i === j ? 1 : pearson(dailyReturns[i], dailyReturns[j])))
            ),
        };

        const result = {
            healthScore,
            components: {
                diversification: Math.round(diversificationScore),
                volatility: Math.round(volatilityScore),
                sentiment: Math.round(sentimentScore),
            },
            portfolioBeta: Math.round(portfolioBeta * 100) / 100,
            maxSectorPct: Math.round(maxSectorPct),
            benchmarkData,
            dividends,
            correlationMatrix,
            lastUpdated: new Date().toISOString()
        };

        setCache(cacheKey, result);
        return result;
    });
}
