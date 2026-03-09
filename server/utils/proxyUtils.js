/**
 * Global Proxy Utility — ScrapingAnt integration for TASE API
 * 
 * ScrapingAnt Free Tier: Concurrency=1, 10k credits
 * browser=true costs 10 credits but is REQUIRED for Incapsula WAF
 * 
 * Safety:
 * - try/finally guarantees lock release
 * - 45s AbortController timeout prevents hangs
 * - Lock acquisition timeout (15s) prevents deadlock
 * - 5s backoff on 409 (ScrapingAnt needs time to free the slot)
 * - Verbose [LOCK] and [Proxy] logging
 */

let proxyLockBusy = false;
let proxyLockQueue = [];

function acquireProxyLock(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        console.log(`[LOCK] Acquiring... (busy=${proxyLockBusy}, queue=${proxyLockQueue.length})`);

        if (!proxyLockBusy) {
            proxyLockBusy = true;
            console.log(`[LOCK] Acquired immediately`);
            resolve();
            return;
        }

        const timer = setTimeout(() => {
            const idx = proxyLockQueue.indexOf(wrappedResolve);
            if (idx > -1) proxyLockQueue.splice(idx, 1);
            console.error(`[LOCK] Acquisition timed out after ${timeoutMs}ms — forcing reset`);
            proxyLockBusy = false;
            proxyLockQueue = [];
            reject(new Error('Proxy lock acquisition timed out'));
        }, timeoutMs);

        const wrappedResolve = () => {
            clearTimeout(timer);
            console.log(`[LOCK] Acquired from queue`);
            resolve();
        };

        proxyLockQueue.push(wrappedResolve);
    });
}

function releaseProxyLock() {
    console.log(`[LOCK] Releasing... (queue=${proxyLockQueue.length})`);
    if (proxyLockQueue.length > 0) {
        const next = proxyLockQueue.shift();
        // 500ms delay between releases to ensure ScrapingAnt frees the slot
        setTimeout(() => next(), 500);
    } else {
        proxyLockBusy = false;
    }
    console.log(`[LOCK] Released`);
}

/**
 * Make a single request through ScrapingAnt proxy.
 * ALWAYS uses browser=true (Incapsula requires it).
 * Retries once on 409 with 5s backoff.
 * 45s emergency abort timeout.
 */
export const makeProxyRequest = async (targetUrl, method, headers, body) => {
    const proxyApiKey = process.env.PROXY_API_KEY;

    // No proxy key → direct request
    if (!proxyApiKey) {
        console.log(`[Proxy] No PROXY_API_KEY, direct request → ${targetUrl}`);
        const opts = { method, headers };
        if (body) opts.body = body;
        return fetch(targetUrl, opts);
    }

    // Acquire lock
    let lockAcquired = false;
    try {
        await acquireProxyLock(15000);
        lockAcquired = true;
    } catch (lockErr) {
        console.error(`[Proxy] Lock failed: ${lockErr.message}. Proceeding anyway...`);
    }

    const startTime = Date.now();

    try {
        // ALWAYS browser=true — Incapsula blocks without it (423 error)
        const scrapingAntUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(targetUrl)}&x-api-key=${proxyApiKey}&browser=true&timeout=25`;

        console.log(`[Proxy] Target: ${method} ${targetUrl}`);

        // Prefix all headers with Ant-
        const proxyHeaders = {};
        for (const [key, value] of Object.entries(headers)) {
            proxyHeaders[`Ant-${key}`] = value;
        }

        const fetchOptions = { method, headers: proxyHeaders };
        if (body) {
            fetchOptions.body = body;
            fetchOptions.method = 'POST';
        }

        // 45s emergency timeout
        const controller = new AbortController();
        const emergencyTimer = setTimeout(() => {
            console.error(`[Proxy] EMERGENCY ABORT: 45s exceeded`);
            controller.abort();
        }, 45000);
        fetchOptions.signal = controller.signal;

        // Try up to 2 attempts with 5s backoff on 409
        for (let attempt = 1; attempt <= 2; attempt++) {
            console.log(`[Proxy] Attempt ${attempt}/2 @ ${Date.now() - startTime}ms`);

            try {
                const res = await fetch(scrapingAntUrl, fetchOptions);
                clearTimeout(emergencyTimer);

                if (res.status === 409 || res.status === 429) {
                    if (attempt < 2) {
                        console.warn(`[Proxy] 409 concurrency error. Waiting 5s before retry...`);
                        await new Promise(r => setTimeout(r, 5000));
                        continue;
                    }
                    console.error(`[Proxy] 409 persists after retry`);
                }

                console.log(`[Proxy] Done: status=${res.status} elapsed=${Date.now() - startTime}ms`);
                return res;
            } catch (fetchErr) {
                clearTimeout(emergencyTimer);
                if (fetchErr.name === 'AbortError') {
                    console.error(`[Proxy] Aborted after 45s`);
                    return {
                        ok: false,
                        status: 504,
                        statusText: 'Proxy Timeout',
                        headers: new Headers(),
                        text: async () => JSON.stringify({ error: 'Proxy timed out after 45s' }),
                        json: async () => ({ error: 'Proxy timed out after 45s' })
                    };
                }
                console.error(`[Proxy] Fetch error: ${fetchErr.message}`);
                throw fetchErr;
            }
        }
    } finally {
        if (lockAcquired) {
            releaseProxyLock();
        } else {
            console.log(`[LOCK] Skip release (not acquired)`);
        }
    }
};
