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

// Connect to MongoDB
// Note: In Vercel serverless, connection might need to be managed differently (cached), 
// but mongoose usually handles connection pooling well enough for this scale.
// We export the promise so Vercel can await it.
const dbConnection = connectDB().catch(err => console.error('Initial MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/stocks', stocksRoutes);
app.use('/api/watchlist', watchlistRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'TraderAI Backend is running' });
});

// Root API route for testing
app.get('/api', (req, res) => {
    res.json({ message: 'TraderAI API Root' });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
export { corsOptions, dbConnection };
