import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { createFixtureServer } from '../support/fixtureServer.js';
import PushConfig from '../../server/models/PushConfig.js';
import PushSubscription from '../../server/models/PushSubscription.js';
import PushDelivery from '../../server/models/PushDelivery.js';
import AlertRule from '../../server/models/AlertRule.js';
import Position from '../../server/models/Position.js';
import { projectPendingPush, flushPushQueue, getPushConfig } from '../../server/services/webPush.js';

function subscription(name) {
    const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
    return { endpoint: `https://fcm.googleapis.com/fcm/send/qa-${name}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
}
test('push enrollment, private config, delivery, retries and account separation persist', async t => {
    const fixture = await createFixtureServer(); t.after(() => fixture.close());
    const request = async (path, body, user = 0, method = 'POST') => {
        const r = await fetch(fixture.baseUrl + '/api' + path, { method, headers: { ...(user === null ? {} : { Authorization: `Bearer ${fixture.tokens[user]}` }), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: r.status, data: await r.json() };
    };
    const one = subscription('one'), other = subscription('other');
    await t.test('only signed-in callers can enroll, config is durable and never exposes its private key', async () => {
        assert.equal((await request('/push/config', null, null, 'GET')).status, 401);
        const results = await Promise.all(Array.from({ length: 4 }, () => request('/push/config', null, 0, 'GET')));
        assert.ok(results.every(r => r.status === 200 && r.data.publicKey === results[0].data.publicKey));
        assert.deepEqual(Object.keys(results[0].data), ['publicKey', 'backgroundChecks']);
        assert.equal(results[0].data.backgroundChecks, false);
        assert.equal(await PushConfig.countDocuments(), 1);
        assert.equal((await PushConfig.findById('vapid-v1').lean()).privateKey, undefined);
        const persisted = await getPushConfig(); assert.ok(persisted.privateKey);
        await PushConfig.updateOne({ _id: 'vapid-v1' }, { $set: { lastWorkerAt: new Date() } });
        assert.equal((await request('/push/config', null, 0, 'GET')).data.backgroundChecks, true);
        for (const endpoint of ['https://127.0.0.1/x', 'http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.test/x', 'https://user:pass@fcm.googleapis.com/x', 'https://fcm.googleapis.com:4430/x']) {
            assert.equal((await request('/push/subscriptions', { subscription: { ...one, endpoint } })).status, 400);
        }
        assert.equal((await request('/push/subscriptions', { subscription: one, language: 'he' })).status, 201);
        assert.equal((await request('/push/subscriptions', { subscription: other }, 1)).status, 201);
        assert.equal((await request('/push/status', { endpoint: one.endpoint }, 1)).data.subscribed, false);
    });
    let ruleId;
    await t.test('an actual rule check sends only to its owner, pauses once and retains a delivery record', async () => {
        await Position.create({ user: fixture.users[0]._id, symbol: 'AAPL', name: 'QA', quantity: 1, averagePrice: 100 });
        const rule = await request('/alerts', { symbol: 'AAPL', kind: 'price_above', threshold: 149 }); ruleId = rule.data._id;
        const check = await request('/alerts/check'); assert.equal(check.data.triggered.length, 1);
        assert.equal(fixture.pushMessages.length, 1); assert.equal(fixture.pushMessages[0].endpoint, one.endpoint);
        assert.equal(fixture.pushMessages[0].payload.language, 'he');
        assert.equal((await PushDelivery.findOne()).state, 'sent');
        assert.equal((await AlertRule.findById(ruleId).lean()).pushEvent, undefined);
        await request('/alerts/check'); assert.equal(fixture.pushMessages.length, 1);
        assert.equal((await request('/push/test', { endpoint: one.endpoint }, 1)).status, 429);
        assert.equal((await request('/push/test', { endpoint: one.endpoint })).status, 200);
        assert.equal((await request('/push/test', { endpoint: one.endpoint })).status, 429);
    });
    await t.test('pending events survive projection failure and concurrent dispatchers do not double-send', async () => {
        await AlertRule.findByIdAndUpdate(ruleId, { pushEvent: 'durable-event' });
        await Promise.all([projectPendingPush(), projectPendingPush()]);
        assert.equal(await PushDelivery.countDocuments({ eventKey: 'durable-event' }), 1);
        let delivered = 0;
        await Promise.all([flushPushQueue({ sender: async () => { delivered++; } }), flushPushQueue({ sender: async () => { delivered++; } })]);
        assert.equal(delivered, 1);
    });
    await t.test('temporary failures retry, expired endpoints are removed and one account cannot delete another device', async () => {
        await AlertRule.findByIdAndUpdate(ruleId, { pushEvent: 'retry-event' }); await projectPendingPush();
        await flushPushQueue({ sender: async () => { throw Object.assign(Error('temporary'), { statusCode: 503 }); } });
        let job = await PushDelivery.findOne({ eventKey: 'retry-event' }); assert.equal(job.state, 'pending'); assert.equal(job.attempts, 1);
        assert.ok(job.nextAttemptAt.getTime() > Date.now());
        await PushDelivery.updateOne({ _id: job._id }, { $set: { nextAttemptAt: new Date(0) } });
        await flushPushQueue({ sender: async () => { throw Object.assign(Error('gone'), { statusCode: 410 }); } });
        assert.equal((await PushDelivery.findById(job._id)).state, 'failed');
        assert.equal((await request('/push/status', { endpoint: one.endpoint })).data.subscribed, false);
        await request('/push/subscriptions', { subscription: one });
        await request('/push/subscriptions', { endpoint: one.endpoint }, 1, 'DELETE');
        assert.equal((await request('/push/status', { endpoint: one.endpoint })).data.subscribed, true);
    });
    await t.test('switching accounts invalidates pending deliveries from the old account', async () => {
        await AlertRule.findByIdAndUpdate(ruleId, { pushEvent: 'old-account-event' }); await projectPendingPush();
        await request('/push/subscriptions', { subscription: one }, 1);
        assert.equal((await request('/push/status', { endpoint: one.endpoint })).data.subscribed, false);
        let delivered = 0; await flushPushQueue({ sender: async () => { delivered++; } }); assert.equal(delivered, 0);
        assert.equal((await PushDelivery.findOne({ eventKey: 'old-account-event' })).state, 'failed');
        await request('/push/subscriptions', { endpoint: one.endpoint }, 1, 'DELETE');
        assert.equal(await PushSubscription.countDocuments({ user: fixture.users[1]._id }), 1);
    });
});
