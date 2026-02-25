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
 * Currently returns a mock value. Once the TASE API key is registered, 
 * this function should be updated to make the actual API call.
 */
export async function fetchFundNAV(fundId) {
    // TODO: Replace with official TASE Data Hub API call once registered
    // Endpoint: https://openapi.tase.co.il/content/mutual-funds/comprehensive

    console.warn(`[IsraeliSecurities] Using mock NAV for fund ${fundId}. Please integrate TASE API key.`);

    return {
        price: 100.0, // Mock NAV price
        change: 0.05,
        changePercent: 0.05,
        timestamp: Math.floor(Date.now() / 1000)
    };
}
