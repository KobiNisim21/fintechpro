/**
 * The live feed shows the latest price movement per ticker, not a price history.
 * Gain/loss are two directions of that same event. News and other event types
 * retain their own identities, so an update cannot erase a distinct headline.
 * Shared by the socket consumer and producer, including legacy initial payloads.
 */
export function deduplicateLiveAlerts(alerts) {
    const newestFirst = alerts.map((alert, index) => ({
        alert, index, time: new Date(alert.timestamp).getTime() || 0,
    })).sort((a, b) => b.time - a.time || a.index - b.index);
    const seen = new Set();
    return newestFirst.filter(({ alert }) => {
        const ticker = alert.ticker.trim().toUpperCase();
        const key = alert.type === 'gain' || alert.type === 'loss'
            ? JSON.stringify([ticker, 'price'])
            : JSON.stringify([ticker, alert.type, alert.message]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).map(({ alert }) => alert);
}
