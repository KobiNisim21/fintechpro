import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProfileResolver, createHoldingsReference, normalizeSector, parseHoldings } from '../server/services/sectorClassification.js';
import { calculatePortfolioRisk } from '../server/services/portfolioRisk.js';

const now = Date.parse('2026-11-09T12:00:00Z');
const snapshot = JSON.parse(readFileSync(new URL('../server/data/equity-sector-reference.json', import.meta.url)));
const unavailable = async () => { throw new Error('Provider unavailable'); };
const reference = createHoldingsReference({ snapshot, download: unavailable, now: () => now });

test('official equity reference covers common diversified portfolios during total provider failure', async () => {
    const resolve = createProfileResolver({ finnhub: unavailable, yahoo: unavailable, reference, now: () => now });
    const symbols = ['AAPL', 'GOOG', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NVDA', 'TSLA', 'JPM', 'V', 'LLY', 'XOM', 'WMT', 'BRK.B'];
    const profiles = await Promise.all(symbols.map(symbol => resolve(symbol)));
    assert.ok(Object.keys(snapshot.equities).length > 2000);
    assert.ok(profiles.every(p => p.sector && p.classification.source === 'iShares ITOT holdings'));
    assert.equal(profiles[1].sector, 'Communication Services');
    assert.equal(profiles[4].sector, 'Consumer Discretionary');
    assert.equal(profiles.at(-1).ticker, 'BRK-B');
    const risk = calculatePortfolioRisk(profiles.map(p => ({ symbol: p.ticker, value: 100, sector: p.sector, beta: 1, classification: p.classification })));
    assert.equal(risk.coverage.sectors, 100); assert.notEqual(risk.healthScore, null);
    assert.equal(risk.classifications.length, symbols.length); assert.deepEqual(risk.missingClassifications, []);
});

test('Yahoo classification works independently of an empty or denied Finnhub response', async () => {
    const resolve = createProfileResolver({ finnhub: unavailable, reference: async () => null, yahoo: async () => ({ assetProfile: { sector: 'Healthcare', country: 'United States' }, price: { quoteType: 'EQUITY', currency: 'USD' } }), now: () => now });
    const result = await resolve('TEST'); assert.equal(result.sector, 'Health Care'); assert.equal(result.classification.source, 'Yahoo Finance company profile');
});

test('recognized Finnhub industries normalize without inventing sectors for unknown values or funds', async () => {
    const resolve = createProfileResolver({ finnhub: async symbol => ({ finnhubIndustry: symbol === 'FUND:1234567' ? 'Software' : 'Semiconductors' }), reference: async () => null, yahoo: unavailable, now: () => now });
    assert.equal((await resolve('TEST')).sector, 'Technology');
    assert.equal((await resolve('FUND:1234567')).sector, null);
    assert.equal(normalizeSector('Other'), null); assert.equal(normalizeSector('Unknown'), null);
    assert.equal(normalizeSector('Information Technology'), normalizeSector('Technology'));
    const etf = createProfileResolver({ finnhub: async () => ({ finnhubIndustry: 'Software' }), reference: async () => null, yahoo: async () => ({ price: { quoteType: 'ETF' }, assetProfile: { sector: 'Technology' } }), now: () => now });
    assert.equal((await etf('QQQ')).sector, null);
});

test('missing results expire quickly and concurrent portfolios share provider requests', async () => {
    let clock = now, calls = 0, available = false;
    const resolve = createProfileResolver({ finnhub: async () => { calls++; return {}; }, reference: async () => null, yahoo: async () => available ? { assetProfile: { sector: 'Energy' } } : {}, now: () => clock });
    const results = await Promise.all([resolve('TEST'), resolve('TEST')]); assert.equal(calls, 1); assert.equal(results[0].sector, null);
    available = true; clock += 121000;
    assert.equal((await resolve('TEST')).sector, 'Energy'); assert.equal(calls, 2);
});

test('expired reference is not silently trusted; last good live classification is marked stale', async () => {
    const old = createHoldingsReference({ snapshot: { ...snapshot, asOf: '2025-01-01' }, download: unavailable, now: () => now });
    assert.equal(await old('GOOG'), null);
    let clock = now, fails = false;
    const resolve = createProfileResolver({ finnhub: async () => ({}), reference: async () => null, yahoo: async () => { if (fails) throw new Error('Down'); return { assetProfile: { sector: 'Energy' } }; }, now: () => clock });
    await resolve('TEST'); clock += 2 * 86400000; fails = true;
    assert.equal((await resolve('TEST')).classification.status, 'stale');
    clock += 31 * 86400000; assert.equal((await resolve('TEST')).sector, null);
});

test('holdings parser validates headers, rejects HTML, skips cash and ambiguous symbols, preserves UTC dates', () => {
    assert.throws(() => parseHoldings('<html>blocked</html>', now));
    const rows = Array.from({ length: 501 }, (_, i) => `A${i},"Company, ${i}",Technology,Equity,US,NASDAQ,USD`);
    const csv = 'Fund Holdings as of,"Nov 06, 2026"\nTicker,Name,Sector,Asset Class,Location,Exchange,Market Currency\n' + rows.join('\n') + '\nCONFLICT,One,Energy,Equity,US,NASDAQ,USD\nCONFLICT,Two,Technology,Equity,US,NASDAQ,USD\nCASH,Cash,Financials,Cash,US,NASDAQ,USD';
    const parsed = parseHoldings(csv, now); assert.equal(parsed.asOf, '2026-11-06'); assert.equal(Object.keys(parsed.equities).length, 501); assert.equal(parsed.equities.A0[0], 'Company, 0'); assert.equal(parsed.equities.CONFLICT, undefined); assert.equal(parsed.equities.CASH, undefined);
});
