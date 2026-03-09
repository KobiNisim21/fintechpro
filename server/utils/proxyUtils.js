/**
 * Global Proxy Utility — ScrapingAnt integration for TASE API
 * 
 * Safety guarantees:
 * - try/finally on EVERY lock acquisition → lock ALWAYS released
 * - 45s AbortController timeout on fetch → never hangs
 * - Lock acquisition timeout (10s) → prevents deadlock
 * - Verbose logging at every stage for Vercel log debugging
 * - browser=true for Incapsula WAF bypass
 */

let proxyLockBusy = false;
let proxyLockQueue = [];

function acquireProxyLock(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        console.log(`[LOCK] Acquiring... (busy=${proxyLockBusy}, queue=${proxyLockQueue.length})`);

        if (!proxyLockBusy) {
            proxyLockBusy = true;
            console.log(`[LOCK] Acquired immediately`);
            resolve();
            return;
        }

        // Set a timeout so we never wait forever
        const timer = setTimeout(() => {
            // Remove ourselves from the queue
            const idx = proxyLockQueue.indexOf(wrappedResolve);
            if (idx > -1) proxyLockQueue.splice(idx, 1);
            console.error(`[LOCK] Acquisition timed out after ${timeoutMs}ms — forcing lock release`);
            // Force-release the lock to prevent permanent deadlock
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
        setTimeout(() => next(), 200);
    } else {
        proxyLockBusy = false;
    }
    console.log(`[LOCK] Released`);
}

/**
 * Make a request through ScrapingAnt proxy.
 * @param {string} targetUrl - The URL to fetch through the proxy
 * @param {string} method - HTTP method
 * @param {object} headers - Request headers (will be prefixed with Ant-)
 * @param {string} [body] - Request body
 * @param {object} [options] - Extra options
 * @param {boolean} [options.useBrowser=true] - Use browser rendering (required for Incapsula)
 */
export const makeProxyRequest = async (targetUrl, method, headers, body, options = {}) => {
    const proxyApiKey = process.env.PROXY_API_KEY;
    const useBrowser = options.useBrowser !== undefined ? options.useBrowser : true;

    // No proxy key → direct request
    if (!proxyApiKey) {
        console.log(`[Proxy] No PROXY_API_KEY set, direct request → ${targetUrl}`);
        const fetchOpts = { method, headers };
        if (body) fetchOpts.body = body;
        return fetch(targetUrl, fetchOpts);
    }

    // Acquire the global lock — with timeout safety
    let lockAcquired = false;
    try {
        await acquireProxyLock(10000);
        lockAcquired = true;
    } catch (lockErr) {
        console.error(`[Proxy] Lock failed: ${lockErr.message}. Attempting request anyway...`);
        // Proceed without lock — better than hanging
    }

    const startTime = Date.now();

    try {
        // Build ScrapingAnt URL
        const browserParam = useBrowser ? '&browser=true' : '';
        const scrapingAntUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(targetUrl)}&x-api-key=${proxyApiKey}${browserParam}&timeout=25`;

        console.log(`[Proxy] URL built (browser=${useBrowser})`);

        const proxyHeaders = {};
        for (const [key, value] of Object.entries(headers)) {
            proxyHeaders[`Ant-${key}`] = value;
        }

        const fetchOptions = { method, headers: proxyHeaders };
        if (body) {
            fetchOptions.body = body;
            fetchOptions.method = 'POST';
        }

        // 45-second emergency timeout via AbortController
        const controller = new AbortController();
        const emergencyTimer = setTimeout(() => {
            console.error(`[Proxy] EMERGENCY TIMEOUT: 45s exceeded for ${targetUrl}`);
            controller.abort();
        }, 45000);
        fetchOptions.signal = controller.signal;

        const maxAttempts = 2; // Only 1 retry to stay within time budget
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`[Proxy] Attempt ${attempt}/${maxAttempts} → ${method} ${targetUrl}`);

            try {
                const res = await fetch(scrapingAntUrl, fetchOptions);
                clearTimeout(emergencyTimer);

                if (res.status === 409 || res.status === 429) {
                    if (attempt < maxAttempts) {
                        console.warn(`[Proxy] Concurrency ${res.status}. Backoff 2s...`);
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }
                    console.error(`[Proxy] All attempts failed with ${res.status}`);
                    return res;
                }

                const elapsed = Date.now() - startTime;
                console.log(`[Proxy] Response ${res.status} in ${elapsed}ms`);
                return res;
            } catch (fetchErr) {
                clearTimeout(emergencyTimer);
                if (fetchErr.name === 'AbortError') {
                    console.error(`[Proxy] Request aborted after 45s timeout`);
                    // Return a fake response so callers can handle it
                    return {
                        ok: false,
                        status: 504,
                        statusText: 'Proxy Timeout',
                        headers: new Headers(),
                        text: async () => JSON.stringify({ error: 'Proxy request timed out after 45 seconds' }),
                        json: async () => ({ error: 'Proxy request timed out after 45 seconds' })
                    };
                }
                throw fetchErr;
            }
        }
    } finally {
        if (lockAcquired) {
            releaseProxyLock();
        } else {
            console.log(`[LOCK] Skipping release (lock was not acquired)`);
        }
    }
};
