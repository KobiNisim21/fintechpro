// Initialize the Vercel serverless handler
import app from '../server/app.js';

export default async function handler(req, res) {
    try {
        // Return the Express app wrapped as the serverless handler
        // The DB connection is securely handled by the app.js level middleware
        return app(req, res);
    } catch (error) {
        console.error('Vercel Handler Error:', error);
        return res.status(500).json({
            error: 'Serverless Function Crash',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            details: 'Check Vercel logs for more info'
        });
    }
}
