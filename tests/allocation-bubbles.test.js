import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAllocationBubbles } from '../src/lib/allocationBubbles.ts';

function verifyGeometry(result) {
    const [x, y, width, height] = result.viewBox.split(' ').map(Number);
    assert.ok([x, y, width, height].every(Number.isFinite));
    for (let i = 0; i < result.bubbles.length; i++) {
        const a = result.bubbles[i];
        assert.ok(a.x - a.r >= x && a.x + a.r <= x + width);
        assert.ok(a.y - a.r >= y && a.y + a.r <= y + height);
        for (const b of result.bubbles.slice(i + 1)) {
            assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r - 1e-6);
            assert.ok(Math.abs(a.r ** 2 / b.r ** 2 - a.value / b.value) < 1e-6);
        }
    }
}

test('reference allocation uses proportional circle areas, retains exact percentages and never overlaps', () => {
    const source = Object.freeze([43, 27, 18, 12].map((value, index) => Object.freeze({ name: `STOCK${index}`, value })));
    const result = buildAllocationBubbles(source);
    assert.deepEqual(result.rows.map(r => r.percent), [43, 27, 18, 12]);
    assert.deepEqual(result, buildAllocationBubbles(source));
    verifyGeometry(result);
});

test('many holdings use a disclosed aggregate bubble without losing any legend value or total', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ name: `STOCK${i}`, value: i + 1 }));
    const result = buildAllocationBubbles(data);
    assert.equal(result.rows.length, 100);
    assert.equal(result.bubbles.length, 16);
    assert.equal(result.bubbles.find(b => b.otherCount).otherCount, 85);
    assert.equal(result.rows.reduce((sum, r) => sum + r.value, 0), 5050);
    assert.equal(result.bubbles.reduce((sum, r) => sum + r.value, 0), 5050);
    assert.ok(Math.abs(result.bubbles.reduce((sum, r) => sum + r.percent, 0) - 100) < 1e-10);
    verifyGeometry(result);
});

test('empty, invalid, single, repeated-symbol and small-weight cases remain finite without inventing minimum weights', () => {
    assert.equal(buildAllocationBubbles([]).bubbles.length, 0);
    assert.equal(buildAllocationBubbles([{ name: 'BAD', value: NaN }, { name: 'ZERO', value: 0 }, { name: 'NEG', value: -1 }]).rows.length, 0);
    const single = buildAllocationBubbles([{ name: 'IVV', value: 20 }]);
    assert.equal(single.bubbles[0].percent, 100); verifyGeometry(single);
    const repeated = buildAllocationBubbles([{ name: 'GOOG', value: 20 }, { name: 'GOOG', value: 30 }, { name: 'IVV', value: 50 }]);
    assert.deepEqual(repeated.rows.map(r => r.percent), [50, 50]); verifyGeometry(repeated);
    for (let count = 2; count <= 16; count++) {
        verifyGeometry(buildAllocationBubbles(Array.from({ length: count }, (_, i) => ({ name: `S${i}`, value: (i + 1) ** 4 }))));
    }
    const tiny = buildAllocationBubbles([{ name: 'BIG', value: 1e6 }, { name: 'SMALL', value: 1 }]);
    assert.equal(tiny.bubbles[1].r / tiny.bubbles[0].r, .001); verifyGeometry(tiny);
});
