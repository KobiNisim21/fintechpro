import { parseCSV, normalizeSector, normalizeEquitySymbol } from './sectorClassification.js';
export const FUND_SOURCES = {
    IVV: 'https://www.ishares.com/us/products/239726/ishares-core-s-p-500-etf/latest-holdings.csv',
    ITOT: 'https://www.ishares.com/us/products/239724/ishares-core-s-p-total-u-s-stock-market-etf/latest-holdings.csv',
};
// Proxy funds remain explicitly identified; a shared benchmark is not identical holdings.
const FUNDS = {
    IVV: { reference: 'IVV', benchmark: 'S&P 500', name: 'iShares Core S&P 500 ETF' },
    ITOT: { reference: 'ITOT', benchmark: 'US total stock market', name: 'iShares Core S&P Total US Stock Market ETF' },
    SPY: { reference: 'IVV', benchmark: 'S&P 500', name: 'SPDR S&P 500 ETF Trust', proxy: true },
    VOO: { reference: 'IVV', benchmark: 'S&P 500', name: 'Vanguard S&P 500 ETF', proxy: true },
    VTI: { reference: 'ITOT', benchmark: 'US total stock market', name: 'Vanguard Total Stock Market ETF', proxy: true },
};

export function parseFundExposure(text, fund, now = Date.now()) {
    const rows = parseCSV(text.replace(/^\uFEFF/, ''));
    const date = rows.find(row => row[0] === 'Fund Holdings as of')?.[1], timestamp = Date.parse(`${date} UTC`);
    if (!Number.isFinite(timestamp) || timestamp > now + 86400000 || now - timestamp > 90 * 86400000) throw new Error('Invalid fund holdings date');
    const headerIndex = rows.findIndex(row => row[0] === 'Ticker' && row.includes('Sector'));
    if (headerIndex < 0) throw new Error('Invalid fund holdings schema');
    const header = rows[headerIndex], index = key => header.indexOf(key);
    const weightIndex = Math.max(index('Weight (%)'), index('Market Weight'));
    if (weightIndex < 0 || index('Asset Class') < 0) throw new Error('Fund weights missing');
    const holdings = [];
    const number = value => Number(String(value ?? '').replaceAll(',', ''));
    const marketValueIndex = index('Market Value');
    const marketTotal = rows.slice(headerIndex + 1).reduce((sum, row) => sum + (Number.isFinite(number(row[marketValueIndex])) ? number(row[marketValueIndex]) : 0), 0);
    for (const row of rows.slice(headerIndex + 1)) {
        const sector = normalizeSector(row[index('Sector')]);
        const weight = marketValueIndex >= 0 && marketTotal > 0 ? number(row[marketValueIndex]) / marketTotal : Number(row[weightIndex]) / 100;
        const symbol = normalizeEquitySymbol(row[0]);
        if (row[index('Asset Class')] !== 'Equity' || !sector || !/^[A-Z][A-Z0-9-]{0,14}$/.test(symbol) || !Number.isFinite(weight) || weight <= 0) continue;
        holdings.push({ symbol, sector, weight });
    }
    const sum = holdings.reduce((total, row) => total + row.weight, 0);
    if (holdings.length < 300 || sum < 0.95 || sum > 1.02) throw new Error('Incomplete fund holdings');
    // Published weights are rounded. Scale down a rounding overshoot, never fill missing exposure.
    if (sum > 1) for (const row of holdings) row.weight /= sum;
    return { asOf: new Date(timestamp).toISOString().slice(0, 10), source: `iShares ${fund} holdings`, sourceUrl: FUND_SOURCES[fund], holdings };
}

export function createFundResolver({ snapshots, download, now = Date.now }) {
    const current = { ...snapshots }, pending = new Map(), refreshAfter = new Map();
    const usable = data => data && Number.isFinite(Date.parse(data.asOf)) && Date.parse(data.asOf) <= now() && now() - Date.parse(data.asOf) <= 90 * 86400000;
    async function refresh(fund) {
        if (!pending.has(fund) && now() >= (refreshAfter.get(fund) || 0)) {
            refreshAfter.set(fund, now() + 86400000);
            pending.set(fund, Promise.resolve().then(() => download(fund)).then(text => { current[fund] = parseFundExposure(text, fund, now()); }).catch(() => { refreshAfter.set(fund, now() + 300000); }).finally(() => pending.delete(fund)));
        }
        return pending.get(fund);
    }
    return async symbol => {
        const info = Object.hasOwn(FUNDS, symbol) ? FUNDS[symbol] : null;
        if (!info) return null;
        if (usable(current[info.reference])) void refresh(info.reference); else await refresh(info.reference);
        if (!usable(current[info.reference])) return null;
        const data = current[info.reference];
        return { ...data, name: info.name, label: 'Broad US equity ETF', benchmark: info.benchmark, referenceFund: info.reference, proxy: Boolean(info.proxy), source: info.proxy ? `${data.source} (benchmark proxy for ${symbol})` : data.source };
    };
}
