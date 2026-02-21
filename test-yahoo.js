import yahooFinance from 'yahoo-finance2';

async function test() {
    const q = await yahooFinance.quote('MSFT');
    console.log("52w Low:", q.fiftyTwoWeekLow);
    console.log("Earnings Timestamp:", q.earningsTimestamp);
    console.log("Earnings Timestamp End:", q.earningsTimestampEnd);
}
test();
