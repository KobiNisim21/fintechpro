import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as webpush from 'web-push';
import ts from 'typescript';
import { validPushSubscription, pushPayload } from '../server/services/webPush.js';
import alertScheduler from '../server/services/alertScheduler.js';

function device(endpoint = 'https://web.push.apple.com/qa') {
    const key = createECDH('prime256v1'); key.generateKeys();
    return { endpoint, keys: { p256dh: key.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
}
test('push subscriptions accept known browser services and reject private or malformed destinations', () => {
    for (const endpoint of ['https://web.push.apple.com/qa', 'https://fcm.googleapis.com/fcm/send/qa', 'https://updates.push.services.mozilla.com/wpush/v2/qa']) assert.equal(validPushSubscription(device(endpoint)), true);
    for (const endpoint of ['http://web.push.apple.com/qa', 'https://localhost/qa', 'https://127.0.0.1/qa', 'https://web.push.apple.com.evil.test/qa', 'https://web.push.apple.com:8443/qa']) assert.equal(validPushSubscription(device(endpoint)), false);
    assert.equal(validPushSubscription({ endpoint: 'https://web.push.apple.com/qa', keys: { p256dh: 'bad', auth: 'bad' } }), false);
});
test('push payload is localized, contains no portfolio amounts, and encrypts with real Web Push keys', () => {
    const payload = pushPayload('he', { symbol: 'GOOG', eventKey: 'event', lastValue: 123.45 });
    assert.equal(payload.language, 'he'); assert.ok(payload.body.includes('GOOG')); assert.ok(!JSON.stringify(payload).includes('123.45'));
    const keys = webpush.generateVAPIDKeys();
    const request = webpush.generateRequestDetails(device(), JSON.stringify(payload), { vapidDetails: { subject: 'https://example.test', publicKey: keys.publicKey, privateKey: keys.privateKey } });
    assert.equal(request.headers['Content-Encoding'], 'aes128gcm'); assert.ok(request.body.length > 0);
    assert.ok(!request.body.toString().includes(payload.body));
});
test('service worker shows a visible push and opens only its own alerts screen', async () => {
    const handlers = {}, shown = [], opened = [];
    vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
        URL, self: { location: { origin: 'https://example.test' }, addEventListener: (name, fn) => handlers[name] = fn,
            registration: { showNotification: async (...args) => shown.push(args) }, clients: { matchAll: async () => [], openWindow: async url => opened.push(url) } },
    });
    let pending;
    handlers.push({ data: { json: () => pushPayload('he', { symbol: 'GOOG', eventKey: 'one' }) }, waitUntil: p => pending = p }); await pending;
    assert.equal(shown[0][1].dir, 'rtl'); assert.equal(shown[0][1].tag, 'personal-one');
    handlers.push({ data: { json: () => { throw Error('bad payload'); } }, waitUntil: p => pending = p }); await pending;
    assert.ok(shown[1][1].body);
    handlers.notificationclick({ notification: { data: { url: 'https://evil.test/' }, close() {} }, waitUntil: p => pending = p }); await pending;
    assert.deepEqual(opened, ['https://example.test/?panel=alerts']);
});
test('install flow captures the deferred prompt, honors dismissal and detects iPad Home Screen prerequisites', async () => {
    const handlers = {};
    const source = readFileSync(new URL('../src/lib/pwa.ts', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const exports = {};
    vm.runInNewContext(code, { exports, window: { addEventListener: (name, fn) => handlers[name] = fn }, Set });
    assert.equal(exports.isAppleMobile('desktop Safari', 'MacIntel', 5), true);
    assert.equal(exports.isAppleMobile('Android Chrome', 'Linux', 5), false);
    let prompted = 0, prevented = 0;
    handlers.beforeinstallprompt({ preventDefault: () => prevented++, prompt: async () => { prompted++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    assert.equal(await exports.installApp(), 'dismissed'); assert.equal(prompted, 1); assert.equal(prevented, 1);
    assert.equal(exports.getInstallPrompt(), null); assert.equal(await exports.installApp(), null);
});

test('external alert scheduler refuses absent or incorrect credentials before touching the database', async t => {
    const previous = process.env.CRON_SECRET;
    t.after(() => { if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous; });
    const response = { code: 0, status(code) { this.code = code; return this; }, json(value) { this.value = value; return this; } };
    delete process.env.CRON_SECRET;
    await alertScheduler({ headers: {} }, response); assert.equal(response.code, 503);
    process.env.CRON_SECRET = 'synthetic-test-secret';
    await alertScheduler({ headers: { authorization: 'Bearer wrong' } }, response); assert.equal(response.code, 401);
    await alertScheduler({ headers: { authorization: ['unexpected'] } }, response); assert.equal(response.code, 401);
});

test('installable manifest and Apple touch icons have real square bitmap sizes', () => {
    const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
    for (const icon of manifest.icons) {
        const bytes = readFileSync(new URL(`../public${icon.src}`, import.meta.url));
        const size = Number(icon.sizes.split('x')[0]);
        assert.equal(bytes.readUInt32BE(16), size); assert.equal(bytes.readUInt32BE(20), size);
    }
    const apple = readFileSync(new URL('../public/pwa-icon-180.png', import.meta.url));
    assert.equal(apple.readUInt32BE(16), 180); assert.equal(apple.readUInt32BE(20), 180);
    assert.equal(manifest.id, '/'); assert.equal(manifest.scope, '/');
});
