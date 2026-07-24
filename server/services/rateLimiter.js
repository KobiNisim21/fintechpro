export const createRateLimiter = (name, { callsPerMinute = 60, minSpacing = 200 }) => {
    let queue = [];
    let callTimestamps = [];
    let isProcessing = false;

    const processQueue = async () => {
        if (isProcessing || queue.length === 0) return;
        isProcessing = true;

        while (queue.length > 0) {
            const now = Date.now();
            
            // Clean up old timestamps (older than 1 minute)
            callTimestamps = callTimestamps.filter(t => now - t < 60000);

            // Check calls per minute limit
            if (callTimestamps.length >= callsPerMinute) {
                const oldestCall = callTimestamps[0];
                const waitTime = 60000 - (now - oldestCall);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue; // Re-evaluate after waiting
            }

            // Check minimum spacing limit
            const lastCallTime = callTimestamps.length > 0 ? callTimestamps[callTimestamps.length - 1] : 0;
            const timeSinceLastCall = now - lastCallTime;
            if (timeSinceLastCall < minSpacing) {
                await new Promise(resolve => setTimeout(resolve, minSpacing - timeSinceLastCall));
                continue; // Re-evaluate after waiting
            }

            // Ready to execute next call
            const { fn, resolve, reject } = queue.shift();
            callTimestamps.push(Date.now());
            
            try {
                // We don't await the fn here if we just want to fire it off,
                // but we need to resolve the promise. Wait, we should await it to catch errors properly,
                // or just fire it and let the caller handle it.
                // We'll await it to ensure we don't start the next one before this completes, though minSpacing handles pacing.
                const result = await fn();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        }

        isProcessing = false;
    };

    return {
        execute: (fn) => {
            return new Promise((resolve, reject) => {
                queue.push({ fn, resolve, reject });
                processQueue();
            });
        }
    };
};
