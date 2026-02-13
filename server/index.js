import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/database.js';
import positionsRoutes from './routes/positions.js';
import stocksRoutes from './routes/stocks.js';
import authRoutes from './routes/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { socketAuthMiddleware } from './middleware/socketAuth.js';
import { startNewsPollingService } from './services/newsPollingService.js';
import { startLiveAlertsService } from './services/liveAlertsService.js';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: join(__dirname, '..', '.env') });

// Validate critical environment variables
console.log('🔍 Environment Variables Check:');
console.log(`   PORT: ${process.env.PORT || 'NOT SET'}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
console.log(`   MONGODB_URI: ${process.env.MONGODB_URI ? 'SET ✓' : 'NOT SET ✗'}`);
console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? 'SET ✓' : 'NOT SET ✗'}`);
console.log(`   FINNHUB_API_KEY: ${process.env.FINNHUB_API_KEY ? 'SET ✓ (' + process.env.FINNHUB_API_KEY.substring(0, 10) + '...)' : 'NOT SET ✗'}`);
console.log('');

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.io setup with CORS
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        process.env.ALLOWED_ORIGIN,
        process.env.VERCEL_URL, // Auto-set by Vercel (if we were on Vercel), but good to have
        /\.vercel\.app$/ // Allow all vercel subdomains regex
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Socket.io setup with CORS
const io = new Server(httpServer, {
    cors: corsOptions
});

// Socket.io authentication middleware
io.use(socketAuthMiddleware);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/stocks', stocksRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'TraderAI Backend is running', socketio: 'enabled' });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start HTTP server with Socket.io
httpServer.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔌 Socket.io enabled`);

    // Start the news polling service
    startNewsPollingService(io);

    // Start the live alerts service
    startLiveAlertsService(io);
});
