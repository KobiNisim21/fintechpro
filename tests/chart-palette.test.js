import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHoldingColors, sectorColors, colorContrast, groupedHoldingColor } from '../src/lib/chartPalette.ts';
import { buildAllocationBubbles } from '../src/lib/allocationBubbles.ts';

test('large portfolios receive defined distinct colors and readable label contrast', () => {
    const names = Array.from({ length: 1000 }, (_, i) => `STOCK${i}`);
    const palette = buildHoldingColors(names);
    assert.equal(palette.size, 1000);
    assert.equal(new Set([...palette.values()].map(color => color.fill)).size, 1000);
    for (const color of palette.values()) {
        assert.match(color.fill, /^#[0-9A-F]{6}$/i);
        assert.ok(colorContrast(color.fill, color.text) >= 4.5);
    }
    assert.ok(colorContrast(groupedHoldingColor.fill, groupedHoldingColor.text) >= 4.5);
});

test('the same holdings keep their colors when ranking or incoming order changes', () => {
    const names = ['GOOG', 'MA', 'IVV', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'SPY', 'VOO', 'VTI'];
    assert.deepEqual(buildHoldingColors(names), buildHoldingColors([...names].reverse()));
    assert.deepEqual(buildHoldingColors([...names, 'GOOG']), buildHoldingColors(names));
    assert.deepEqual(buildHoldingColors([]), new Map());
});

test('all standard sectors have distinct soft backgrounds and readable foregrounds', () => {
    const names = ['Technology', 'Financials', 'Communication Services', 'Health Care', 'Consumer Discretionary', 'Industrials', 'Consumer Staples', 'Energy', 'Utilities', 'Real Estate', 'Materials', 'Unknown'];
    const colors = names.map(name => sectorColors(name));
    assert.equal(new Set(colors.map(color => color[0])).size, 12);
    for (const [background, foreground] of colors) assert.ok(colorContrast(background, foreground) >= 4.5);
    assert.deepEqual(sectorColors('Financials', 0), sectorColors('Financials', 10));
    assert.deepEqual(sectorColors('Custom category', 0), sectorColors('Custom category', 10));
});

test('sixteen holdings remain separate and larger overviews retain all values in the full list', () => {
    const data = Array.from({ length: 1000 }, (_, i) => ({ name: `STOCK${i}`, value: i + 1 }));
    const small = buildAllocationBubbles(data.slice(0, 16));
    assert.equal(small.bubbles.length, 16);
    assert.ok(small.bubbles.every(row => row.otherCount === 0));
    const large = buildAllocationBubbles(data);
    assert.equal(large.rows.length, 1000);
    assert.equal(large.bubbles.length, 16);
    assert.equal(large.bubbles.find(b => b.otherCount).otherCount, 985);
    assert.equal(large.bubbles.reduce((sum, row) => sum + row.value, 0), 500500);
    assert.equal(large.rows.reduce((sum, row) => sum + row.value, 0), 500500);
});
