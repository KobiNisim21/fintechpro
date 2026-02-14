import 'dotenv/config';
import { searchStocks } from '../server/services/stockDataService.js';

async function testSearch() {
    try {
        console.log('Testing search for "TEVA"...');
        const results = await searchStocks('TEVA');
        console.log('Results found:', results.length);
        console.log(JSON.stringify(results.slice(0, 3), null, 2));

        if (results.length === 0) {
            console.error('❌ No results returned. Check API Key or Finnhub quota.');
        } else {
            console.log('✅ Search functional.');
        }
    } catch (error) {
        console.error('❌ Search failed:', error.message);
    }
}

testSearch();
