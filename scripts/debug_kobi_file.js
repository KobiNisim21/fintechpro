
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Position from '../server/models/Position.js';
import * as stockData from '../server/services/stockDataService.js';
import fs from 'fs';

dotenv.config();

const runDebug = async () => {
    await connectDB();
    const userId = '6990bdeaae14d831e69f3151'; // Tal Nisim
    const outFile = 'debug_tal.txt';

    let output = `--- Debugging User: ${userId} ---\n`;

    const positions = await Position.find({ user: userId }).lean();
    output += `Loaded ${positions.length} positions.\n\n`;

    output += '--- Position Cost Analysis ---\n';
    for (const pos of positions) {
        let currentPrice = 0;
        try {
            const quote = await stockData.getQuote(pos.symbol);
            currentPrice = quote.c;
        } catch (e) {
            output += `Error fetching ${pos.symbol}: ${e.message}\n`;
        }

        const costBasis = pos.averagePrice;
        const diff = currentPrice - costBasis;
        // Handle divide by zero
        const pctObj = costBasis > 0 ? (diff / costBasis) * 100 : 0;

        output += `SYM: ${pos.symbol.padEnd(6)} | Qty: ${pos.quantity} | Cost: $${costBasis.toFixed(2)} | Curr: $${currentPrice.toFixed(2)} | Gain: ${pctObj.toFixed(2)}%\n`;

        if (pctObj < -50) {
            output += `    ⚠️ CRITICAL LOSS: ${pctObj.toFixed(2)}% (Checking for data entry error?)\n`;
        }
    }

    fs.writeFileSync(outFile, output);
    console.log(`Written to ${outFile}`);
    process.exit();
};

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
    } catch (error) {
        process.exit(1);
    }
};

runDebug();
