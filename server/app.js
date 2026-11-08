import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import connectDB from './config/database.js';
import positionsRoutes from './routes/positions.js';
import stocksRoutes from './routes/stocks.js';
import authRoutes from './routes/auth.js';
import watchlistRoutes from './routes/watchlist.js';
import mcpRoutes from './routes/mcp.js';
import { errorHandler } from './middleware/errorHandler.js';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();

// CORS Configuration
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        process.env.ALLOWED_ORIGIN,
        process.env.VERCEL_URL,
        /\.vercel\.app$/
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Keep diagnostics available even when MongoDB is unavailable.
app.get('/api/live', (req, res) => res.json({ status: 'ok' }));
app.get('/api/health', async (req, res) => {
    const mongoose = (await import('mongoose')).default;
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
        status: connected ? 'ok' : 'degraded',
        message: 'TraderAI Backend is running',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        db: connected ? 'connected' : 'disconnected',
    });
});

// Database Connection Middleware
// Ensures the DB is connected before any route logic executes, 
// crucial since we disabled bufferCommands in database.js
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('MongoDB connection unavailable');
        res.status(503).json({ message: 'Database temporarily unavailable. Please retry.' });
    }
});

// Disable OAuth auto-discovery for MCP clients (prevents SPA catch-all returning 200 HTML)
app.all(
    ['/.well-known/oauth-authorization-server*', '/.well-known/oauth-protected-resource*', '/.well-known/openid-configuration*', '/register', '/authorize', '/token'],
    (req, res) => res.status(404).json({ error: 'not_found' })
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/stocks', stocksRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/mcp', mcpRoutes);

// Root API route for testing
app.get('/api', (req, res) => {
    res.json({ message: 'TraderAI API Root' });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
export { corsOptions };
