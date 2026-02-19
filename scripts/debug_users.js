
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Position from '../server/models/Position.js';
import User from '../server/models/User.js';

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

    const users = await User.find({}).lean();
    console.log(`Found ${users.length} users.`);

    for (const user of users) {
        const positions = await Position.find({ user: user._id }).lean();
        console.log(`\nUser: ${user.name} (${user.email}) ID: ${user._id}`);
        console.log(`Positions: ${positions.length}`);
        if (positions.length > 0) {
            const symbols = positions.map(p => p.symbol).join(', ');
            console.log(`Symbols: ${symbols.substring(0, 100)}${symbols.length > 100 ? '...' : ''}`);

            // Check for Bad NVDA specifically for this user
            const badNvda = positions.find(p => p.symbol === 'NVDA' && p.averagePrice > 10000);
            if (badNvda) {
                console.error(`  ⚠️ HAS CORRUPT NVDA: ${badNvda.averagePrice}`);
            }
        }
    }

    process.exit();
};

runDebug();
