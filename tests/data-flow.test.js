import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { resolvePriceDetails } from '../src/lib/priceDetails.ts';
import { RequestCache } from '../src/lib/requestCache.ts';
import { PriceStreamService } from '../src/services/priceStream.ts';
import { startWhenDatabaseReady } from '../server/services/startup.js';

const tick = () => new Promise(resolve => setImmediate(resolve));

test('background workers wait for the database, retry failure, and stop during shutdown', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let starts = 0, failures = 0, attempts = 0;
  const stop = startWhenDatabaseReady({
    connect: async () => { if (++attempts === 1) throw new Error('offline'); },
    start: () => starts++,
    onError: () => failures++,
    retryMs: 100,
  });
  assert.equal(starts, 0);
  await tick();
  assert.equal(failures, 1);
  t.mock.timers.tick(100);
  await tick();
  assert.equal(starts, 1);
  stop();
  t.mock.timers.tick(1000);
  assert.equal(starts, 1);

  let resolveConnection;
  const stopPending = startWhenDatabaseReady({
    connect: () => new Promise(resolve => { resolveConnection = resolve; }),
    start: () => starts++,
  });
  stopPending();
  resolveConnection();
  await tick();
  assert.equal(starts, 1);
});

test('price failure retains an explicitly stale quote and never presents purchase cost as market data', () => {
  const previous = { price: 120, priceSource: 'Yahoo Finance', priceUpdatedAt: '2026-11-06T15:00:00Z', priceStatus: 'available' };
  assert.deepEqual(resolvePriceDetails(undefined, previous, 75), { ...previous, priceStatus: 'stale' });
  assert.equal(resolvePriceDetails({ regularMarketPrice: NaN }, undefined, 75).priceStatus, 'estimated');
  assert.equal(resolvePriceDetails({ regularMarketPrice: 0 }, undefined, 75).price, 75);
  assert.equal(resolvePriceDetails(undefined, { price: 75, priceStatus: 'estimated' }, 80).price, 80);
});

test('quote timestamps and provider cache status survive normalization', () => {
  const details = resolvePriceDetails({ regularMarketPrice: 100, regularMarketTime: 1700000000, source: 'Funder', fromCache: true }, undefined, 50);
  assert.equal(details.priceUpdatedAt, '2023-11-14T22:13:20.000Z');
  assert.equal(details.priceSource, 'Funder');
  assert.equal(details.priceStatus, 'cached');
  assert.equal(resolvePriceDetails({ regularMarketPrice: 100, stale: true }, undefined, 50).priceStatus, 'stale');
});

test('concurrent market requests share work and rejected requests can retry', async () => {
  const cache = new RequestCache();
  let calls = 0;
  const fetch = async () => { calls++; return { rate: 3.5 }; };
  const [one, two] = await Promise.all([cache.get('forex', fetch, 1000), cache.get('forex', fetch, 1000)]);
  assert.equal(calls, 1);
  assert.equal(one, two);
  await assert.rejects(cache.get('failed', async () => { throw new Error('offline'); }, 1000));
  assert.equal(await cache.get('failed', async () => 42, 1000), 42);
  cache.clear();
  await cache.get('forex', fetch, 1000);
  assert.equal(calls, 2);
});

test('market request cache expires instead of indefinitely serving old rates', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000 });
  const cache = new RequestCache();
  let rate = 3.5;
  assert.equal(await cache.get('rate', async () => rate, 1000), 3.5);
  rate = 3.6;
  t.mock.timers.setTime(2001);
  assert.equal(await cache.get('rate', async () => rate, 1000), 3.6);
});

class FakeSocket extends EventEmitter {
  connected = false;
  sent = [];
  emit(event, ...args) {
    if (event.endsWith('prices')) this.sent.push({ event, ...args[0] });
    return super.emit(event, ...args);
  }
}

test('price stream recovers from a missing socket, resubscribes on reconnect, and removes only its listeners', () => {
  let socket = null;
  const stream = new PriceStreamService(() => socket);
  stream.connect();
  socket = new FakeSocket();
  const unrelated = () => {};
  socket.on('price-update', unrelated);
  stream.connect();
  stream.connect();
  stream.subscribeToSymbol('AAPL');
  stream.subscribeToSymbol('AAPL');
  socket.connected = true;
  socket.emit('connect');
  socket.emit('connect');
  assert.equal(socket.sent.length, 2);
  assert.deepEqual(socket.sent[1].symbols, ['AAPL']);
  const updates = [];
  stream.onPriceUpdate((...args) => updates.push(args));
  socket.emit('price-update', { symbol: 'AAPL', price: 120, timestamp: 1700000000 });
  socket.emit('price-update', { symbol: 'AAPL', price: NaN, timestamp: 1700000001 });
  assert.deepEqual(updates, [['AAPL', 120, 1700000000]]);
  stream.disconnect();
  assert.equal(socket.listenerCount('price-update'), 1);
  assert.equal(socket.listenerCount('connect'), 0);
});
