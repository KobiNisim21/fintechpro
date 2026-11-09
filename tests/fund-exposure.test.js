import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFundResolver, parseFundExposure } from '../server/services/fundExposure.js';
import { calculatePortfolioRisk } from '../server/services/portfolioRisk.js';
import { createProfileResolver } from '../server/services/sectorClassification.js';
const snapshots = JSON.parse(readFileSync(new URL('../server/data/fund-exposure-reference.json', import.meta.url)));
const now = Date.parse('2026-11-09T12:00:00Z');
const unavailable = async () => { throw new Error('Down'); };
const fund = createFundResolver({ snapshots, download: unavailable, now: () => now });
const riskRow = (symbol, value, fundExposure) => ({ symbol, value, fundExposure, beta: 1 });

test('IVV is classified as broad equity, with a score from its underlying sectors and issuers', async () => {
    const exposure = await fund('IVV');
    const risk = calculatePortfolioRisk([riskRow('IVV', 1000, exposure)]);
    assert.equal(exposure.proxy, false); assert.equal(exposure.benchmark, 'S&P 500');
    assert.ok(exposure.holdings.length >= 500);
    assert.ok(risk.coverage.sectors > 99); assert.equal(risk.missingClassifications.length, 0);
    assert.ok(risk.maxHoldingPct < 10); assert.ok(risk.maxSectorPct < 50);
    assert.ok(risk.healthScore > 80); assert.equal(risk.broadFundPercent, 100);
    assert.equal(risk.classifications[0].label, 'Broad US equity ETF');
    assert.ok(risk.exposures.sectors.length >= 11);
});

test('direct shares and fund holdings overlap by issuer and sectors; broad funds are not automatic bonuses', async () => {
    const exposure = await fund('IVV');
    const mixed = calculatePortfolioRisk([{ symbol: 'GOOG', value: 409, sector: 'Communication Services', beta: 1 }, { symbol: 'MA', value: 376, sector: 'Financials', beta: 1 }, riskRow('IVV', 215, exposure)]);
    assert.ok(mixed.healthScore !== null); assert.ok(mixed.coverage.sectors > 99);
    assert.ok(mixed.exposures.issuers.find(row => row.name === 'GOOG').value > 409);
    const concentrated = calculatePortfolioRisk([{ symbol: 'GOOG', value: 624, sector: 'Communication Services', beta: 1 }, { symbol: 'MA', value: 376, sector: 'Financials', beta: 1 }]);
    assert.ok(mixed.healthScore > concentrated.healthScore);
    const duplicate = calculatePortfolioRisk([riskRow('IVV', 500, exposure), riskRow('SPY', 500, await fund('SPY'))]);
    const single = calculatePortfolioRisk([riskRow('IVV', 1000, exposure)]);
    assert.equal(duplicate.healthScore, single.healthScore);
    assert.ok(Math.abs(duplicate.maxHoldingPct - single.maxHoldingPct) < 1e-8);
});

test('similar broad funds identify proxies and unknown/focused ETFs receive no invented broad exposure', async () => {
    for (const symbol of ['VOO', 'SPY', 'VTI']) { const exposure = await fund(symbol); assert.equal(exposure.proxy, true); assert.match(exposure.source, /proxy/); }
    assert.equal(await fund('UNKNOWN'), null); assert.equal(await fund('QQQ'), null);
    const risk = calculatePortfolioRisk([riskRow('UNKNOWN', 100, null)]);
    assert.equal(risk.healthScore, null); assert.equal(risk.broadFundPercent, 0);
    const resolve = createProfileResolver({ fund, finnhub: unavailable, reference: async () => null, yahoo: unavailable, now: () => now });
    const profile = await resolve('IVV'); assert.equal(profile.assetType, 'ETF'); assert.equal(profile.sector, null); assert.ok(profile.fundExposure.holdings.length);
});

test('fund data expiry, invalid downloads and missing weights are rejected without pretending complete coverage', async () => {
    const resolver = createFundResolver({ snapshots: { IVV: { ...snapshots.IVV, asOf: '2020-01-01' } }, download: unavailable, now: () => now });
    assert.equal(await resolver('IVV'), null);
    assert.throws(() => parseFundExposure('<html>not a CSV</html>', 'IVV', now));
    assert.throws(() => parseFundExposure('Fund Holdings as of,"Nov 06, 2026"\nTicker,Name,Sector,Asset Class\nA,A,Technology,Equity', 'IVV', now));
    assert.ok(snapshots.ITOT.holdings.length > 2000);
});

