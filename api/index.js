import app, { dbConnection } from '../server/app.js';

export default async function handler(req, res) {
    try {
        console.log('API Handler triggered');

        // Ensure DB is connected before handling the request
        await dbConnection;
        console.log('DB Connection waiting complete');

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
