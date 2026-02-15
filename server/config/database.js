import mongoose from 'mongoose';

// Global cache to prevent multiple connections in dev (hot reload)
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    if (cached.conn) {
        // console.log('Using cached MongoDB connection');
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false, // Disable buffering
            serverSelectionTimeoutMS: 5000, // Fail fast if DB down
            socketTimeoutMS: 45000, // Close sockets after 45s
            maxPoolSize: 10, // Limit pool size (User requested 10)
            minPoolSize: 1,
            maxIdleTimeMS: 30000, // Close idle connections
            waitQueueTimeoutMS: 10000, // Fail if pool is full for 10s
        };

        console.log('Creating new MongoDB connection...');
        cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
            console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
            return mongoose;
        }).catch(err => {
            console.error('❌ MongoDB Connection Error:', err);
            throw err;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
};

// Handle connection events (only once)
if (!global.mongooseEventsAdded) {
    mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected');
    });

    global.mongooseEventsAdded = true;
}

export default connectDB;
