// Read-only integration check: public sample symbols, no portfolio mutations.
import dotenv from 'dotenv';
dotenv.config();
const report = console.log.bind(console);
// Provider errors can include request details; output only the validation summary.
console.log = console.warn = console.error = () => {};
const deadline = setTimeout(() => {
    report('Market integration timed out after 60 seconds');
    process.exit(1);
}, 60000);

try {
    const { getBatchExtendedQuotes, getForexRate } = await import('../server/services/stockDataService.js');
    const start = performance.now();
    const [quotes, forex] = await Promise.all([
        getBatchExtendedQuotes(['AAPL', 'FUND:5136866']),
        getForexRate(),
    ]);
    let passed = Number.isFinite(forex.rate) && forex.rate > 0;
    report(JSON.stringify({ check: 'forex', valid: passed, source: forex.source }));
    for (const symbol of ['AAPL', 'FUND:5136866']) {
        const quote = quotes[symbol];
        const valid = Number.isFinite(quote?.regularMarketPrice) && quote.regularMarketPrice > 0;
        const hasTimestamp = Boolean(quote?.regularMarketTime);
        report(JSON.stringify({ symbol, valid, source: quote?.source || 'unavailable', hasTimestamp }));
        passed &&= valid && hasTimestamp;
    }
    report(JSON.stringify({ elapsedMs: Math.round(performance.now() - start), passed }));
    if (!passed) process.exitCode = 1;
} catch {
    report('Market integration failed; provider unavailable');
    process.exitCode = 1;
} finally {
    clearTimeout(deadline);
}
