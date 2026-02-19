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
    const symbols = positions.map(p => p.symbol);
    console.log(`--- STOCK DATA SERVICE v8 LOADED (${positions.length} positions) ---`);
    const sortedKey = symbols.slice().sort().join(',');
    const cacheKey = `analytics_v9_${sortedKey}_${positions.length}`;
    const cached = getCached(cacheKey, 60 * 60 * 1000);
    if (cached) return cached;

    // 2. Deduped Fetch
    console.log(`[Health] Starting fetch for ${positions.length} positions:`, cacheKey);
    return dedupedFetch(cacheKey, async () => {
        try {
            console.log('[Health] Calculating aggregates...');
            // --- A. Pre-calculation & aggregation ---
            const quantities = [];
            const prices = [];
            let earliestDate = new Date();
            let hasFoundDate = false;
            const lotEvents = []; // { date, symbol, quantity, price }

            // Initialize earliestDate to a far future timestamps to ensure Math.min works
            let minTimestamp = 8640000000000000;

            positions.forEach(pos => {
                let qty = 0;
                let cost = 0;
                let posHasLots = false;

                if (pos.lots && pos.lots.length > 0) {
                    pos.lots.forEach(lot => {
                        const q = Number(lot.quantity);
                        const p = Number(lot.price);

                        if (!isNaN(q) && !isNaN(p)) {
                            qty += q;
                            cost += (q * p);
                            posHasLots = true;

                            const d = new Date(lot.date);
                            // Valid date validation: Must be valid AND after year 2000 (avoids 1970/null)
                            if (!isNaN(d.getTime())) {
                                if (d.getFullYear() > 2000 && d.getTime() < minTimestamp) {
                                    minTimestamp = d.getTime();
                                    hasFoundDate = true;
                                }
                                lotEvents.push({
                                    date: d.getFullYear() > 2000 ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0], // Fallback to today for bad dates
                                    symbol: pos.symbol,
                                    quantity: q,
                                    price: p
                                });
                            }
                        }
                    });
                }

                // Fallback if no lots or lots resulted in 0 quantity (orphan position)
                if (!posHasLots || qty === 0) {
                    qty = Number(pos.quantity) || 0;
                    const avg = Number(pos.averagePrice) || 0;
                    cost = qty * avg;

                    // Try to get a date from created_at
                    const d = pos.createdAt ? new Date(pos.createdAt) : new Date();
                    const safeDate = !isNaN(d.getTime()) ? d : new Date();

                    if (safeDate.getTime() < minTimestamp) {
                        minTimestamp = safeDate.getTime();
                        hasFoundDate = true;
                    }

                    lotEvents.push({
                        date: safeDate.toISOString().split('T')[0],
                        symbol: pos.symbol,
                        quantity: qty,
                        price: avg
                    });
                }

                quantities.push(qty);
                prices.push(qty > 0 ? cost / qty : 0);
            });

            // Ensure we look back at least 1 year for benchmark comparison
            // BUT we will filter the output to start from the actual minTimestamp (inception)
            // to avoid the "vertical spike" from 0.
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const oneYearAgoTs = oneYearAgo.getTime();

            // Safety check: if minTimestamp is still original init value (no valid lots found), default to "Today"
            // This prevents showing 1 year of 0s if all dates are invalid.
            if (typeof minTimestamp !== 'number' || isNaN(minTimestamp) || minTimestamp >= 8640000000000000) {
                minTimestamp = Date.now();
            }
            // Fetch logic: still fetch 1 year to ensure we have context/SPY data
            earliestDate = new Date(Math.min(minTimestamp, oneYearAgoTs));
            if (isNaN(earliestDate.getTime())) earliestDate = oneYearAgo;

            const inceptionDateStr = new Date(minTimestamp).toISOString().split('T')[0];
            console.log(`[Health] Chart Fetch Start: ${earliestDate.toISOString().split('T')[0]}, Inception: ${inceptionDateStr}`);

            // --- B. Parallel Data Fetching ---
            console.log('[Health] Starting parallel fetch with timeouts...');
            // Use specific timeouts/catch for each to prevent one failure from blocking all
            const fetchWithTimeout = (promise, ms = 10000, fallback = null) => {
                const timeout = new Promise(resolve => setTimeout(() => resolve(fallback), ms));
                return Promise.race([promise, timeout]).catch(() => fallback);
            };

            const [
                metricsResults,
                profilesResults,
                recsResults,
                spyChart,
                dividendResults,
                ...symbolCharts
            ] = await Promise.all([
                Promise.all(symbols.map(s => fetchWithTimeout(getBasicFinancials(s).catch(e => { console.error(`Metrics error ${s}:`, e.message); return null; }), 5000, null))),
                Promise.all(symbols.map(s => fetchWithTimeout(getCompanyProfile(s).catch(e => { console.error(`Profile error ${s}:`, e.message); return {}; }), 5000, {}))),
                Promise.all(symbols.map(s => fetchWithTimeout(getAnalystRecommendations(s).catch(e => { console.error(`Recs error ${s}:`, e.message); return []; }), 5000, []))),
                fetchWithTimeout(fetchYahooChart('SPY', earliestDate).catch(e => { console.error('SPY Chart error:', e.message); return { dates: [], closes: [] }; }), 8000, { dates: [], closes: [] }),
                Promise.all(symbols.map(s => fetchWithTimeout(fetchDividendInfo(s).catch(e => { console.error(`Dividend error ${s}:`, e.message); return null; }), 5000, null))),
                ...symbols.map(s => fetchWithTimeout(fetchYahooChart(s, earliestDate).catch(e => { console.error(`Chart error ${s}:`, e.message); return { dates: [], closes: [] }; }), 8000, { dates: [], closes: [] }))
            ]);

            console.log('[Health] Fetch complete. Building result...');

            // --- C. Health Score Calculation ---
            const totalValue = quantities.reduce((acc, q, i) => acc + (q * prices[i]), 0);

            // 1. Diversification
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

            // 2. Volatility
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

            // 3. Sentiment
            let totalBuyRatio = 0;
            let sentimentCount = 0;
            symbols.forEach((_, i) => {
                const isETF = profilesResults[i]?.finnhubIndustry === 'Exchange Traded Fund';
                if (isETF) return; // Skip ETFs for sentiment
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

            // --- D. Benchmark (TWR) ---
            const benchmarkData = [];
            // Optimize lookup
            const symbolCloseLookup = symbolCharts.map(chart => {
                const map = {};
                if (chart && chart.dates) {
                    chart.dates.forEach((d, i) => map[d] = chart.closes[i]);
                }
                return map;
            });

            // Pre-sort events just in case
            lotEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

            const allDates = spyChart?.dates || [];
            if (allDates.length > 0) {
                let prevPortfolioValue = 0;
                let cumulativeTWR = 0;
                let spCumReturn = 0;
                let prevSpyClose = spyChart.closes[0];

                const currentQty = {};
                symbols.forEach(s => currentQty[s] = 0);

                // Keep track of last known prices (Forward Fill)
                const lastKnownPrices = {};

                let lotIndex = 0;

                for (let i = 0; i < allDates.length; i++) {
                    const date = allDates[i];
                    const spyClose = spyChart.closes[i];

                    // Process inflows for this date
                    let dailyInflowValue = 0;
                    while (lotIndex < lotEvents.length && lotEvents[lotIndex].date <= date) {
                        const inf = lotEvents[lotIndex];
                        currentQty[inf.symbol] = (currentQty[inf.symbol] || 0) + inf.quantity;
                        dailyInflowValue += (inf.quantity * inf.price);
                        lotIndex++;
                    }

                    // Value at end of day
                    let currentMarketValue = 0;

                    symbols.forEach((s, idx) => {
                        const qty = currentQty[s];
                        if (qty > 0) {
                            let price = symbolCloseLookup[idx][date];

                            // Forward Fill Logic
                            if (price !== undefined && price !== null) {
                                lastKnownPrices[s] = price;
                            } else {
                                price = lastKnownPrices[s] || 0; // Use last known, or 0 if never seen
                            }

                            if (price > 0) {
                                currentMarketValue += qty * price;
                            }
                        }
                    });

                    // Update TWR 
                    // Formula: Rt = (Vt - (Vt-1 + Inflow)) / (Vt-1 + Inflow) = Vt / (Vt-1 + Inflow) - 1

                    const startValue = prevPortfolioValue;
                    const denominator = startValue + dailyInflowValue;

                    if (denominator > 0) {
                        const dailyRet = (currentMarketValue / denominator) - 1;
                        cumulativeTWR = ((1 + cumulativeTWR) * (1 + dailyRet)) - 1;
                    }
                    // Special case: First day of investment (implicitly handled above if startValue=0, denom=inflow)
                    // But if denominator is 0 (no value, no inflow), TWR doesn't change.

                    // SPY Return
                    // Normalize SPY: Calculate return relative to SPY price ON INCEPTION DATE?
                    // The loop calculates cumulative return from the START of the fetch period.
                    // The user wants SPY normalized to 0% at Inception.
                    // We will handle this by filtering the output array. The accumulated value will be "correct" 
                    // relative to the start of the series.
                    // Ideally, we should reset SPY return at Inception Date.

                    if (prevSpyClose > 0 && spyClose > 0) {
                        const spRet = (spyClose - prevSpyClose) / prevSpyClose;
                        spCumReturn = ((1 + spCumReturn) * (1 + spRet)) - 1;
                    }

                    // Store data point (we will filter later)
                    benchmarkData.push({
                        date,
                        portfolio: parseFloat((cumulativeTWR * 100).toFixed(2)),
                        spy: parseFloat((spCumReturn * 100).toFixed(2))
                    });

                    prevPortfolioValue = currentMarketValue;
                    prevSpyClose = spyClose;
                }
            }

            // --- FILTER: Remove dates before Inception ---
            // This eliminates the 0-value lead-up and ensures the graph starts exactly when the user started investing.
            // Also Re-Normalize SPY to 0% at the start of the filtered series.
            const filteredBenchmarkData = benchmarkData.filter(d => d.date >= inceptionDateStr);

            // Normalize SPY to 0% at start of filtered series
            if (filteredBenchmarkData.length > 0) {
                const baseSpy = filteredBenchmarkData[0].spy;
                const basePortfolio = filteredBenchmarkData[0].portfolio; // Should be ~0 unless intraday gain

                for (let i = 0; i < filteredBenchmarkData.length; i++) {
                    filteredBenchmarkData[i].spy = Number((filteredBenchmarkData[i].spy - baseSpy).toFixed(2));
                    // Optional: Normalize Portfolio to exactly 0 at start? 
                    // If intraday gain existed, it should be shown? 
                    // User said: "On the date of the first purchase, the Portfolio Return MUST be exactly 0%".
                    // So we subtract the base.
                    filteredBenchmarkData[i].portfolio = Number((filteredBenchmarkData[i].portfolio - basePortfolio).toFixed(2));
                }
            }

            // --- E. Dividends & Correlation ---
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
                const isUpcoming = exDate >= now && exDate <= sixtyDaysFromNow;
                const isCurrentMonth = exDate.getMonth() === currentMonth && exDate.getFullYear() === currentYear;

                if (!isUpcoming && !isCurrentMonth) return;

                // Calculate quarterly amount (Annual Rate / 4)
                // USER REQUEST: Explicitly divide annual rate by 4 for quarterly payers like MSFT
                const quarterlyAmount = (info.dividendRate || 0) / 4;
                dividends.push({
                    symbol: sym,
                    exDate: info.exDate,
                    paymentDate: info.paymentDate || null,
                    amount: quarterlyAmount,
                    estimatedPayout: quarterlyAmount * quantities[i], // Exact payout based on qty
                });
            });
            dividends.sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime());

            // Correlation Matrix
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

            const dailyReturns = symbolCharts.map((chart) => {
                if (!chart || !chart.closes || chart.closes.length < 2) return [];
                const closes = chart.closes;
                const recent = closes.slice(-30);
                const returns = [];
                for (let j = 1; j < recent.length; j++) {
                    if (recent[j - 1] > 0) returns.push((recent[j] - recent[j - 1]) / recent[j - 1]);
                }
                return returns;
            });

            const correlationMatrix = {
                symbols: symbols.slice(),
                matrix: symbols.map((_, i) =>
                    symbols.map((_, j) => (i === j ? 1 : pearson(dailyReturns[i], dailyReturns[j])))
                )
            };

            return {
                healthScore,
                components: {
                    diversification: Math.round(diversificationScore),
                    volatility: Math.round(volatilityScore),
                    sentiment: Math.round(sentimentScore)
                },
                portfolioBeta: Number(portfolioBeta.toFixed(2)),
                maxSectorPct: Number(maxSectorPct.toFixed(1)),
                benchmarkData: filteredBenchmarkData,
                dividends,
                correlationMatrix,
                lastUpdated: new Date().toISOString()
            };

        } catch (error) {
            console.error('ג Œ Error in getPortfolioHealthAndBenchmark:', error);
            // Return safe fallback instead of 500
            // DO NOT CACHE FALLBACK ERRORS
            return {
                healthScore: 0,
                components: { diversification: 0, volatility: 0, sentiment: 0 },
                portfolioBeta: 0,
                maxSectorPct: 0,
                benchmarkData: [],
                dividends: [],
                correlationMatrix: { symbols: [], matrix: [] },
                error: error.message
            };
        }
    });
}
