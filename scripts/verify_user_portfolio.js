
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

const runVerify = async () => {
    await connectDB();

    console.log('--- Verifying User TWR after Cleanup ---');
    const positions = await Position.find({});
    console.log(`Fetched ${positions.length} positions.`);

    // Check if bad NVDA is really gone
    const bad = positions.find(p => p.symbol === 'NVDA' && p.averagePrice > 10000);
    if (bad) {
        console.error('❌ FATAL: Bad NVDA position still exists!');
    } else {
        console.log('✅ CONFIRMED: Bad NVDA position is gone.');
    }

    // Run Service Logic (we need to mock req.user for the log, but the function doesn't take req)
    // Actually stockDataService.getPortfolioHealthAndBenchmark takes (positions).
    // The log I added uses `positions.length`, so it's fine.

    try {
        const result = await stockData.getPortfolioHealthAndBenchmark(positions);
        const graph = result.benchmarkData;
        console.log(`Generated Graph Points: ${graph.length}`);

        if (graph.length > 0) {
            const first = graph[0];
            const last = graph[graph.length - 1];

            console.log(`Start Date: ${first.date}, Portfolio: ${first.portfolio}%`);
            console.log(`End Date:   ${last.date}, Portfolio: ${last.portfolio}%`);

            if (last.portfolio < -50) {
                console.log('⚠️ WARNING: Portfolio still down > 50%. Check for other bad data.');
            } else {
                console.log('✅ Portfolio looks reasonable (not crashed).');
            }
        } else {
            console.log('⚠️ Graph is empty (No valid dates?)');
        }

    } catch (e) {
        console.error('Error calculating TWR:', e);
    }

    process.exit();
};

runVerify();
