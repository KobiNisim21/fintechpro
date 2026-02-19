
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Position from '../server/models/Position.js';
import * as stockData from '../server/services/stockDataService.js';

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const runDebug = async () => {
    await connectDB();
    const userId = '697e647a21d918a32d80be4f'; // Kobi Nissim

    console.log(`--- Debugging User: ${userId} ---`);
    const positions = await Position.find({ user: userId }).lean();
    console.log(`Loaded ${positions.length} positions.`);

    console.log('\n--- Position Cost Analysis ---');
    for (const pos of positions) {
        let currentPrice = 0;
        try {
            const quote = await stockData.getQuote(pos.symbol);
            currentPrice = quote.c;
        } catch (e) {
            console.log(`Error fetching ${pos.symbol}: ${e.message}`);
        }

        const costBasis = pos.averagePrice;
        const diff = currentPrice - costBasis;
        const pctObj = costBasis > 0 ? (diff / costBasis) * 100 : 0;

        console.log(`SYM: ${pos.symbol.padEnd(6)} | Qty: ${pos.quantity} | Cost: $${costBasis.toFixed(2)} | Curr: $${currentPrice.toFixed(2)} | Gain: ${pctObj.toFixed(2)}%`);

        if (pctObj < -50) {
            console.log(`    ⚠️ CRITICAL LOSS: ${pctObj.toFixed(2)}% (Checking for data entry error?)`);
        }
    }

    // 2. Run TWR Calculation
    console.log('\n--- Running TWR Calculation ---');
    try {
        const result = await stockData.getPortfolioHealthAndBenchmark(positions);
        const graph = result.benchmarkData;
        console.log(`Graph Points: ${graph.length}`);
        if (graph.length > 0) {
            const first = graph[0];
            const last = graph[graph.length - 1];
            // Find min/max
            let minVal = 0, maxVal = 0;
            graph.forEach(p => {
                if (p.portfolio < minVal) minVal = p.portfolio;
                if (p.portfolio > maxVal) maxVal = p.portfolio;
            });

            console.log(`Start: ${first.date} (${first.portfolio}%)`);
            console.log(`End:   ${last.date} (${last.portfolio}%)`);
            console.log(`Min: ${minVal}%, Max: ${maxVal}%`);

            if (minVal < -20) {
                console.log('❌ REPRODUCED: Graph drops significantly!');
            } else {
                console.log('✅ Graph looks stable.');
            }
        }
    } catch (e) {
        console.error('TWR Error:', e);
    }

    process.exit();
};

runDebug();
