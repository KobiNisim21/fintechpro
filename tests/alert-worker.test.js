import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createAlertWorkerRuntime, createAlertWorkerServer } from '../server/services/alertWorkerRuntime.js';

test('standalone alert worker checks without sockets and health rejects an unready or stale worker', async t => {
    let time = 1000, databaseConnected = false, checks = 0;
    const runtime = createAlertWorkerRuntime({ now: () => time, connected: () => databaseConnected,
        connect: async () => { databaseConnected = true; }, poll: async () => { checks++; } });
    const server = createAlertWorkerServer(runtime);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { await runtime.stop(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(url + '/api/live')).status, 200);
    assert.equal((await fetch(url + '/api/health')).status, 503);
    await runtime.tick(); assert.equal(checks, 1);
    const health = await fetch(url + '/api/health'); assert.equal(health.status, 200);
    assert.equal((await health.json()).role, 'personal-alert-worker');
    time += 180001; assert.equal((await fetch(url + '/api/health')).status, 503);
    await runtime.tick(); assert.equal((await fetch(url + '/api/health')).status, 200);
    databaseConnected = false; assert.equal((await fetch(url + '/api/health')).status, 503);
    assert.equal((await fetch(url + '/api/push/config')).status, 404);
});

test('worker coalesces overlapping checks, retries failures and stops further work', async () => {
    let release, calls = 0, errors = 0;
    const gate = new Promise(resolve => { release = resolve; });
    const runtime = createAlertWorkerRuntime({ connect: async () => {}, connected: () => true,
        poll: async () => { calls++; if (calls === 1) { await gate; throw Error('temporary outage'); } }, onError: () => errors++ });
    const first = runtime.tick(), overlap = runtime.tick();
    await Promise.resolve(); assert.equal(calls, 1);
    release(); await Promise.all([first, overlap]); assert.equal(errors, 1); assert.equal(runtime.health().status, 'degraded');
    await runtime.tick(); assert.equal(calls, 2); assert.equal(runtime.health().status, 'ok');
    await runtime.stop(); await runtime.tick(); assert.equal(calls, 2); assert.equal(runtime.health().status, 'degraded');
});

test('started worker polls every minute without a browser and shutdown cancels the schedule', async t => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    let checks = 0;
    const runtime = createAlertWorkerRuntime({ connect: async () => {}, connected: () => true, poll: async () => { checks++; } });
    t.after(() => runtime.stop());
    runtime.start(); await nextTurn(); assert.equal(checks, 1);
    t.mock.timers.tick(60000); await nextTurn(); assert.equal(checks, 2);
    await runtime.stop(); t.mock.timers.tick(60000); await nextTurn(); assert.equal(checks, 2);
});
