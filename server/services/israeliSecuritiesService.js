import fetch from 'node-fetch';
import mongoose from 'mongoose';
import { israeliCatalog } from '../data/israeliCatalog.js';
import { makeProxyRequest } from '../utils/proxyUtils.js';
import CachedPrice from '../models/CachedPrice.js';

/**
 * Fetch daily fund price directly from Funder (free, public, real-time daily NAV)
 */
export async function fetchFundFromFunder(fundId) {
    try {
        const cleanId = String(fundId).replace(/\D/g, '');
        if (!cleanId) return null;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(`https://www.funder.co.il/fund/${cleanId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) {
            console.warn(`[Funder] Response status ${res.status} for fund ${cleanId}`);
            return null;
        }

        const html = await res.text();
        const match = html.match(/var fundData = (\{[\s\S]*?\});/);
        if (!match) {
            return null;
        }

        const data = JSON.parse(match[1]);
        const f = data.x?.[0];
        if (!f) return null;

        const priceILS = Number(f.buyPrice || f.sellPrice || 0);
        if (priceILS <= 0) return null;

        const changePercent = Number(f['1day'] || 0);
        const name = f.fundName || f.fundLongName || `קרן ${cleanId}`;

        return {
            fundId: cleanId,
            priceILS,
            changePercent,
            name,
            source: 'funder'
        };
    } catch (err) {
        console.warn(`[Funder] Error fetching fund ${fundId}:`, err.message);
        return null;
    }
}

/**
 * Perform a simple fuzzy search on Hebrew/English names in the catalog
 */
export function searchIsraeliSecurities(query) {
    const data = israeliCatalog;

    if (!query) return [];

    const lowerQuery = query.toLowerCase().trim();

    // Check if user is searching for an exact fund ID directly
    let directMatch = data.filter(item => {
        const symbol = String(item.symbol || '').toLowerCase().trim();
        const fundId = String(item.fundId || '').toLowerCase().trim();
        const alias = String(item.alias || '').toLowerCase().trim();
        return symbol === lowerQuery || fundId === lowerQuery || alias === lowerQuery;
    });

    let results = [];
    if (directMatch.length > 0) {
        results = directMatch;
    } else if (/^\d{6,8}$/.test(lowerQuery)) {
        // Dynamic match for any 6-8 digit Israeli fund ID even if not yet in catalog
        results = [{
            symbol: `FUND:${lowerQuery}`,
            fundId: lowerQuery,
            hebrewName: `קרן נאמנות ${lowerQuery}`,
            englishName: `Mutual Fund ${lowerQuery}`,
            type: 'fund',
            exchange: 'TASE'
        }];
    } else {
        const queryWords = lowerQuery.replace(/["'״׳]/g, '').split(/\s+/);

        results = data.filter(item => {
            const hName = String(item.hebrewName || '').toLowerCase().replace(/["'״׳]/g, '');
            const eName = String(item.englishName || '').toLowerCase();
            const symbol = String(item.symbol || '').toLowerCase();
            const fundId = String(item.fundId || '').toLowerCase();
            const alias = String(item.alias || '').toLowerCase();

            return queryWords.every(word =>
                hName.includes(word) ||
                eName.includes(word) ||
                symbol.includes(word) ||
                fundId.includes(word) ||
                alias.includes(word)
            );
        });
    }

    console.log(`[DEBUG] Query "${lowerQuery}" found ${results.length} matches locally.`);

    return results.slice(0, 25).map(item => ({
        description: `${item.hebrewName} | ${item.englishName}`,
        displaySymbol: item.symbol,
        symbol: item.symbol,
        type: item.type === 'fund' ? 'MUTUAL FUND' : item.type === 'index' ? 'INDEX' : 'Common Stock',
        israeliData: item
    }));
}

// ============================================
// CACHE-FIRST ARCHITECTURE
// ============================================

/**
 * Fetch fund NAV from the DATABASE CACHE, with auto-fetch from Funder if missing/stale.
 * Guaranteed to return updated daily price without blocking proxy locks.
 */
export async function fetchFundNAV(fundId) {
    const cleanId = String(fundId).replace(/\D/g, '');
    let cached = null;

    // Check DB cache only if Mongoose is connected
    try {
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            cached = await CachedPrice.findOne({ fundId: cleanId });

            if (cached && cached.priceILS > 0) {
                const ageHours = (Date.now() - cached.updatedAt.getTime()) / (1000 * 60 * 60);

                // Fresh cache (< 24 hours): return immediately
                if (ageHours < 24) {
                    console.log(`[IsraeliCache] Fund ${cleanId}: priceILS=${cached.priceILS}, age=${ageHours.toFixed(1)}h (from cache)`);
                    return {
                        price: cached.priceILS,
                        change: 0,
                        changePercent: cached.changePercent || 0,
                        currency: 'ILS',
                        name: cached.name,
                        timestamp: Math.floor(cached.updatedAt.getTime() / 1000),
                        fromCache: true,
                        ageHours: Math.round(ageHours * 10) / 10
                    };
                }
            }
        }
    } catch (dbErr) {
        console.warn(`[IsraeliCache] DB read skipped for ${cleanId}:`, dbErr.message);
    }

    // Cache missing, stale, or DB not connected -> fetch latest daily price from Funder!
    try {
        console.log(`[FundNAV] Fetching fresh daily price for fund ${cleanId} from Funder...`);
        const funderData = await fetchFundFromFunder(cleanId);
        if (funderData && funderData.priceILS > 0) {
            // Attempt to update cache asynchronously if DB is connected
            try {
                if (mongoose.connection && mongoose.connection.readyState === 1) {
                    await setCachedPrice(cleanId, funderData.priceILS, 3.65, {
                        changePercent: funderData.changePercent,
                        name: funderData.name,
                        source: 'funder'
                    });
                }
            } catch (saveErr) {
                console.warn(`[IsraeliCache] Could not save cache for ${cleanId}:`, saveErr.message);
            }

            return {
                price: funderData.priceILS,
                change: 0,
                changePercent: funderData.changePercent,
                currency: 'ILS',
                name: funderData.name,
                timestamp: Math.floor(Date.now() / 1000),
                fromCache: false,
                ageHours: 0
            };
        }
    } catch (funderErr) {
        console.warn(`[FundNAV] Funder fetch failed for ${cleanId}:`, funderErr.message);
    }

    // Fallback to older cache if Funder fetch failed
    if (cached && cached.priceILS > 0) {
        return {
            price: cached.priceILS,
            change: 0,
            changePercent: cached.changePercent || 0,
            currency: 'ILS',
            name: cached.name,
            timestamp: Math.floor(cached.updatedAt.getTime() / 1000),
            fromCache: true,
            ageHours: Math.round((Date.now() - cached.updatedAt.getTime()) / (1000 * 60 * 60))
        };
    }

    return {
        price: 0,
        change: 0,
        changePercent: 0,
        currency: 'ILS',
        timestamp: Math.floor(Date.now() / 1000),
        error: `No cached price available for fund ${cleanId}.`
    };
}

/**
 * Manually set/update the cached price for an Israeli fund.
 * Called by the admin refresh endpoint or can be used for manual price entry.
 * 
 * @param {string} fundId - The TASE fund ID (e.g. '5131425')
 * @param {number} priceILS - Price in ILS (e.g. 112.00)
 * @param {number} exchangeRate - ILS/USD rate (e.g. 3.65)
 * @param {object} [extra] - Optional: { changePercent, name, source }
 */
export async function setCachedPrice(fundId, priceILS, exchangeRate, extra = {}) {
    const priceUSD = priceILS / exchangeRate;

    const update = {
        fundId,
        symbol: `FUND:${fundId}`,
        priceILS,
        priceUSD,
        exchangeRate,
        changePercent: extra.changePercent || 0,
        name: extra.name || '',
        source: extra.source || 'manual',
        updatedAt: new Date()
    };

    if (mongoose.connection && mongoose.connection.readyState === 1) {
        await CachedPrice.findOneAndUpdate(
            { fundId },
            update,
            { upsert: true, new: true }
        );
        console.log(`[IsraeliCache] Updated fund ${fundId}: ILS=${priceILS}, USD=${priceUSD.toFixed(4)}, rate=${exchangeRate}`);
    }

    return update;
}

/**
 * Refresh fund price using the TASE proxy (slow, background use only).
 * This function makes 2 sequential ScrapingAnt calls (token + data).
 * It should ONLY be called from the manual refresh endpoint, never from the dashboard.
 */
export async function refreshFundPriceViaProxy(fundId, exchangeRate = 3.65) {
    // 1. Try fast, reliable Funder fetch first (no proxy or credentials required)
    try {
        const funderData = await fetchFundFromFunder(fundId);
        if (funderData && funderData.priceILS > 0) {
            await setCachedPrice(fundId, funderData.priceILS, exchangeRate, {
                changePercent: funderData.changePercent,
                name: funderData.name,
                source: 'funder'
            });
            return {
                fundId,
                priceILS: funderData.priceILS,
                priceUSD: funderData.priceILS / exchangeRate,
                changePercent: funderData.changePercent,
                source: 'funder'
            };
        }
    } catch (funderErr) {
        console.warn(`[Refresh] Funder fetch failed for ${fundId}, falling back to TASE proxy:`, funderErr.message);
    }

    const clientId = process.env.TASE_CLIENT_ID;
    const clientSecret = process.env.TASE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('TASE credentials not configured and Funder fallback was unavailable');
    }

    // Step 1: Get OAuth token
    const tokenUrl = process.env.TASE_TOKEN_URL || 'https://openapigw.tase.co.il/tase/prod/oauth2/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'tase');

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenHeaders = {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
        'Cache-Control': 'no-cache',
        'Origin': 'https://openapi.tase.co.il',
        'Referer': 'https://openapi.tase.co.il/'
    };

    console.log(`[TASE Refresh] Step 1: Fetching OAuth token...`);
    const tokenRes = await makeProxyRequest(tokenUrl, 'POST', tokenHeaders, params.toString());

    if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Token fetch failed: ${tokenRes.status} - ${errText}`);
    }

    let tokenData = await tokenRes.json();
    if (tokenData.content && typeof tokenData.content === 'string') {
        try { tokenData = JSON.parse(tokenData.content); } catch (e) { }
    }

    const token = tokenData.access_token;
    console.log(`[TASE Refresh] Token acquired. Waiting 1.5s before data fetch...`);

    // Step 2: Wait for ScrapingAnt slot to free
    await new Promise(r => setTimeout(r, 1500));

    // Step 3: Fetch fund data
    const url = `https://openapi.tase.co.il/api/mutual-fund/history?fundId=${fundId}`;
    const dataHeaders = {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
        'Cache-Control': 'no-cache',
        'Origin': 'https://openapi.tase.co.il',
        'Referer': 'https://openapi.tase.co.il/'
    };

    console.log(`[TASE Refresh] Step 3: Fetching fund data for ${fundId}...`);
    const dataRes = await makeProxyRequest(url, 'GET', dataHeaders);

    if (!dataRes.ok) {
        const errText = await dataRes.text();
        throw new Error(`Data fetch failed: ${dataRes.status} - ${errText}`);
    }

    let parsedData = await dataRes.json();
    if (parsedData.content && typeof parsedData.content === 'string') {
        try { parsedData = JSON.parse(parsedData.content); } catch (e) { }
    }

    // Parse the NAV from the response
    let list = parsedData;
    if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
        if (Array.isArray(parsedData.history)) list = parsedData.history;
        else if (Array.isArray(parsedData.results)) list = parsedData.results;
        else if (Array.isArray(parsedData.data)) list = parsedData.data;
    }

    let priceAgorot = 0;
    let changePercent = 0;

    if (Array.isArray(list) && list.length > 0) {
        const latest = list[0];
        priceAgorot = latest.nav || latest.closingPrice || latest.lastPrice || 0;
        changePercent = latest.yield || latest.changePercent || 0;
    } else if (parsedData && typeof parsedData === 'object') {
        priceAgorot = parsedData.nav || parsedData.closingPrice || parsedData.lastPrice || 0;
        changePercent = parsedData.yield || parsedData.changePercent || 0;
    }

    // Formula: Price_ILS = Price_Agorot / 100
    const priceILS = priceAgorot / 100;
    console.log(`[TASE Refresh] Fund ${fundId}: priceAgorot=${priceAgorot}, priceILS=${priceILS}`);

    if (priceILS > 0) {
        // Save to DB cache
        await setCachedPrice(fundId, priceILS, exchangeRate, {
            changePercent,
            source: 'tase_proxy'
        });
    }

    return { fundId, priceAgorot, priceILS, priceUSD: priceILS / exchangeRate, changePercent };
}

/**
 * Get all cached Israeli fund prices from the database.
 */
export async function getAllCachedPrices() {
    return CachedPrice.find({}).lean();
}
