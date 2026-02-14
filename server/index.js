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

