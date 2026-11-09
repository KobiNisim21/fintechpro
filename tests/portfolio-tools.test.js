import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePortfolioRisk, alignedCorrelation, combinePositions, buildDividendEstimate } from '../server/services/portfolioRisk.js';
import { applySale } from '../server/services/positionActivity.js';
import { evaluateRule } from '../server/services/personalAlerts.js';
import { createExcelWorkbook } from '../server/services/excelExport.js';
import { unzipSync, strFromU8 } from 'fflate';

test('health uses market weights, aggregates ticker concentration, preserves zero beta and reports missing coverage', () => {
    const rows = [{ symbol: 'A', value: 800, sector: 'Tech', beta: 0 }, { symbol: 'A', value: 100, sector: 'Tech', beta: 0 }, { symbol: 'B', value: 100, sector: 'Health', beta: 1 }];
    const result = calculatePortfolioRisk(rows);
    assert.equal(result.maxHoldingPct, 90);
    assert.equal(result.maxSectorPct, 90);
    assert.equal(result.portfolioBeta, 0.1);
    assert.equal(result.healthScore, 20);
    assert.equal(calculatePortfolioRisk([{ symbol: 'A', value: 100 }]).healthScore, null);
    assert.equal(calculatePortfolioRisk([]).healthScore, null);
    assert.equal(calculatePortfolioRisk(rows.map(row => ({ ...row, beta: -3 }))).components.volatility, 0);
});

test('same symbol in different brokers is combined without duplicate dividend quantity', () => {
    const positions = combinePositions([{ symbol: 'A', quantity: 2, averagePrice: 100, lots: [{ quantity: 2, price: 100, date: '2026-01-01' }] }, { symbol: 'A', quantity: 1, averagePrice: 160, lots: [{ quantity: 1, price: 160, date: '2026-01-03' }] }]);
    assert.equal(positions.length, 1); assert.equal(positions[0].quantity, 3); assert.equal(positions[0].averagePrice, 120);
    const info = { exDate: '2026-01-03', amount: 2, dividendRate: 99, currency: 'USD' };
    assert.equal(buildDividendEstimate('A', positions, info).estimatedPayout, 4);
    assert.equal(buildDividendEstimate('A', positions, { ...info, amount: null }).estimatedPayout, null);
    assert.equal(buildDividendEstimate('A', [{ ...positions[0], activity: [{ type: 'SELL' }] }], info).estimatedPayout, null);
});

test('correlation aligns return intervals and does not compare unrelated date arrays', () => {
    const chart = { dates: ['1', '2', '3', '4', '5', '6', '7'], closes: [100, 110, 105, 112, 108, 120, 119] };
    assert.equal(alignedCorrelation(chart, chart), 1);
    assert.equal(alignedCorrelation(chart, { ...chart, dates: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }), null);
});

test('FIFO sorts purchase dates, handles fractional/full sales and retains unknown execution prices', () => {
    const holding = () => ({ quantity: 3, averagePrice: 120, createdAt: '2026-01-01', lots: [{ quantity: 1, price: 160, date: '2026-01-03' }, { quantity: 2, price: 100, date: '2026-01-01' }], $locals: {}, activity: [] });
    const p = holding(); const sale = applySale(p, { quantity: 2.5, price: 200, fee: 5, date: '2026-02-01' });
    assert.equal(sale.costBasis, 280); assert.equal(sale.realizedGain, 215); assert.equal(p.lots[0].quantity, 0.5);
    const closed = holding(); applySale(closed, { quantity: 3, price: 0 }); assert.equal(closed.quantity, 0); assert.deepEqual(closed.lots, []); assert.equal(closed.isDeleted, true);
    const unknown = applySale(holding(), { quantity: 1, price: null }, { allowUnknownPrice: true }); assert.equal(unknown.realizedGain, null);
    for (const input of [{ quantity: 4, price: 1 }, { quantity: -1, price: 1 }, { quantity: 1, price: null }, { quantity: 1, price: 1, date: '2025-01-01' }]) assert.throws(() => applySale(holding(), input));
});

test('personal alerts skip missing/stale quotes and combine concentration across brokers', () => {
    const positions = [{ symbol: 'A', quantity: 2 }, { symbol: 'A', quantity: 1 }, { symbol: 'B', quantity: 1 }];
    const quotes = new Map([['A', { c: 100, dp: -3 }], ['B', { c: 100, dp: 0 }]]);
    assert.equal(evaluateRule({ symbol: 'A', kind: 'concentration', threshold: 70 }, quotes, positions), 75);
    assert.equal(evaluateRule({ symbol: 'A', kind: 'daily_move', threshold: 2 }, quotes, positions), 3);
    assert.equal(evaluateRule({ symbol: 'A', kind: 'price_below', threshold: 101 }, quotes, positions), 100);
    quotes.set('B', { c: 100, stale: true }); assert.equal(evaluateRule({ symbol: 'A', kind: 'concentration', threshold: 1 }, quotes, positions), null);
});

test('Excel export contains numeric cells and encodes formula-like text as strings', () => {
    const workbook = createExcelWorkbook([{ name: 'Activity', rows: [['Symbol', 'Amount'], ['=HYPERLINK("bad") & <tag>', -12.5]] }]);
    const files = unzipSync(workbook), sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    assert.ok(files['xl/workbook.xml']); assert.match(sheet, /<v>-12.5<\/v>/); assert.match(sheet, /t="inlineStr"/);
    assert.ok(!sheet.includes('<f>')); assert.match(sheet, /&amp; &lt;tag&gt;/);
});
