import test from 'node:test';
import assert from 'node:assert/strict';
import { holdingReturn } from '../src/lib/holdingReturn.ts';

test('holding return compares total remaining cost with market value, independently of daily movement', () => {
    assert.deepEqual(holdingReturn({ quantity: 3, averagePrice: 120, price: 150, change: -5 }), { costBasis: 360, marketValue: 450, amount: 90, percent: 25 });
    assert.deepEqual(holdingReturn({ quantity: .75, averagePrice: 80, price: 100 }), { costBasis: 60, marketValue: 75, amount: 15, percent: 25 });
    assert.deepEqual(holdingReturn({ quantity: 5, averagePrice: 100, price: 80 }), { costBasis: 500, marketValue: 400, amount: -100, percent: -20 });
    assert.equal(holdingReturn({ quantity: 5, averagePrice: 100, price: 100 }).amount, 0);
});

test('holding return does not fabricate gains from estimated/missing quotes or divide zero purchase cost', () => {
    for (const patch of [{ priceStatus: 'estimated' }, { price: 0 }, { price: NaN }, { quantity: 0 }, { quantity: -1 }, { averagePrice: -1 }, { averagePrice: Infinity }]) {
        assert.equal(holdingReturn({ quantity: 1, averagePrice: 100, price: 150, ...patch }), null);
    }
    assert.deepEqual(holdingReturn({ quantity: 2, averagePrice: 0, price: 10 }), { costBasis: 0, marketValue: 20, amount: 20, percent: null });
    assert.equal(holdingReturn({ quantity: 2, averagePrice: 100, price: 125, priceStatus: 'stale' }).amount, 50);
});
