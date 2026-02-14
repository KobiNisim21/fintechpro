import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        if (mongoose.connection.readyState >= 1) {
            return;
        }

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // Serverless optimizations
            bufferCommands: false, // Disable buffering
            serverSelectionTimeoutMS: 5000, // Fail fast if DB down
            socketTimeoutMS: 45000, // Close sockets after 45s
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);


        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
        });

    } catch (error) {
        console.error('❌ Error connecting to MongoDB:', error.message);
        process.exit(1);
    }
};

export default connectDB;
