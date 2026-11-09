import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { createFixtureServer } from '../support/fixtureServer.js';
import Position from '../../server/models/Position.js';
import { sellPosition, undoAuditAction } from '../../server/services/mcpService.js';
import AuditLog from '../../server/models/AuditLog.js';

test('activity, personal rules and Excel backup persist with ownership and atomic writes', async t => {
    const fixture = await createFixtureServer(); t.after(() => fixture.close());
    const request = async (path, { method = 'GET', body, user = 0, auth = true, binary = false } = {}) => {
        const response = await fetch(fixture.baseUrl + '/api' + path, { method, headers: { ...(auth ? { Authorization: `Bearer ${fixture.tokens[user]}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, data: binary ? new Uint8Array(await response.arrayBuffer()) : await response.json() };
    };
    const buy = (quantity, price, broker = 'QA') => request('/positions', { method: 'POST', body: { symbol: 'AAPL', name: 'QA', broker, quantity, averagePrice: price, date: '2026-01-01' } });
    let id;
    await t.test('new buys, corrections and removals remain in the activity ledger', async () => {
        id = (await buy(2, 100)).data._id;
        await buy(1, 160);
        let history = (await request('/activity')).data;
        assert.equal(history.total, 2); assert.ok(history.events.every(event => event.type === 'BUY'));
        assert.equal((await request('/activity', { user: 1 })).data.total, 0);
        assert.equal((await request('/activity', { auth: false })).status, 401);
        assert.equal((await request(`/activity/${id}`, { method: 'POST', user: 1, body: { type: 'SELL', quantity: 1, price: 200 } })).status, 404);
    });
    await t.test('partial sale persists FIFO result and leaves only the remaining lots', async () => {
        const sale = await request(`/activity/${id}`, { method: 'POST', body: { type: 'SELL', quantity: 2.5, price: 200, fee: 5, date: '2026-02-01' } });
        assert.equal(sale.status, 201); assert.equal(sale.data.event.costBasis, 280); assert.equal(sale.data.event.realizedGain, 215);
        const position = await Position.findById(id); assert.equal(position.quantity, 0.5); assert.equal(position.averagePrice, 160);
        assert.equal(position.activity.filter(event => event.type === 'SELL').length, 1);
        const again = (await request('/activity')).data; assert.equal(again.total, 3);
    });
    await t.test('income and fees are durable records without changing share quantities', async () => {
        for (const type of ['DIVIDEND', 'FEE']) assert.equal((await request(`/activity/${id}`, { method: 'POST', body: { type, amount: 2, note: '=1+1' } })).status, 201);
        assert.equal((await Position.findById(id)).quantity, 0.5);
        const filtered = (await request('/activity?type=DIVIDEND')).data; assert.equal(filtered.total, 1);
        for (const body of [{ type: 'SELL', quantity: 9, price: 1 }, { type: 'FEE', amount: -1 }, { type: 'SELL', quantity: 0.1, price: null }]) assert.equal((await request(`/activity/${id}`, { method: 'POST', body })).status, 400);
        assert.equal((await request('/activity')).data.total, 5);
    });
    await t.test('Excel export is owner-scoped, includes archived activity and has numeric cells', async () => {
        await request('/positions', { method: 'POST', user: 1, body: { symbol: 'MSFT', name: 'Other private holding', quantity: 1, averagePrice: 1 } });
        assert.equal((await request('/activity/export', { auth: false })).status, 401);
        const result = await request('/activity/export', { binary: true }); assert.equal(result.status, 200);
        const files = unzipSync(result.data), text = Object.values(files).map(value => strFromU8(value)).join('');
        assert.match(text, /AAPL/); assert.ok(!text.includes('Other private holding')); assert.ok(!text.includes('<f>'));
        assert.match(strFromU8(files['xl/worksheets/sheet4.xml']), /<v>215<\/v>/);
    });
    let ruleId;
    await t.test('personal price alerts trigger once, persist and cannot cross users', async () => {
        const result = await request('/alerts', { method: 'POST', body: { symbol: 'AAPL', kind: 'price_above', threshold: 149 } });
        assert.equal(result.status, 201); ruleId = result.data._id;
        assert.equal((await request('/alerts', { auth: false })).status, 401);
        assert.equal((await request(`/alerts/${ruleId}`, { user: 1, method: 'PUT', body: { enabled: false } })).status, 404);
        assert.equal((await request('/alerts/check', { method: 'POST' })).data.triggered.length, 1);
        assert.equal((await request('/alerts/check', { method: 'POST' })).data.triggered.length, 0);
        const rule = (await request('/alerts')).data[0]; assert.equal(rule.enabled, false); assert.ok(rule.lastTriggeredAt);
        await request(`/alerts/${ruleId}`, { method: 'PUT', body: { enabled: true, rearm: true } });
        assert.equal((await request('/alerts/check', { method: 'POST' })).data.triggered.length, 1);
    });
    await t.test('percentage alerts have a persisted cooldown and malformed rules are rejected', async () => {
        assert.equal((await request('/alerts', { method: 'POST', body: { symbol: 'AAPL', kind: 'concentration', threshold: 50 } })).status, 201);
        assert.equal((await request('/alerts/check', { method: 'POST' })).data.triggered.length, 1);
        assert.equal((await request('/alerts/check', { method: 'POST' })).data.triggered.length, 0);
        assert.equal((await request('/alerts', { method: 'POST', body: { symbol: 'AAPL', kind: 'concentration', threshold: 101 } })).status, 400);
        assert.equal((await request('/alerts', { method: 'POST', body: { symbol: 'MSFT', kind: 'price_above', threshold: 1 } })).status, 400);
    });
    await t.test('concurrent sales cannot oversell or duplicate successful records', async () => {
        const concurrentId = (await buy(3, 100, 'Concurrent')).data._id;
        const results = await Promise.all([0, 1].map(() => request(`/activity/${concurrentId}`, { method: 'POST', body: { type: 'SELL', quantity: 2, price: 200 } })));
        assert.equal(results.filter(result => result.status === 201).length, 1);
        const position = await Position.findById(concurrentId); assert.equal(position.quantity, 1); assert.equal(position.activity.filter(event => event.type === 'SELL').length, 1);
    });
    await t.test('retrying the same financial request does not duplicate its ledger entry', async () => {
        const body = { type: 'FEE', amount: 1, requestId: 'qa-idempotent-request-0001' };
        const first = await request(`/activity/${id}`, { method: 'POST', body });
        const second = await request(`/activity/${id}`, { method: 'POST', body });
        assert.equal(first.status, 201); assert.equal(second.status, 200); assert.equal(second.data.event._id, first.data.event._id);
        const position = await Position.findById(id); assert.equal(position.activity.filter(event => event.requestId === body.requestId).length, 1);
    });
    await t.test('soft deletion preserves history and removes the holding from active portfolio', async () => {
        assert.equal((await request(`/positions/${id}`, { method: 'DELETE' })).status, 200);
        assert.equal((await request('/positions')).data.some(p => p._id === id), false);
        const history = (await request('/activity')).data.events.filter(event => event.positionId === id);
        assert.equal(history.length, 7); assert.ok(history.some(event => event.type === 'REMOVE'));
        assert.equal((await request(`/activity/${id}`, { method: 'POST', body: { type: 'DIVIDEND', amount: 3 } })).status, 201);
    });
    await t.test('legacy remaining lots backfill once and MCP sales/undo append rather than erase history', async () => {
        const legacyId = (await buy(2, 100, 'Legacy')).data._id;
        await Position.collection.updateOne({ _id: (await Position.findById(legacyId))._id }, { $unset: { activity: '' } });
        assert.ok((await request('/activity')).data.events.some(event => event.positionId === legacyId && event.type === 'OPENING'));
        await sellPosition(fixture.users[0]._id, { symbol: 'AAPL', broker: 'Legacy', quantity: 1 });
        let position = await Position.findById(legacyId); assert.equal(position.activity[0].type, 'OPENING'); assert.equal(position.activity.at(-1).type, 'SELL'); assert.equal(position.activity.at(-1).realizedGain, null);
        const audit = await AuditLog.findOne({ user: fixture.users[0]._id, action: 'sell_position' });
        await undoAuditAction(fixture.users[0]._id, audit._id);
        position = await Position.findById(legacyId); assert.equal(position.quantity, 2); assert.equal(position.activity.length, 3); assert.equal(position.activity.at(-1).type, 'ADJUSTMENT');
    });
    await t.test('adding to a legacy aggregate preserves its old cost and records a distinct purchase', async () => {
        const legacy = await Position.create({ user: fixture.users[0]._id, symbol: 'AAPL', name: 'Legacy aggregate', broker: 'Aggregate', quantity: 2, averagePrice: 100, lots: [] });
        await Position.collection.updateOne({ _id: legacy._id }, { $unset: { activity: '' } });
        const result = await buy(1, 160, 'Aggregate'); assert.equal(result.status, 200); assert.equal(result.data.quantity, 3); assert.equal(result.data.averagePrice, 120);
        const saved = await Position.findById(legacy._id); assert.equal(saved.activity.length, 2); assert.equal(saved.activity[0].type, 'OPENING'); assert.equal(saved.activity[1].type, 'BUY'); assert.equal(saved.activity[1].amount, 160);
        const update = await request(`/positions/${legacy._id}`, { method: 'PUT', body: { lots: [{ quantity: 4, price: 120, date: '2026-01-01' }] } }); assert.equal(update.status, 200);
        const corrected = await Position.findById(legacy._id); assert.equal(corrected.activity.at(-1).type, 'ADJUSTMENT'); assert.equal(corrected.activity.at(-1).before.quantity, 3); assert.equal(corrected.activity.at(-1).after.quantity, 4);
    });
});
