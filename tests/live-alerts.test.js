import test from 'node:test';
import assert from 'node:assert/strict';
import { deduplicateLiveAlerts } from '../shared/liveAlerts.js';

const alert = (id, type, message, hour, ticker = 'IVV') => ({
    id, type, message, ticker, timestamp: `2026-11-09T${hour}:00:00Z`,
});

test('the three IVV percentage updates collapse to the latest observation, not the highest percentage', () => {
    const input = [alert('old', 'gain', 'up 2.3%', '10'), alert('peak', 'gain', 'up 2.6%', '12'), alert('latest', 'gain', 'up 2.4%', '14')];
    assert.deepEqual(deduplicateLiveAlerts(input).map(a => a.id), ['latest']);
    assert.equal(input.length, 3);
    assert.equal(input[0].id, 'old'); // Input and event objects remain untouched.
});

test('a direction change replaces the price card while distinct news, earnings and lows remain', () => {
    const input = [
        alert('price', 'gain', 'up 2.4%', '10'),
        alert('news1', 'news', 'First headline', '11'),
        alert('news2', 'news', 'Second headline', '12'),
        alert('earnings', 'earnings', 'Reports earnings soon', '12'),
        alert('low', '52w-low', 'Near annual low', '12'),
        alert('other', 'gain', 'up 3%', '13', 'MA'),
        alert('latest', 'loss', 'down 2.1%', '14', ' ivv '),
    ];
    const result = deduplicateLiveAlerts(input);
    assert.equal(result.length, 6);
    assert.equal(result[0].id, 'latest');
    assert.ok(!result.some(a => a.id === 'price'));
    for (const id of ['news1', 'news2', 'earnings', 'low', 'other']) assert.ok(result.some(a => a.id === id));
});

test('replayed events deduplicate by category and identical timestamp order stays stable', () => {
    const first = alert('first', 'news', 'Headline', '12');
    const distinct = alert('distinct', 'earnings', 'Headline', '12');
    assert.deepEqual(deduplicateLiveAlerts([first, { ...first, id: 'replay' }, distinct]), [first, distinct]);
    const invalid = { ...first, timestamp: 'invalid' };
    assert.deepEqual(deduplicateLiveAlerts([invalid, first]), [first]);
    assert.deepEqual(deduplicateLiveAlerts([]), []);
});
