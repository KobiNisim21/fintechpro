import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureServer } from '../support/fixtureServer.js';
import Position from '../../server/models/Position.js';

test('positions persist and enforce ownership in disposable MongoDB', { timeout: 180000 }, async t => {
  const fixture = await createFixtureServer();
  t.after(() => fixture.close());
  const request = async (path, { method = 'GET', body, user = 0, authenticated = true } = {}) => {
    const res = await fetch(`${fixture.baseUrl}/api/positions${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${fixture.tokens[user]}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
  };
  const purchase = { symbol: 'AAPL', name: 'QA holding', quantity: 2, averagePrice: 100, broker: 'QA Broker', date: '2026-01-02' };
  let id;

  await t.test('anonymous reads and writes are rejected', async () => {
    assert.equal((await request('', { authenticated: false })).status, 401);
    assert.equal((await request('', { method: 'POST', body: purchase, authenticated: false })).status, 401);
  });
  await t.test('adding a holding creates its initial lot', async () => {
    const result = await request('', { method: 'POST', body: purchase });
    assert.equal(result.status, 201);
    id = result.data._id;
    assert.equal(result.data.quantity, 2);
    assert.equal(result.data.lots.length, 1);
  });
  await t.test('adding the same broker merges lots and recalculates totals', async () => {
    const result = await request('', { method: 'POST', body: { ...purchase, quantity: 1, averagePrice: 160 } });
    assert.equal(result.status, 200);
    assert.equal(result.data._id, id);
    assert.equal(result.data.quantity, 3);
    assert.equal(result.data.averagePrice, 120);
    assert.equal(result.data.lots.length, 2);
  });
  await t.test('another broker remains a separate position', async () => {
    assert.equal((await request('', { method: 'POST', body: { ...purchase, broker: 'Other QA Broker' } })).status, 201);
    assert.equal((await request('')).data.length, 2);
  });
  await t.test('another user cannot read, update or delete the holding', async () => {
    assert.deepEqual((await request('', { user: 1 })).data, []);
    assert.equal((await request(`/${id}`, { method: 'PUT', user: 1, body: { lots: [{ quantity: 99, price: 1 }] } })).status, 401);
    assert.equal((await request(`/${id}`, { method: 'DELETE', user: 1 })).status, 401);
    assert.equal((await request('')).data.find(p => p._id === id).quantity, 3);
  });
  await t.test('editing lots persists correctly across subsequent reads', async () => {
    const result = await request(`/${id}`, { method: 'PUT', body: { quantity: 999, averagePrice: 999, lots: [{ quantity: 3, price: 100 }, { quantity: 1, price: 200 }] } });
    assert.equal(result.status, 200);
    assert.equal(result.data.quantity, 4);
    assert.equal(result.data.averagePrice, 125);
    const saved = (await request('')).data.find(p => p._id === id);
    assert.equal(saved.quantity, 4);
    assert.equal(saved.averagePrice, 125);
  });
  await t.test('invalid purchases and lots cannot change persisted holdings', async () => {
    for (const change of [{ quantity: -1 }, { quantity: 0 }, { quantity: 'invalid' }, { averagePrice: -10 }, { averagePrice: null }, { date: 'not-a-date' }]) {
      assert.equal((await request('', { method: 'POST', body: { ...purchase, ...change } })).status, 400);
    }
    assert.equal((await request(`/${id}`, { method: 'PUT', body: { lots: [{ quantity: -1, price: 100 }, { quantity: 5, price: 100 }] } })).status, 400);
    assert.equal((await request(`/${id}`, { method: 'PUT', body: { lots: [{ quantity: 4, price: -100 }] } })).status, 400);
    assert.equal((await request(`/${id}`, { method: 'PUT', body: { lots: [] } })).status, 400);
    assert.equal((await request('')).data.find(p => p._id === id).quantity, 4);
  });
  await t.test('aggregate-only updates are explicit and legacy holdings remain editable', async () => {
    assert.equal((await request(`/${id}`, { method: 'PUT', body: { quantity: 99 } })).status, 400);
    assert.equal((await request('')).data.find(p => p._id === id).quantity, 4);
    const legacy = await Position.create({ user: fixture.users[0]._id, symbol: 'MSFT', name: 'QA legacy', quantity: 2, averagePrice: 100, lots: [] });
    const result = await request(`/${legacy._id}`, { method: 'PUT', body: { quantity: 3, averagePrice: 75 } });
    assert.equal(result.status, 200);
    assert.equal(result.data.quantity, 3);
    assert.equal(result.data.averagePrice, 75);
    assert.equal((await request(`/${legacy._id}`, { method: 'DELETE' })).status, 200);
  });
  await t.test('deletion persists and does not affect another broker', async () => {
    assert.equal((await request(`/${id}`, { method: 'DELETE' })).status, 200);
    const remaining = (await request('')).data;
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].broker, 'Other QA Broker');
  });
});
