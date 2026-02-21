import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function test() {
    for (const sym of ['MSFT', 'NVDA']) {
        try {
            console.log(`\n--- ${sym} ---`);
            const qs = await yahooFinance.quoteSummary(sym, { modules: ['calendarEvents'] });
            if (qs.calendarEvents && qs.calendarEvents.earnings) {
                console.log("Earnings dates:", qs.calendarEvents.earnings.earningsDate.map(d => d ? new Date(d).toLocaleString() : null));
            } else {
                console.log("No calendarEvents.earnings:", JSON.stringify(qs.calendarEvents));
            }
        } catch (e) {
            console.error(sym, e.message || e);
        }
    }
}
test();
