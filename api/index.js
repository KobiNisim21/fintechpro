import app, { dbConnection } from '../server/app.js';

export default async function handler(req, res) {
    // Ensure DB is connected before handling the request
    await dbConnection;
    return app(req, res);
}
