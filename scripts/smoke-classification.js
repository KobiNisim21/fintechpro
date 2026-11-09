import 'dotenv/config';
import { getCompanyProfile } from '../server/services/stockDataService.js';
const symbols = ['GOOG', 'GOOGL', 'AAPL', 'MSFT', 'AMZN', 'META', 'NVDA', 'TSLA', 'JPM', 'BRK-B', 'NVO', 'IVV', 'ITOT', 'SPY', 'VOO', 'VTI'];
const results = [];
for (const symbol of symbols) {
    try {
        const profile = await getCompanyProfile(symbol);
        results.push({ symbol, sector: profile.sector, label: profile.fundExposure?.label, holdings: profile.fundExposure?.holdings?.length, proxy: profile.fundExposure?.proxy, source: profile.classification.source, asOf: profile.classification.asOf });
    } catch { results.push({ symbol, sector: null, status: 'Lookup failed' }); }
}
console.log(JSON.stringify(results, null, 2));
if (results.some(result => !result.sector && !result.label)) process.exitCode = 1;
