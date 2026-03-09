/**
 * Global Proxy Utility — ScrapingAnt integration for TASE API
 * 
 * Key design decisions for Vercel (30s max):
 * - NO jitter delays (mutex ensures serialization)
 * - NO browser=true (raw mode is 2-5x faster) 
 * - Short backoff (2s, max 2 retries)
 * - Minimal post-release delay (200ms)
 */

let proxyLockBusy = false;
let proxyLockQueue = [];

function acquireProxyLock() {
    return new Promise((resolve) => {
        if (!proxyLockBusy) {
            proxyLockBusy = true;
            resolve();
        } else {
            proxyLockQueue.push(resolve);
        }
    });
}

function releaseProxyLock() {
    if (proxyLockQueue.length > 0) {
        const next = proxyLockQueue.shift();
        // Small delay to let the previous connection fully close
        setTimeout(() => next(), 200);
    } else {
        proxyLockBusy = false;
    }
}

/**
 * Make a request through ScrapingAnt proxy (if PROXY_API_KEY is set)
 * or directly if no proxy key is configured.
 * 
 * Features:
 * - Global mutex lock (only 1 proxy request at a time)
 * - Exponential backoff on 409/429 (max 2 retries, 2s delay)
 * - No browser rendering mode (fast raw fetch)
 */
export const makeProxyRequest = async (targetUrl, method, headers, body) => {
    const proxyApiKey = process.env.PROXY_API_KEY;

    // No proxy key → direct request
    if (!proxyApiKey) {
        console.log(`[Proxy] No PROXY_API_KEY set, making direct request to ${targetUrl}`);
        const options = { method, headers };
        if (body) options.body = body;
        return fetch(targetUrl, options);
    }

    // Acquire the global lock — ensures only 1 ScrapingAnt request in-flight
    await acquireProxyLock();
    const startTime = Date.now();

    try {
        // Build ScrapingAnt URL — NO browser=true (saves 10-15s!), timeout=15s
        const scrapingAntUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(targetUrl)}&x-api-key=${proxyApiKey}&timeout=15`;

        const proxyHeaders = {};
        for (const [key, value] of Object.entries(headers)) {
            proxyHeaders[`Ant-${key}`] = value;
        }

        const options = { method, headers: proxyHeaders };
        if (body) {
            options.body = body;
            options.method = 'POST';
        }

        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`[Proxy] Attempt ${attempt}/${maxAttempts} → ${method} ${targetUrl}`);

            const res = await fetch(scrapingAntUrl, options);

            if (res.status === 409 || res.status === 429) {
                if (attempt < maxAttempts) {
                    const backoff = attempt * 2000; // 2s, then 4s
                    console.warn(`[Proxy] Concurrency error ${res.status}. Backoff ${backoff}ms...`);
                    await new Promise(r => setTimeout(r, backoff));
                    continue;
                }
                console.error(`[Proxy] All ${maxAttempts} attempts failed with ${res.status}`);
                return res;
            }

            const elapsed = Date.now() - startTime;
            console.log(`[Proxy] Response ${res.status} in ${elapsed}ms`);
            return res;
        }
    } finally {
        releaseProxyLock();
    }
};
