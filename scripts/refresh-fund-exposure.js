import { writeFile } from 'node:fs/promises';
import { FUND_SOURCES, parseFundExposure } from '../server/services/fundExposure.js';
const entries = await Promise.all(Object.entries(FUND_SOURCES).map(async ([fund, url]) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Fund holdings download failed: ${fund}`);
    return [fund, parseFundExposure(await response.text(), fund)];
}));
await writeFile(new URL('../server/data/fund-exposure-reference.json', import.meta.url), JSON.stringify(Object.fromEntries(entries)) + '\n');
console.log(JSON.stringify(entries.map(([fund, data]) => ({ fund, asOf: data.asOf, holdings: data.holdings.length }))));
