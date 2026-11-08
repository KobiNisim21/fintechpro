// Retry database startup without launching workers against an unready connection.
export function startWhenDatabaseReady({ connect, start, onError, retryMs = 10000 }) {
    let stopped = false;
    let retryTimer;

    async function attempt() {
        try {
            await connect();
            if (!stopped) start();
        } catch {
            if (stopped) return;
            onError?.();
            retryTimer = setTimeout(attempt, retryMs);
        }
    }

    void attempt();
    return () => {
        stopped = true;
        clearTimeout(retryTimer);
    };
}
