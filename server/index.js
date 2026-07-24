import { createServer } from 'http';
import { Server } from 'socket.io';
import WebSocket from 'ws';
import fetch from 'node-fetch';
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

    // Keep-alive: ping own health endpoint every 10 minutes to prevent idle shutdown
    const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes
    setInterval(async () => {
        try {
            const res = await fetch(`http://localhost:${PORT}/api/health`);
            console.log(`💓 Keep-alive ping: ${res.status}`);
        } catch (err) {
            console.warn('💓 Keep-alive ping failed:', err.message);
        }
    }, KEEP_ALIVE_INTERVAL);
    
    // Connect to Finnhub WS
    connectFinnhubWs();
});

// Finnhub WebSocket setup
let finnhubWs = null;
const activeSymbols = new Map(); // symbol -> Set of socket IDs

const connectFinnhubWs = () => {
    const token = process.env.FINNHUB_API_KEY;
    if (!token) return;

    finnhubWs = new WebSocket(`wss://ws.finnhub.io?token=${token}`);

    finnhubWs.on('open', () => {
        console.log('✅ Connected to Finnhub WebSocket');
        for (const symbol of activeSymbols.keys()) {
            finnhubWs.send(JSON.stringify({ type: 'subscribe', symbol }));
        }
    });

    finnhubWs.on('message', (data) => {
        try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'trade' && parsed.data) {
                const latestTrades = {};
                for (const trade of parsed.data) {
                    if (!latestTrades[trade.s] || trade.t > latestTrades[trade.s].t) {
                        latestTrades[trade.s] = trade;
                    }
                }
                
                for (const symbol in latestTrades) {
                    const trade = latestTrades[symbol];
                    const listeners = activeSymbols.get(symbol);
                    if (listeners && listeners.size > 0) {
                        for (const socketId of listeners) {
                            io.to(socketId).emit('price-update', {
                                symbol: trade.s,
                                price: trade.p,
                                timestamp: Math.floor(trade.t / 1000)
                            });
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error parsing Finnhub WS message', e.message);
        }
    });

    finnhubWs.on('close', () => {
        console.log('❌ Finnhub WebSocket closed. Reconnecting in 5s...');
        setTimeout(connectFinnhubWs, 5000);
    });
    
    finnhubWs.on('error', (error) => {
        console.error('Finnhub WS error:', error.message);
    });
};

io.on('connection', (socket) => {
    socket.on('subscribe-prices', (data) => {
        const symbols = data?.symbols;
        if (!Array.isArray(symbols)) return;

        symbols.forEach(symbol => {
            if (!activeSymbols.has(symbol)) {
                activeSymbols.set(symbol, new Set());
                if (finnhubWs && finnhubWs.readyState === WebSocket.OPEN) {
                    finnhubWs.send(JSON.stringify({ type: 'subscribe', symbol }));
                }
            }
            activeSymbols.get(symbol).add(socket.id);
        });
    });

    socket.on('unsubscribe-prices', (data) => {
        const symbols = data?.symbols;
        if (!Array.isArray(symbols)) return;

        symbols.forEach(symbol => {
            const listeners = activeSymbols.get(symbol);
            if (listeners) {
                listeners.delete(socket.id);
                if (listeners.size === 0) {
                    activeSymbols.delete(symbol);
                    if (finnhubWs && finnhubWs.readyState === WebSocket.OPEN) {
                        finnhubWs.send(JSON.stringify({ type: 'unsubscribe', symbol }));
                    }
                }
            }
        });
    });

    socket.on('disconnect', () => {
        for (const [symbol, listeners] of activeSymbols.entries()) {
            if (listeners.has(socket.id)) {
                listeners.delete(socket.id);
                if (listeners.size === 0) {
                    activeSymbols.delete(symbol);
                    if (finnhubWs && finnhubWs.readyState === WebSocket.OPEN) {
                        finnhubWs.send(JSON.stringify({ type: 'unsubscribe', symbol }));
                    }
                }
            }
        }
    });
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

