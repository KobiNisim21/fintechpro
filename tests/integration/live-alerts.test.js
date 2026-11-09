import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureServer } from '../support/fixtureServer.js';
import Position from '../../server/models/Position.js';
import { processPriceUpdate, processNewsAlert, getAlertsForUser, sendInitialAlerts } from '../../server/services/liveAlertsService.js';

test('successive eligible price alerts replace rather than accumulate and preserve other events and users', async t => {
    const fixture = await createFixtureServer();
    t.after(() => fixture.close());
    const owner = String(fixture.users[0]._id), other = String(fixture.users[1]._id);
    await Position.create({ user: owner, symbol: 'IVV', name: 'QA IVV', quantity: 2, averagePrice: 100 });
    await Position.create({ user: other, symbol: 'MA', name: 'QA MA', quantity: 1, averagePrice: 100 });
    const emitted = [];
    const socket = { userId: owner, emit: (name, data) => emitted.push({ name, data }) };
    const io = { fetchSockets: async () => [socket, { userId: other, emit: () => assert.fail('Unrelated user received IVV alert') }] };
    let now = Date.now();
    t.mock.method(Date, 'now', () => now);
    const advance = () => { now += 2 * 60 * 60 * 1000 + 1; };
    await processNewsAlert(io, 'IVV', 'Distinct IVV headline');
    for (const percent of [2.3, 2.6, 2.4]) {
        await processPriceUpdate(io, 'IVV', 100 + percent, 100, percent);
        advance();
    }
    let feed = getAlertsForUser(owner);
    assert.equal(feed.length, 2);
    assert.equal(feed[0].value, 2.4);
    assert.equal(feed[1].message, 'Distinct IVV headline');
    assert.deepEqual(getAlertsForUser(other), []);
    await processPriceUpdate(io, 'IVV', 97.5, 100, -2.5);
    feed = getAlertsForUser(owner);
    assert.equal(feed.length, 2);
    assert.equal(feed[0].type, 'loss');
    const lastId = feed[0].id;
    await processPriceUpdate(io, 'IVV', 97, 100, -3);
    assert.equal(getAlertsForUser(owner)[0].id, lastId, 'Existing two-hour cooldown still applies');
    sendInitialAlerts(socket);
    assert.deepEqual(emitted.at(-1).data.alerts.map(a => a.id), feed.map(a => a.id));
    assert.equal(emitted.filter(e => e.name === 'live-alert').length, 5);

    // Updating a ticker at capacity must not push a distinct older event out.
    for (const headline of ['Second headline', 'Third headline', 'Fourth headline']) {
        advance();
        await processNewsAlert(io, 'IVV', headline);
    }
    assert.equal(getAlertsForUser(owner).length, 5);
    advance();
    await processPriceUpdate(io, 'IVV', 103, 100, 3);
    feed = getAlertsForUser(owner);
    assert.equal(feed.length, 5);
    assert.equal(feed.filter(a => a.type === 'news').length, 4);
    assert.ok(feed.some(a => a.message === 'Distinct IVV headline'));
});
