
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

const removeBadData = async () => {
    await connectDB();

    // Find the specific bad NVDA position
    const badPos = await Position.findOne({
        symbol: 'NVDA',
        averagePrice: { $gt: 1000000 } // Price > 1 Million
    });

    if (badPos) {
        console.log(`FOUND CORRUPT POSITION:`);
        console.log(`ID: ${badPos._id}`);
        console.log(`Symbol: ${badPos.symbol}`);
        console.log(`Qty: ${badPos.quantity}`);
        console.log(`Avg Price: ${badPos.averagePrice}`);

        // Delete it
        await Position.findByIdAndDelete(badPos._id);
        console.log('✅ DELETED CORRUPT POSITION.');
    } else {
        console.log('❌ Could not find the specific corrupt NVDA position.');
    }

    process.exit();
};

removeBadData();
