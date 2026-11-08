import { test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../server/app.js';
import { getBatchHistory } from '../server/controllers/stocksController.js';

test('HTTP health distinguishes liveness from database readiness without opening a DB connection', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const live = await fetch(`${base}/api/live`);
    assert.equal(live.status, 200);
    const ready = await fetch(`${base}/api/health`);
    assert.equal(ready.status, 503);
    assert.equal((await ready.json()).db, 'disconnected');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

async function batch(query) {
  const result = { status: 200, data: null };
  await getBatchHistory({ query }, {
    status(code) { result.status = code; return this; },
    json(data) { result.data = data; return this; },
  });
  return result;
}

test('history API rejects invalid ranges and oversized requests before contacting providers', async () => {
  assert.equal((await batch({ symbols: 'AAPL', from: '2', to: '1' })).status, 400);
  assert.equal((await batch({ symbols: ['AAPL'], from: '1', to: '2' })).status, 400);
  assert.equal((await batch({ symbols: Array.from({ length: 51 }, (_, i) => `SYM${i}`).join(','), from: '1', to: '2' })).status, 400);
});

test('history API deduplicates funds and explicitly reports unavailable fund history', async () => {
  const result = await batch({ symbols: 'FUND:5136866,FUND:5136866', from: '1', to: '2' });
  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.data), ['FUND:5136866']);
  assert.equal(result.data['FUND:5136866'].s, 'no_data');
});
