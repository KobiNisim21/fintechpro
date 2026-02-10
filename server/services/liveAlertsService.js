/**
 * Live Alerts Service
 * Generates real-time alerts for portfolio price movements (>2%) and news events
 */

import Position from '../models/Position.js';
import { getQuote as fetchQuoteFromService } from './stockDataService.js';

// Configuration
const PRICE_THRESHOLD_PERCENT = 2.0; // Alert when price moves more than 2%
const MAX_ALERTS_PER_USER = 5; // Keep only the 5 most recent alerts
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between same ticker alerts

// In-memory storage
const userAlerts = new Map(); // userId -> array of alerts
const lastAlertTime = new Map(); // `${userId}-${ticker}` -> timestamp
let alertIdCounter = 0;

// Company name mapping (common tickers)
const companyNames = {
    AAPL: 'Apple Inc.',
    MSFT: 'Microsoft',
    GOOGL: 'Google',
    GOOG: 'Google',
    AMZN: 'Amazon',
    NVDA: 'NVIDIA',
    TSLA: 'Tesla',
    META: 'Meta Platforms',
    NFLX: 'Netflix',
    AMD: 'AMD',
    INTC: 'Intel',
    WIX: 'Wix.com',
    BA: 'Boeing',
    MA: 'Mastercard',
    GLD: 'SPDR Gold',
    TLT: 'iShares Treasury',
    IVV: 'iShares S&P 500',
    VTV: 'Vanguard Value',
    XBI: 'SPDR Biotech',
    QCOM: 'Qualcomm',
    MU: 'Micron',
    CRM: 'Salesforce',
    ADBE: 'Adobe',
};

/**
 * Get company name for a ticker
 */
function getCompanyName(ticker) {
    return companyNames[ticker.toUpperCase()] || ticker;
}

/**
 * Format relative time
 */
function formatRelativeTime(date) {
    const now = Date.now();
    const diff = now - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Generate unique alert ID
 */
function generateAlertId() {
    return `alert-${Date.now()}-${++alertIdCounter}`;
}

/**
 * Check if we can send an alert for this ticker (cooldown)
 */
function canSendAlert(userId, ticker) {
    const key = `${userId}-${ticker}`;
    const lastTime = lastAlertTime.get(key);
    if (!lastTime) return true;
    return Date.now() - lastTime > ALERT_COOLDOWN_MS;
}

/**
 * Record that we sent an alert
 */
function recordAlertSent(userId, ticker) {
    const key = `${userId}-${ticker}`;
    lastAlertTime.set(key, Date.now());
}

/**
 * Add alert to user's list
 */
function addAlert(userId, alert) {
    if (!userAlerts.has(userId)) {
        userAlerts.set(userId, []);
    }

    const alerts = userAlerts.get(userId);
    alerts.unshift(alert); // Add to beginning (newest first)

    // Keep only MAX_ALERTS_PER_USER
    if (alerts.length > MAX_ALERTS_PER_USER) {
        alerts.pop();
    }

    userAlerts.set(userId, alerts);
    return alerts;
}

/**
 * Get alerts for a user
 */
export function getAlertsForUser(userId) {
    const alerts = userAlerts.get(userId) || [];
    // Update relative times
    return alerts.map(alert => ({
        ...alert,
        relativeTime: formatRelativeTime(alert.timestamp)
    }));
}

/**
 * Get all portfolio tickers for all users
 */
async function getAllUserPortfolios() {
    try {
        const positions = await Position.find({}).lean();
        console.log(`🔔 [ALERTS] Found ${positions.length} positions in database`);

        if (positions.length > 0) {
            console.log(`🔔 [ALERTS] Sample position:`, JSON.stringify(positions[0], null, 2));
        }

        const userPortfolios = new Map();

        positions.forEach(pos => {
            // Field is called "user" not "userId" in the Position model
            if (!pos.user) {
                console.log(`🔔 [ALERTS] Skipping position without user: ${pos.symbol}`);
                return;
            }

            const userId = pos.user.toString();
            if (!userPortfolios.has(userId)) {
                userPortfolios.set(userId, new Set());
            }
            userPortfolios.get(userId).add(pos.symbol);
        });

        console.log(`🔔 [ALERTS] User portfolios mapped: ${userPortfolios.size} users`);
        return userPortfolios;
    } catch (error) {
        console.error('❌ Error fetching portfolios for alerts:', error.message);
        return new Map();
    }
}

/**
 * Process a price update and generate alert if threshold crossed
 */
export function processPriceUpdate(io, ticker, currentPrice, previousClose, changePercent) {
    const absChange = Math.abs(changePercent);

    // Only alert if change exceeds threshold
    if (absChange < PRICE_THRESHOLD_PERCENT) {
        return;
    }

    const alertType = changePercent > 0 ? 'gain' : 'loss';
    const direction = changePercent > 0 ? 'up' : 'down';
    const companyName = getCompanyName(ticker);

    // Get all connected sockets and check their portfolios
    io.fetchSockets().then(async (sockets) => {
        const userPortfolios = await getAllUserPortfolios();

        for (const socket of sockets) {
            const userId = socket.userId;
            if (!userId) continue;

            const userTickers = userPortfolios.get(userId);
            if (!userTickers || !userTickers.has(ticker)) continue;

            // Check cooldown
            if (!canSendAlert(userId, ticker)) continue;

            // Create alert
            const alert = {
                id: generateAlertId(),
                type: alertType,
                ticker: ticker,
                companyName: companyName,
                message: `${companyName} ${direction} ${absChange.toFixed(1)}% today`,
                value: changePercent,
                timestamp: new Date(),
                relativeTime: 'just now'
            };

            // Add to user's alerts
            const alerts = addAlert(userId, alert);
            recordAlertSent(userId, ticker);

            // Emit to this user's socket
            socket.emit('live-alert', {
                alert: alert,
                allAlerts: alerts.map(a => ({
                    ...a,
                    relativeTime: formatRelativeTime(a.timestamp)
                }))
            });

            console.log(`🔔 Alert sent to user ${userId}: ${alert.message}`);
        }
    });
}

/**
 * Generate news-based alert
 */
export function processNewsAlert(io, ticker, headline, newsType = 'news') {
    const companyName = getCompanyName(ticker);

    io.fetchSockets().then(async (sockets) => {
        const userPortfolios = await getAllUserPortfolios();

        for (const socket of sockets) {
            const userId = socket.userId;
            if (!userId) continue;

            const userTickers = userPortfolios.get(userId);
            if (!userTickers || !userTickers.has(ticker)) continue;

            // Check cooldown for news
            if (!canSendAlert(userId, `news-${ticker}`)) continue;

            const alert = {
                id: generateAlertId(),
                type: 'news',
                ticker: ticker,
                companyName: companyName,
                message: headline,
                timestamp: new Date(),
                relativeTime: 'just now'
            };

            const alerts = addAlert(userId, alert);
            recordAlertSent(userId, `news-${ticker}`);

            socket.emit('live-alert', {
                alert: alert,
                allAlerts: alerts.map(a => ({
                    ...a,
                    relativeTime: formatRelativeTime(a.timestamp)
                }))
            });

            console.log(`📰 News alert sent to user ${userId}: ${headline.substring(0, 50)}...`);
        }
    });
}

/**
 * Send initial alerts to newly connected user
 */
export function sendInitialAlerts(socket) {
    if (!socket.userId) return;

    const alerts = getAlertsForUser(socket.userId);
    if (alerts.length > 0) {
        socket.emit('live-alerts-init', { alerts });
        console.log(`📤 Sent ${alerts.length} initial alerts to user ${socket.userId}`);
    }
}

// Store for tracking daily opens
const dailyOpenPrices = new Map(); // ticker -> { open, timestamp }

/**
 * Fetch quote using shared stockDataService (shared cache with controller)
 */
async function fetchQuote(ticker) {
    try {
        return await fetchQuoteFromService(ticker);
    } catch (error) {
        return null;
    }
}

/**
 * Poll prices and generate alerts
 */
async function pollPricesForAlerts(io) {
    try {
        const userPortfolios = await getAllUserPortfolios();

        // Get all unique tickers across all users
        const allTickers = new Set();
        userPortfolios.forEach(tickers => {
            tickers.forEach(ticker => allTickers.add(ticker));
        });

        if (allTickers.size === 0) {
            console.log('🔔 [ALERTS] No tickers to check (no portfolios found)');
            return;
        }

        console.log(`🔔 [ALERTS] Checking ${allTickers.size} tickers: ${[...allTickers].join(', ')}`);

        let alertsTriggered = 0;
        for (const ticker of allTickers) {
            const quote = await fetchQuote(ticker);
            if (!quote || !quote.c || !quote.pc) {
                console.log(`   ⚠️ ${ticker}: No quote data`);
                continue;
            }

            const currentPrice = quote.c;
            const previousClose = quote.pc;
            const changePercent = ((currentPrice - previousClose) / previousClose) * 100;

            console.log(`   📈 ${ticker}: $${currentPrice.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%) ${Math.abs(changePercent) >= PRICE_THRESHOLD_PERCENT ? '🚨 ALERT!' : ''}`);

            // Process price update (will generate alert if >2% change)
            if (Math.abs(changePercent) >= PRICE_THRESHOLD_PERCENT) {
                alertsTriggered++;
                processPriceUpdate(io, ticker, currentPrice, previousClose, changePercent);
            }

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 200));
        }

        console.log(`🔔 [ALERTS] Poll complete. Alerts triggered: ${alertsTriggered}`);
    } catch (error) {
        console.error('❌ Error polling prices for alerts:', error.message);
    }
}

// Price polling interval (60 seconds)
const PRICE_POLL_INTERVAL = 60 * 1000;

/**
 * Start the live alerts service
 */
export function startLiveAlertsService(io) {
    console.log('');
    console.log('========================================');
    console.log('🔔 LIVE ALERTS SERVICE STARTED');
    console.log('========================================');
    console.log(`   📊 Price threshold: ${PRICE_THRESHOLD_PERCENT}%`);
    console.log(`   ⏱️ Alert cooldown: ${ALERT_COOLDOWN_MS / 1000}s`);
    console.log(`   📋 Max alerts per user: ${MAX_ALERTS_PER_USER}`);
    console.log(`   🔄 Price poll interval: ${PRICE_POLL_INTERVAL / 1000}s`);
    console.log('========================================');
    console.log('');

    // Handle socket connections
    io.on('connection', (socket) => {
        console.log(`🔔 [ALERTS] User connected: ${socket.userId}`);
        // Send initial alerts on connect
        sendInitialAlerts(socket);

        // Handle request for alerts refresh
        socket.on('request-alerts-refresh', () => {
            sendInitialAlerts(socket);
        });
    });

    // Initial price poll after 10 seconds (give server time to start)
    console.log('🔔 [ALERTS] First price poll in 10 seconds...');
    setTimeout(() => {
        console.log('🔔 [ALERTS] Starting first price poll NOW');
        pollPricesForAlerts(io);
    }, 10000);

    // Regular price polling every minute
    setInterval(() => {
        console.log('🔔 [ALERTS] Running scheduled price poll...');
        pollPricesForAlerts(io);
    }, PRICE_POLL_INTERVAL);
}

