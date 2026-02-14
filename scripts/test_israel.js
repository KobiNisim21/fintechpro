
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import YahooFinance from 'yahoo-finance2';

dotenv.config();

const yahooFinance = new YahooFinance();
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const SYMBOLS = ['TEVA.TA', 'LUMI.TA', 'ESLT.TA'];

async function testYahoo() {
    console.log('\n--- Testing Yahoo Finance ---');
    for (const symbol of SYMBOLS) {
        try {
            const quote = await yahooFinance.quote(symbol);
            console.log(`${symbol}: Price=${quote.regularMarketPrice} ${quote.currency}, MarketState=${quote.marketState}`);
        } catch (error) {
            console.error(`Error fetching ${symbol}:`, error.message);
        }
    }
}

async function run() {
    await testYahoo();
}

run();
