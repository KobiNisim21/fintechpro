import { israeliCatalog } from '../data/israeliCatalog.js';
import { makeProxyRequest } from '../utils/proxyUtils.js';

/**
 * Perform a simple fuzzy search on Hebrew/English names in the catalog
 */
export function searchIsraeliSecurities(query) {
    const data = israeliCatalog;
    console.log("[DEBUG] Catalog Size:", data.length);

    if (!query) return [];

    const lowerQuery = query.toLowerCase().trim();

    // Check if user is searching for an exact fund ID directly
    const directMatch = data.filter(item => {
        const symbol = String(item.symbol || '').toLowerCase().trim();
        const fundId = String(item.fundId || '').toLowerCase().trim();
        const safeQuery = String(query).toLowerCase().trim();
        return symbol === safeQuery || fundId === safeQuery;
    });

    let results = [];
    if (directMatch.length > 0 && /^\d+$/.test(lowerQuery)) {
        // Numeric ID search is prioritized
        results = directMatch;
    } else {
        // Split the query into words for better matching
        const queryWords = lowerQuery.split(/\s+/);

        results = data.filter(item => {
            const hName = String(item.hebrewName || '').toLowerCase();
            const eName = String(item.englishName || '').toLowerCase();
            const symbol = String(item.symbol || '').toLowerCase();
            const fundId = String(item.fundId || '').toLowerCase();

            // Check if all words in the query exist somewhere
            return queryWords.every(word =>
                hName.includes(word) ||
                eName.includes(word) ||
                symbol.includes(word) ||
                fundId.includes(word)
            );
        });
    }

    console.log(`[DEBUG] Query "${lowerQuery}" found ${results.length} matches locally.`);

    // Format results to match Finnhub API structure so the frontend consumes it transparently
    // Increased slice limit from 10 to 25 to show more results for common queries
    return results.slice(0, 25).map(item => ({
        description: `${item.hebrewName} | ${item.englishName}`,
        displaySymbol: item.symbol,
        symbol: item.symbol,
        type: item.type === 'fund' ? 'MUTUAL FUND' : 'Common Stock',
        israeliData: item // Pass full item down for the frontend to show badges if needed
    }));
}

/**
 * Fetch the latest Daily NAV (Net Asset Value / שע"נ) for an Israeli mutual fund.
 * Uses the official TASE Data Hub API securely on the server-side.
 */
let taseAccessToken = null;
let taseTokenExpiresAt = 0;
let taseCookies = '';

/**
 * Fetch OAuth2 Access Token for TASE Data Hub API
 */
async function getTaseAccessToken() {
    const clientId = process.env.TASE_CLIENT_ID;
    const clientSecret = process.env.TASE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('TASE_CLIENT_ID or TASE_CLIENT_SECRET not configured');
    }

    if (taseAccessToken && Date.now() < taseTokenExpiresAt - 60000) {
        return taseAccessToken;
    }

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

    let response = await makeProxyRequest(tokenUrl, 'POST', tokenHeaders, params.toString(), { useBrowser: false });

    // If blocked without browser, retry with browser=true
    if (response.status === 423 || response.status === 403) {
        console.warn(`[TASE API] Token blocked (${response.status}) without browser. Retrying WITH browser...`);
        response = await makeProxyRequest(tokenUrl, 'POST', tokenHeaders, params.toString(), { useBrowser: true });
    }

    // Capture Cookies
    const rawCookies = response.headers.get('set-cookie');
    if (rawCookies) {
        taseCookies = rawCookies.split(',').map(c => c.split(';')[0]).join('; ');
    }

    if (!response.ok) {
        const errText = await response.text();
        const errMsg = `Failed to fetch TASE access token: ${response.status} - ${errText}`;
        console.error(`[TASE API] Auth Failed: ${errMsg}`);
        throw new Error(errMsg);
    }

    const data = await response.json();
    taseAccessToken = data.access_token;
    taseTokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 1000);

    console.log('[TASE API] Auth Success: Token received');
    return taseAccessToken;
}

export async function fetchFundNAV(fundId) {
    const clientId = process.env.TASE_CLIENT_ID;
    const clientSecret = process.env.TASE_CLIENT_SECRET;

    // Fallback to mock if API key isn't provided yet
    if (!clientId || !clientSecret) {
        console.warn(`[IsraeliSecurities] TASE_CLIENT_ID or TASE_CLIENT_SECRET not configured. Using mock NAV for ${fundId}.`);
        return {
            price: 100.0,
            change: 0.0,
            changePercent: 0.0,
            timestamp: Math.floor(Date.now() / 1000)
        };
    }

    try {
        const token = await getTaseAccessToken();

        const url = `https://openapi.tase.co.il/api/mutual-fund/history?fundId=${fundId}`;
        const taseHeaders = {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
            'Cache-Control': 'no-cache',
            'Origin': 'https://openapi.tase.co.il',
            'Referer': 'https://openapi.tase.co.il/',
            ...(taseCookies ? { 'Cookie': taseCookies } : {})
        };

        let response = await makeProxyRequest(url, 'GET', taseHeaders, null, { useBrowser: true });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[TASE API EXACT ERROR] Status: ${response.status}, Response: ${errText}`);
            throw new Error(`TASE API returned ${response.status} - ${errText}`);
        }

        let parsedData;
        try {
            const textResponse = await response.text();
            parsedData = JSON.parse(textResponse);
            // sometimes scraping proxy returns {"content": "..."} as a string
            if (parsedData && parsedData.content && typeof parsedData.content === 'string') {
                try { parsedData = JSON.parse(parsedData.content); } catch (e) { }
            }
        } catch (err) {
            console.error('[TASE API] Failed to parse response as JSON');
            throw err;
        }

        // Typical TASE API returns an array or an object with latest NAV
        // Often wraps arrays inside a 'results' or 'history' object
        let list = parsedData;
        if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
            if (Array.isArray(parsedData.history)) list = parsedData.history;
            else if (Array.isArray(parsedData.results)) list = parsedData.results;
            else if (Array.isArray(parsedData.data)) list = parsedData.data;
        }

        // Israeli funds are priced in Agorot (אגורות) — so we must divide by 100 for ILS
        let priceAgorot = 0;
        let changePercent = 0;
        let changeAgorot = 0;

        if (Array.isArray(list) && list.length > 0) {
            const latest = list[0]; // Assuming sorted descending
            priceAgorot = latest.nav || latest.closingPrice || latest.lastPrice || 0;
            changePercent = latest.yield || latest.changePercent || 0;
        } else if (parsedData && typeof parsedData === 'object') {
            priceAgorot = parsedData.nav || parsedData.closingPrice || parsedData.lastPrice || 0;
            changePercent = parsedData.yield || parsedData.changePercent || 0;
        }

        const divisor = 1 + (changePercent / 100);
        changeAgorot = divisor === 0 ? priceAgorot : priceAgorot - (priceAgorot / divisor);

        if (priceAgorot === 0) {
            console.error(`[TASE API FALLBACK] Price parsed as 0 for ${fundId}. Exact API Response JSON:`, JSON.stringify(parsedData));
        }

        const priceILS = priceAgorot / 100;
        const changeILS = changeAgorot / 100;

        return {
            price: priceILS,
            change: changeILS,
            changePercent: changePercent,
            currency: 'ILS', // We explicitly return ILS so the caller can convert to USD if needed
            timestamp: Math.floor(Date.now() / 1000)
        };

    } catch (error) {
        console.error(`[IsraeliSecurities] Failed to fetch TASE NAV for ${fundId}:`, error.message);
        // Fallback or rethrow
        throw error;
    }
}
