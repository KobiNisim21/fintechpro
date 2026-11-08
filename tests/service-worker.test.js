import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

function worker(fetch) {
  const handlers = {};
  const cached = new Response('offline shell');
  const writes = [];
  vm.runInNewContext(code, {
    self: { location: { origin: 'https://example.test' }, addEventListener: (name, handler) => { handlers[name] = handler; } },
    URL, Response, fetch,
    caches: { open: async () => ({ put: async (...args) => writes.push(args) }), match: async () => cached },
  });
  return { handlers, writes };
}

test('navigation retrieves deployed HTML first and keeps an offline fallback', async () => {
  const online = worker(async () => new Response('new deployed shell'));
  let response;
  online.handlers.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://example.test/' }, respondWith: value => { response = value; } });
  assert.equal(await (await response).text(), 'new deployed shell');
  assert.equal(online.writes.length, 1);
  const offline = worker(async () => { throw new Error('offline'); });
  offline.handlers.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://example.test/' }, respondWith: value => { response = value; } });
  assert.equal(await (await response).text(), 'offline shell');
});

test('service worker never caches authenticated API or external requests', () => {
  const { handlers } = worker(() => assert.fail('unexpected fetch'));
  for (const path of ['https://example.test/api/positions', 'https://example.test/socket.io/', 'https://accounts.google.com/']) {
    handlers.fetch({ request: { method: 'GET', url: path }, respondWith: () => assert.fail('must not intercept') });
  }
});
