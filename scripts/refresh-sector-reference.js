import { writeFile } from 'node:fs/promises';
import { parseHoldings, HOLDINGS_URL } from '../server/services/sectorClassification.js';
const response = await fetch(HOLDINGS_URL, { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`Holdings download failed: ${response.status}`);
const snapshot = parseHoldings(await response.text());
const { equities, ...metadata } = snapshot;
const contents = JSON.stringify(metadata, null, 2).slice(0, -2) + ',\n  "equities": {\n' + Object.entries(equities).map(([symbol, data]) => '    ' + JSON.stringify(symbol) + ': ' + JSON.stringify(data)).join(',\n') + '\n  }\n}\n';
await writeFile(new URL('../server/data/equity-sector-reference.json', import.meta.url), contents);
console.log(JSON.stringify({ equities: Object.keys(snapshot.equities).length, asOf: snapshot.asOf, source: snapshot.source }));
