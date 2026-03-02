let scrapingAntLock = false;

export const acquireProxyLock = async () => {
    while (scrapingAntLock) {
        // Wait 100ms and check again
        await new Promise(r => setTimeout(r, 100));
    }
    scrapingAntLock = true;
};

export const releaseProxyLock = () => {
    scrapingAntLock = false;
};

export const makeProxyRequest = async (targetUrl, method, headers, body) => {
    const proxyApiKey = process.env.PROXY_API_KEY;
    if (!proxyApiKey) {
        return fetch(targetUrl, { method, headers, body });
    }

    // Randomized Jitter Delay: 2 to 4 seconds to prevent exact ms collisions before lock
    const jitter = Math.floor(Math.random() * 2000) + 2000;
    console.log(`[Proxy] Applying jitter delay of ${jitter}ms...`);
    await new Promise(r => setTimeout(r, jitter));

    await acquireProxyLock();
    try {
        const scrapingAntUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(targetUrl)}&x-api-key=${proxyApiKey}&browser=true`;

        const proxyHeaders = {};
        for (const [key, value] of Object.entries(headers)) {
            proxyHeaders[`Ant-${key}`] = value;
        }

        const options = { method, headers: proxyHeaders };
        if (body) {
            options.body = body;
            options.method = 'POST'; // ScrapingAnt requires POST for sending body
        }

        let attempt = 0;
        const maxAttempts = 4; // up to 3 retries (4 total attempts)
        while (attempt < maxAttempts) {
            console.log(`[Proxy] Fetching ${targetUrl} (Attempt ${attempt + 1}/${maxAttempts})`);
            const res = await fetch(scrapingAntUrl, options);
            if (res.status === 409 || res.status === 429) {
                attempt++;
                if (attempt < maxAttempts) {
                    console.warn(`[Proxy] Concurrency Error (${res.status}) on attempt ${attempt}. Waiting 5s for backoff...`);
                    await new Promise(r => setTimeout(r, 5000));
                } else {
                    return res; // Final attempt failed
                }
            } else {
                return res; // Success
            }
        }
    } finally {
        console.log(`[Proxy] Releasing lock in 800ms...`);
        // strict post-delay to ensure proxy clears connection before next caller
        await new Promise(r => setTimeout(r, 800));
        releaseProxyLock();
    }
};
