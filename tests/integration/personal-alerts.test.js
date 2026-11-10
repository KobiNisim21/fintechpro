import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureServer } from '../support/fixtureServer.js';
import Position from '../../server/models/Position.js';
import AlertRule from '../../server/models/AlertRule.js';
import { checkPersonalAlertStatus } from '../../server/services/personalAlerts.js';

test('personal alert checks explain non-triggers and retain atomic one-time and cooldown behavior', async t => {
    const fixture = await createFixtureServer(); t.after(() => fixture.close());
    const user = fixture.users[0]._id;
    await Position.create({ user, symbol: 'GOOG', name: 'QA Alphabet', quantity: 4, averagePrice: 100 });
    const make = (kind, threshold, symbol = 'GOOG') => AlertRule.create({ user, symbol, kind, threshold });
    const quote = async () => ({ c: 300, dp: -3 });
    const above = await make('price_above', 286), below = await make('price_below', 280);
    const daily = await make('daily_move', 2), concentration = await make('concentration', 90);
    const missing = await make('price_above', 1, 'MSFT');
    const result = await checkPersonalAlertStatus(user, quote);
    assert.equal(result.triggered.length, 3);
    assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
    const byId = id => result.evaluations.find(item => item.ruleId === String(id));
    assert.deepEqual(byId(above._id), { ruleId: String(above._id), status: 'triggered', value: 300 });
    assert.equal(byId(below._id).status, 'not_met');
    assert.equal(byId(below._id).value, 300);
    assert.equal(byId(missing._id).status, 'no_holding');
    assert.equal((await AlertRule.findById(above._id)).enabled, false);
    const repeat = await checkPersonalAlertStatus(user, quote);
    assert.equal(repeat.triggered.length, 0);
    for (const rule of [daily, concentration]) assert.equal(repeat.evaluations.find(item => item.ruleId === String(rule._id)).status, 'cooldown');
    for (const provider of [async () => { throw Error('provider down'); }, async () => ({ c: 300, stale: true }), async () => ({ c: NaN })]) {
        const unavailable = await checkPersonalAlertStatus(user, provider);
        assert.equal(unavailable.triggered.length, 0);
        assert.equal(unavailable.evaluations.find(item => item.ruleId === String(below._id)).status, 'unavailable');
    }
    await AlertRule.findByIdAndUpdate(above._id, { enabled: true, lastTriggeredAt: null });
    const concurrent = await Promise.all([checkPersonalAlertStatus(user, quote), checkPersonalAlertStatus(user, quote)]);
    assert.equal(concurrent.flatMap(item => item.triggered).filter(item => String(item._id) === String(above._id)).length, 1);
    const res = await fetch(fixture.baseUrl + '/api/alerts/check', { method: 'POST', headers: { Authorization: `Bearer ${fixture.tokens[1]}` } });
    assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await res.json()).evaluations, []);
});
