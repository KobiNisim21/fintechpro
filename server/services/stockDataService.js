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
        console.error('❌ CRITICAL: FINNHUB_API_KEY is not set!');
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
            console.log(`🇮🇱 Fetching TASE quote for ${symbol} from Yahoo Finance...`);
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
                console.error(`❌ Yahoo/TASE error for ${symbol}:`, error.message);
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
        console.log(`✅ Batch extended quotes: all ${symbols.length} from cache`);
        return results;
    }

    // Batch fetch uncached symbols from Yahoo Finance
    const batchKey = `batch_extended_${uncachedSymbols.sort().join(',')}`;

    try {
        const batchResults = await dedupedFetch(batchKey, async () => {
            console.log(`📊 Batch fetching ${uncachedSymbols.length} extended quotes from Yahoo Finance: ${uncachedSymbols.join(', ')}`);

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

            console.log(`✅ Batch extended quotes: ${Object.keys(batchData).length} fetched, ${symbols.length - uncachedSymbols.length} from cache`);
            return batchData;
        });

        return { ...results, ...batchResults };
    } catch (error) {
        console.error(`❌ Batch extended quote error:`, error.message);
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
        console.log('📡 Fetching USD/ILS rate from Yahoo Finance (ILS=X)...');

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

            console.log(`✅ USD/ILS exchange rate: ${rate}`);
            setCache(cacheKey, result);
            return result;
        } catch (error) {
            console.error('❌ Forex fetch failed:', error.message);

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
 * Fetch Yahoo Finance chart data for a symbol (1Y daily).
 * Returns { dates: string[], closes: number[] }
 */
async function fetchYahooChart(symbol) {
    const cacheKey = `chart_1y_${symbol}`;
    const cached = getCached(cacheKey, 60 * 60 * 1000); // 1 hour
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        const now = Math.floor(Date.now() / 1000);
        const oneYearAgo = now - 365 * 24 * 60 * 60;

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${oneYearAgo}&period2=${now}&interval=1d&includePrePost=false`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Yahoo chart failed for ${symbol}: ${response.status}`);
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
    });
}

/**
 * Get Portfolio Health Score and Benchmark data.
 * All data fetched in parallel. Result cached 1 hour.
 *
 * @param {string[]} symbols - tickers
 * @param {number[]} quantities - share count per ticker
 * @param {number[]} prices - current price per ticker
 */
export async function getPortfolioHealthAndBenchmark(symbols, quantities, prices) {
    // Build a stable cache key from sorted symbols
    const sortedKey = symbols.slice().sort().join(',');
    const cacheKey = `analytics_${sortedKey}`;
    const cached = getCached(cacheKey, 60 * 60 * 1000);
    if (cached) return cached;

    return dedupedFetch(cacheKey, async () => {
        const totalValue = symbols.reduce((sum, _, i) => sum + prices[i] * quantities[i], 0);

        // ── Parallel fetch: metrics, profiles, recs, SPY chart, per-symbol charts ──
        const [metricsResults, profilesResults, recsResults, spyChart, ...symbolCharts] =
            await Promise.all([
                // Beta / financials for each symbol
                Promise.all(symbols.map(s => getBasicFinancials(s).catch(() => null))),
                // Company profiles (for sector)
                Promise.all(symbols.map(s => getCompanyProfile(s).catch(() => null))),
                // Analyst recommendations
                Promise.all(symbols.map(s => getAnalystRecommendations(s).catch(() => []))),
                // SPY benchmark
                fetchYahooChart('SPY'),
                // Each symbol's 1Y chart
                ...symbols.map(s => fetchYahooChart(s).catch(() => ({ dates: [], closes: [] })))
            ]);

        // ────────────────────────────────────────────────────
        // 1. DIVERSIFICATION SCORE (40%)
        // ────────────────────────────────────────────────────
        const sectorWeights = {};
        symbols.forEach((sym, i) => {
            const value = prices[i] * quantities[i];
            const sector = profilesResults[i]?.finnhubIndustry || 'Other';
            sectorWeights[sector] = (sectorWeights[sector] || 0) + value;
        });

        let maxSectorPct = 0;
        Object.values(sectorWeights).forEach(v => {
            const pct = totalValue > 0 ? (v / totalValue) * 100 : 0;
            if (pct > maxSectorPct) maxSectorPct = pct;
        });

        // Score: 100 if max sector <= 20%, down to 0 if one sector = 100%
        let diversificationScore = 100;
        if (maxSectorPct > 30) {
            diversificationScore = Math.max(0, 100 - (maxSectorPct - 30) * (100 / 70));
        } else if (maxSectorPct > 20) {
            diversificationScore = 100 - (maxSectorPct - 20) * 1; // mild penalty
        }

        // ────────────────────────────────────────────────────
        // 2. VOLATILITY / BETA SCORE (30%)
        // ────────────────────────────────────────────────────
        let weightedBeta = 0;
        let betaWeightSum = 0;
        symbols.forEach((sym, i) => {
            const beta = metricsResults[i]?.metric?.beta;
            if (beta && beta > 0) {
                const w = prices[i] * quantities[i];
                weightedBeta += beta * w;
                betaWeightSum += w;
            }
        });
        const portfolioBeta = betaWeightSum > 0 ? weightedBeta / betaWeightSum : 1.0;

        let volatilityScore = 100;
        if (portfolioBeta > 2.0) {
            volatilityScore = 10;
        } else if (portfolioBeta > 1.5) {
            volatilityScore = 10 + (2.0 - portfolioBeta) * 180; // 10–100 range
        } else if (portfolioBeta > 1.0) {
            volatilityScore = 70 + (1.5 - portfolioBeta) * 60; // 70–100
        }
        volatilityScore = Math.min(100, Math.max(0, volatilityScore));

        // ────────────────────────────────────────────────────
        // 3. ANALYST SENTIMENT SCORE (30%)
        // ────────────────────────────────────────────────────
        let totalBuyRatio = 0;
        let sentimentCount = 0;

        symbols.forEach((sym, i) => {
            // Skip ETFs
            if (ETF_SYMBOLS.has(sym.toUpperCase())) return;

            const recs = recsResults[i];
            const latest = recs?.[0];
            if (!latest) return;

            const total = (latest.buy || 0) + (latest.strongBuy || 0) +
                (latest.hold || 0) + (latest.sell || 0) + (latest.strongSell || 0);
            if (total === 0) return;

            const buyRatio = ((latest.buy || 0) + (latest.strongBuy || 0)) / total;
            totalBuyRatio += buyRatio;
            sentimentCount++;
        });

        const avgBuyRatio = sentimentCount > 0 ? totalBuyRatio / sentimentCount : 0.5;
        const sentimentScore = Math.min(100, Math.max(0, avgBuyRatio * 100));

        // ────────────────────────────────────────────────────
        // FINAL HEALTH SCORE
        // ────────────────────────────────────────────────────
        const healthScore = Math.round(
            diversificationScore * 0.4 +
            volatilityScore * 0.3 +
            sentimentScore * 0.3
        );

        // ────────────────────────────────────────────────────
        // BENCHMARK DATA (normalised % return)
        // ────────────────────────────────────────────────────
        // Build a combined portfolio daily value
        // Strategy: find common dates from SPY, then for each date sum portfolio value
        const spyDates = new Set(spyChart.dates);

        // Build per-symbol lookup: date -> close
        const symbolCloseLookup = symbols.map((_, i) => {
            const chart = symbolCharts[i] || { dates: [], closes: [] };
            const lookup = {};
            chart.dates.forEach((d, j) => { lookup[d] = chart.closes[j]; });
            return lookup;
        });

        // Use SPY dates as the canonical timeline
        const benchmarkData = [];
        let portfolioBase = null;
        let spyBase = null;

        for (let di = 0; di < spyChart.dates.length; di++) {
            const date = spyChart.dates[di];
            const spyClose = spyChart.closes[di];

            // Calculate portfolio value on this date
            let portfolioValue = 0;
            let missingSymbols = 0;
            for (let si = 0; si < symbols.length; si++) {
                const close = symbolCloseLookup[si][date];
                if (close !== undefined) {
                    portfolioValue += close * quantities[si];
                } else {
                    missingSymbols++;
                }
            }

            // Skip dates where too many symbols are missing
            if (missingSymbols > symbols.length * 0.3) continue;

            if (portfolioBase === null) {
                portfolioBase = portfolioValue;
                spyBase = spyClose;
            }

            benchmarkData.push({
                date,
                portfolio: portfolioBase > 0
                    ? ((portfolioValue - portfolioBase) / portfolioBase) * 100
                    : 0,
                spy: spyBase > 0
                    ? ((spyClose - spyBase) / spyBase) * 100
                    : 0,
            });
        }

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
        };

        setCache(cacheKey, result);
        return result;
    });
}

