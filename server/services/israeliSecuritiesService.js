import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the local catalog lazily
let catalog = null;

function loadCatalog() {
    if (!catalog) {
        try {
            const catalogPath = path.join(__dirname, '../data/israeli_securities_catalog.json');
            const data = fs.readFileSync(catalogPath, 'utf8');
            catalog = JSON.parse(data);
        } catch (error) {
            console.error('[IsraeliSecurities] Failed to load catalog:', error);
            catalog = [];
        }
    }
    return catalog;
}

/**
 * Perform a simple fuzzy search on Hebrew/English names in the catalog
 */
export function searchIsraeliSecurities(query) {
    const data = loadCatalog();
    if (!query) return [];

    const lowerQuery = query.toLowerCase().trim();

    // Split the query into words for better matching
    const queryWords = lowerQuery.split(/\s+/);

    const results = data.filter(item => {
        const hName = (item.hebrewName || '').toLowerCase();
        const eName = (item.englishName || '').toLowerCase();
        const symbol = (item.symbol || '').toLowerCase();
        const fundId = (item.fundId || '').toLowerCase();

        // Check if all words in the query exist somewhere in the name or symbol
        return queryWords.every(word =>
            hName.includes(word) ||
            eName.includes(word) ||
            symbol.includes(word) ||
            fundId.includes(word)
        );
    });

    // Format results to match Finnhub API structure so the frontend consumes it transparently
    return results.slice(0, 10).map(item => ({
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
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to fetch TASE access token: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    taseAccessToken = data.access_token;
    taseTokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 1000);
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

        // TASE Data Hub format for comprehensive mutual fund data
        const url = `https://openapi.tase.co.il/api/mutual-fund/history?fundId=${fundId}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (!response.ok) {
            throw new Error(`TASE API returned ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Typical TASE API returns an array or an object with latest NAV
        // Israeli funds are priced in Agorot (אגורות) — so we must divide by 100 for ILS
        let priceAgorot = 0;
        let changePercent = 0;
        let changeAgorot = 0;

        if (Array.isArray(data) && data.length > 0) {
            const latest = data[0]; // Assuming sorted descending
            priceAgorot = latest.nav || latest.closingPrice || 10000;
            changePercent = latest.yield || latest.changePercent || 0;
            // Approximate absolute change
            changeAgorot = priceAgorot - (priceAgorot / (1 + (changePercent / 100)));
        } else if (data && typeof data === 'object') {
            priceAgorot = data.nav || data.closingPrice || data.lastPrice || 10000;
            changePercent = data.yield || data.changePercent || 0;
            changeAgorot = priceAgorot - (priceAgorot / (1 + (changePercent / 100)));
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
