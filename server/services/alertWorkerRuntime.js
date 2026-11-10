import { createServer } from 'node:http';

// A dedicated worker runs independently of browser sessions, sockets and the API host.
export function createAlertWorkerRuntime({ connect, poll, connected, now = Date.now, intervalMs = 60000, onError = () => {} }) {
    let lastSuccess = null, timer = null, inFlight = null, stopping = false;
    const tick = () => {
        if (stopping || inFlight) return inFlight || Promise.resolve();
        inFlight = (async () => {
            try { await connect(); await poll(); lastSuccess = now(); }
            catch { onError(); }
        })().finally(() => { inFlight = null; });
        return inFlight;
    };
    const health = () => ({
        status: !stopping && connected() && lastSuccess !== null && now() - lastSuccess < 180000 ? 'ok' : 'degraded',
        role: 'personal-alert-worker',
        lastCheckedAt: lastSuccess === null ? null : new Date(lastSuccess).toISOString(),
    });
    return {
        tick, health,
        start() { if (timer || stopping) return; void tick(); timer = setInterval(() => void tick(), intervalMs); },
        async stop() { stopping = true; if (timer) clearInterval(timer); timer = null; await inFlight; },
    };
}

export function createAlertWorkerServer(runtime) {
    return createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'GET' && req.url === '/api/live') { res.end(JSON.stringify({ status: 'ok', role: 'personal-alert-worker' })); return; }
        if (req.method === 'GET' && req.url === '/api/health') {
            const health = runtime.health(); res.statusCode = health.status === 'ok' ? 200 : 503;
            res.end(JSON.stringify(health)); return;
        }
        res.statusCode = 404; res.end(JSON.stringify({ message: 'Not found' }));
    });
}
