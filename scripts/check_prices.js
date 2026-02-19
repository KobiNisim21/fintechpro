
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as stockData from '../server/services/stockDataService.js';

dotenv.config();

const runCheck = async () => {
    const symbols = ['TSLA', 'IVV', 'MSFT', 'GOOG', 'VTV', 'WIX', 'GLD', 'TLT', 'MA', 'XBI', 'BA', 'MU', 'QCOM', 'META', 'AMZN', 'NVDA'];

    console.log('--- Checking Prices ---');
    for (const s of symbols) {
        try {
            const quote = await stockData.getQuote(s);
            console.log(`${s}: $${quote.c}`);
        } catch (e) {
            console.log(`${s}: ERROR ${e.message}`);
        }
    }
    process.exit();
};

runCheck();
