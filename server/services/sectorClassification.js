export const HOLDINGS_URL = 'https://www.ishares.com/us/products/239724/ishares-core-s-p-total-u-s-stock-market-etf/latest-holdings.csv';
const DAY = 86400000;
const groups = {
    Technology: ['Information Technology', 'Semiconductors', 'Software', 'IT Services', 'Electronic Equipment', 'Communications Equipment', 'Technology Hardware', 'Computers', 'Computer Services'],
    'Communication Services': ['Communication', 'Communications', 'Telecommunication', 'Telecommunications', 'Media', 'Entertainment', 'Interactive Media & Services'],
    'Consumer Discretionary': ['Consumer Cyclical', 'Automobiles', 'Auto Components', 'Hotels Restaurants & Leisure', 'Specialty Retail', 'Broadline Retail', 'Internet & Direct Marketing Retail', 'Textiles Apparel & Luxury Goods', 'Household Durables'],
    'Consumer Staples': ['Consumer Defensive', 'Food Products', 'Food & Staples Retailing', 'Beverages', 'Tobacco', 'Household Products', 'Personal Products'],
    Financials: ['Financial Services', 'Financial', 'Banks', 'Insurance', 'Capital Markets', 'Consumer Finance', 'Diversified Financial Services'],
    'Health Care': ['Healthcare', 'Biotechnology', 'Pharmaceuticals', 'Health Care Equipment & Supplies', 'Health Care Providers & Services', 'Life Sciences Tools & Services'],
    Industrials: ['Aerospace & Defense', 'Airlines', 'Machinery', 'Construction & Engineering', 'Electrical Equipment', 'Road & Rail', 'Air Freight & Logistics', 'Professional Services', 'Trading Companies & Distributors'],
    Energy: ['Oil Gas & Consumable Fuels', 'Energy Equipment & Services'],
    Materials: ['Basic Materials', 'Chemicals', 'Metals & Mining', 'Containers & Packaging', 'Construction Materials', 'Paper & Forest Products'],
    Utilities: ['Electric Utilities', 'Gas Utilities', 'Multi-Utilities', 'Water Utilities', 'Independent Power and Renewable Electricity Producers'],
    'Real Estate': ['Equity Real Estate Investment Trusts (REITs)', 'Real Estate Management & Development', 'REITs'],
};
const aliases = new Map(Object.entries(groups).flatMap(([sector, names]) => [sector, ...names].map(name => [name.toLowerCase().replace(/[^a-z0-9]/g, ''), sector])));
export function normalizeSector(value) { return typeof value === 'string' ? aliases.get(value.toLowerCase().replace(/[^a-z0-9]/g, '')) || null : null; }
export function normalizeEquitySymbol(value) { return String(value).trim().toUpperCase().replace(/^([A-Z]{1,5})[ .]([AB])$/, '$1-$2'); }

export function parseCSV(text) {
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
        else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
        else if (char === '\n' && !quoted) { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
        else if (char !== '\r') cell += char;
    }
    if (quoted) throw new Error('Incomplete holdings CSV');
    if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
    return rows;
}

export function parseHoldings(text, now = Date.now()) {
    const rows = parseCSV(text.replace(/^\uFEFF/, ''));
    const date = rows.find(row => row[0] === 'Fund Holdings as of')?.[1];
    const asOfTime = Date.parse(`${date} UTC`);
    if (!Number.isFinite(asOfTime) || now - asOfTime > 90 * DAY || asOfTime > now + DAY) throw new Error('Missing or expired holdings date');
    const headerIndex = rows.findIndex(row => row[0] === 'Ticker' && row.includes('Sector'));
    if (headerIndex < 0) throw new Error('Invalid holdings schema');
    const header = rows[headerIndex], index = name => header.indexOf(name);
    for (const name of ['Name', 'Sector', 'Asset Class', 'Location', 'Exchange', 'Market Currency']) if (index(name) < 0) throw new Error('Incomplete holdings schema');
    const equities = {}, ambiguous = new Set();
    for (const row of rows.slice(headerIndex + 1)) {
        const sector = normalizeSector(row[index('Sector')]), symbol = normalizeEquitySymbol(row[0]);
        if (row[index('Asset Class')] !== 'Equity' || row[index('Market Currency')] !== 'USD' || !['NASDAQ', 'New York Stock Exchange Inc.', 'NYSE', 'Nyse Mkt Llc'].includes(row[index('Exchange')]) || !/^[A-Z][A-Z0-9-]{0,14}$/.test(symbol) || !sector) continue;
        // Ambiguous duplicate symbols are not trusted.
        if (ambiguous.has(symbol)) continue;
        if (equities[symbol] && (equities[symbol][1] !== sector || equities[symbol][0] !== row[index('Name')])) { delete equities[symbol]; ambiguous.add(symbol); continue; }
        equities[symbol] = [row[index('Name')], sector, row[index('Location')], 'USD', row[index('Exchange')]];
    }
    if (Object.keys(equities).length < 500) throw new Error('Incomplete holdings download');
    return { source: 'iShares ITOT holdings', sourceUrl: HOLDINGS_URL, asOf: new Date(asOfTime).toISOString().slice(0, 10), equities };
}

export function createHoldingsReference({ snapshot, download, now = Date.now }) {
    let current = snapshot, nextRefresh = 0, pending;
    const refresh = () => {
        if (!pending && now() >= nextRefresh) {
            nextRefresh = now() + DAY;
            pending = Promise.resolve().then(download).then(text => { current = parseHoldings(text, now()); }).catch(() => { nextRefresh = now() + 5 * 60000; }).finally(() => { pending = null; });
        }
        return pending;
    };
    return async symbol => {
        const usable = current && now() - Date.parse(current.asOf) <= 90 * DAY && Date.parse(current.asOf) <= now();
        // A dated shipped snapshot avoids holding every portfolio behind a download.
        if (usable) { void refresh(); }
        else await refresh();
        if (!current || !Number.isFinite(Date.parse(current.asOf)) || Date.parse(current.asOf) > now() || now() - Date.parse(current.asOf) > 90 * DAY) return null;
        const row = Object.hasOwn(current.equities, normalizeEquitySymbol(symbol)) ? current.equities[normalizeEquitySymbol(symbol)] : null;
        return row ? { name: row[0], sector: row[1], country: row[2], currency: row[3], exchange: row[4], source: current.source, sourceUrl: current.sourceUrl, asOf: current.asOf } : null;
    };
}

export function createProfileResolver({ finnhub, yahoo, reference, fund = async () => null, now = Date.now }) {
    const cache = new Map(), pending = new Map();
    return async function resolve(input) {
        const symbol = normalizeEquitySymbol(input);
        if (!/^[A-Z0-9^][A-Z0-9.^:=-]{0,29}$/.test(symbol)) throw new Error('Invalid profile symbol');
        const cached = cache.get(symbol);
        if (cached && now() - cached.time < (cached.data.sector || cached.data.fundExposure ? DAY : 2 * 60000)) return cached.data;
        if (pending.has(symbol)) return pending.get(symbol);
        const task = (async () => {
            const exposure = await fund(symbol).catch(() => null);
            if (exposure) {
                const data = { ticker: symbol, name: exposure.name, sector: null, country: 'US', currency: 'USD', assetType: 'ETF', fundExposure: exposure, classification: { sector: null, label: exposure.label, source: exposure.source, sourceUrl: exposure.sourceUrl, asOf: exposure.asOf, status: exposure.proxy ? 'proxy' : 'reference' } };
                cache.set(symbol, { time: now(), data });
                return data;
            }
            const referenceTask = Promise.resolve().then(() => reference(symbol));
            const yahooTask = referenceTask.then(ref => ref?.sector || symbol.startsWith('FUND:') ? null : yahoo(symbol));
            const [rawResult, refResult, yahooResult] = await Promise.allSettled([finnhub(symbol), referenceTask, yahooTask]);
            const raw = rawResult.status === 'fulfilled' && rawResult.value && typeof rawResult.value === 'object' ? rawResult.value : {};
            const ref = refResult.status === 'fulfilled' ? refResult.value : null;
            let data = { ...raw, ticker: symbol }, classification;
            if (ref?.sector) classification = { sector: ref.sector, source: ref.source, sourceUrl: ref.sourceUrl, asOf: ref.asOf, status: 'reference' };
            if (!classification) {
                const summary = yahooResult.status === 'fulfilled' ? yahooResult.value : null;
                const profile = summary?.assetProfile || summary?.summaryProfile || {}, price = summary?.price || {};
                const assetType = price.quoteType;
                data = { ...data, name: raw.name || price.longName || price.shortName, country: raw.country || profile.country, currency: raw.currency || price.currency, assetType };
                const fund = ['ETF', 'MUTUALFUND', 'INDEX'].includes(assetType) || symbol.startsWith('FUND:') || /exchange traded fund|mutual fund/i.test(raw.finnhubIndustry || '');
                const sector = !fund && normalizeSector(profile.sector);
                if (sector) classification = { sector, source: 'Yahoo Finance company profile', sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/profile/`, asOf: new Date(now()).toISOString(), status: 'live' };
                else if (!fund && normalizeSector(raw.finnhubIndustry)) classification = { sector: normalizeSector(raw.finnhubIndustry), source: 'Finnhub industry mapping', sourceUrl: 'https://finnhub.io/docs/api/company-profile2', asOf: new Date(now()).toISOString(), status: 'mapped' };
            }
            if (!classification && cached?.data.sector && now() - cached.time < 30 * DAY) return { ...cached.data, classification: { ...cached.data.classification, status: 'stale' } };
            const isFundMetadata = ['ETF', 'MUTUALFUND'].includes(data.assetType);
            data = { ...data, name: data.name || ref?.name || symbol, country: data.country || ref?.country || '', currency: data.currency || ref?.currency || '', exchange: data.exchange || ref?.exchange || '', sector: classification?.sector || null, classification: classification || { sector: null, label: isFundMetadata ? 'Fund — underlying exposure unavailable' : null, source: isFundMetadata ? 'Yahoo Finance fund metadata' : null, asOf: isFundMetadata ? new Date(now()).toISOString() : null, status: 'unavailable' } };
            data.country = ({ 'United States': 'US', 'United Kingdom': 'GB', Israel: 'IL', Canada: 'CA', China: 'CN', Denmark: 'DK', Switzerland: 'CH', Germany: 'DE', France: 'FR', Japan: 'JP', Netherlands: 'NL', Ireland: 'IE', Australia: 'AU', Taiwan: 'TW', 'South Korea': 'KR' })[data.country] || data.country;
            cache.set(symbol, { time: now(), data });
            if (cache.size > 5000) cache.delete(cache.keys().next().value);
            return data;
        })().finally(() => pending.delete(symbol));
        pending.set(symbol, task);
        return task;
    };
}
