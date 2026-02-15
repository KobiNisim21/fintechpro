import { createServer } from 'http';
import { Server } from 'socket.io';
import app, { corsOptions } from './app.js';
import { socketAuthMiddleware } from './middleware/socketAuth.js';
import { startNewsPollingService } from './services/newsPollingService.js';
import { startLiveAlertsService } from './services/liveAlertsService.js';

const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.io setup
const io = new Server(httpServer, {
    cors: corsOptions
});

// Socket.io authentication middleware
io.use(socketAuthMiddleware);

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

// Graceful Shutdown
const shutdown = async () => {
    console.log('🛑 Shutting down server...');
    io.close();
    httpServer.close(async () => {
        console.log('HTTP server closed');
        try {
            const mongoose = await import('mongoose');
            await mongoose.default.connection.close(false);
            console.log('MongoDB connection closed');
            process.exit(0);
        } catch (err) {
            console.error('Error closing MongoDB connection:', err);
            process.exit(1);
        }
    });

    // Force close if graceful shutdown fails/hangs
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

