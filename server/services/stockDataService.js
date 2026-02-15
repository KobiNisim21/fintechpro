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
        const apiKey = getApiKey();
        if (!apiKey) throw new Error('FINNHUB_API_KEY not configured');

        const url = `${FINNHUB_BASE_URL}/stock/price-target?symbol=${symbol}&token=${apiKey}`;
        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();
            return data;
        }

        // Fallback to Yahoo Finance if Finnhub fails (e.g. Premium required)
        console.log(`[INFO] Falling back to Yahoo Finance for ${symbol} price target`);
        try {
            const yahooUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData`;
            const yahooResp = await fetch(yahooUrl);
            const yahooData = await yahooResp.json();

            const financials = yahooData?.quoteSummary?.result?.[0]?.financialData;
            if (financials) {
                // Map Yahoo data to Finnhub structure for frontend compatibility
                return {
                    targetHigh: financials.targetHighPrice?.raw || 0,
                    targetLow: financials.targetLowPrice?.raw || 0,
                    targetMean: financials.targetMeanPrice?.raw || 0,
                    targetMedian: financials.targetMedianPrice?.raw || 0,
                    lastUpdated: new Date().toISOString()
                };
            }
        } catch (yError) {
            console.error(`Yahoo Finance fallback failed for ${symbol}`, yError);
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
