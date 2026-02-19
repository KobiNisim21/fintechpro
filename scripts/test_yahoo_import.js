
console.log('Testing Yahoo Finance import...');
import YahooFinance from 'yahoo-finance2';
console.log('Imported YahooFinance');
try {
    const yf = new YahooFinance();
    console.log('Instantiated YahooFinance');
} catch (e) {
    console.log('Note: new YahooFinance() failed:', e.message);
    console.log('Trying default export...');
    console.log('yahooFinance keys:', Object.keys(YahooFinance));
}
