/**
 * News Polling Service - Finnhub News API
 * Fetches real-time market news for portfolio tickers using Finnhub company-news endpoint
 */
import Position from '../models/Position.js';
import { getCompanyNews } from './stockDataService.js';

// Configuration
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes (well within 60 calls/min limit)
const MAX_BUFFER_SIZE = 20; // 5 pages x 4 items per page
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const NEWS_PER_TICKER = 10; // Max news items per ticker

// Rolling buffer of news items per user
const newsBuffer = new Map(); // userId -> NewsItem[]

// Global buffer of recent news (for new connections)
let globalRecentNews = [];

// Track already-seen items to avoid duplicates
const seenItems = new Set();

/**
 * Sanitize HTML content - remove all HTML tags
 */
function sanitizeContent(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get all unique tickers from all users' portfolios
 */
async function getAllActiveTickers() {
  try {
    const positions = await Position.find({}, 'symbol').lean();
    const tickers = [...new Set(positions.map(p => p.symbol.toUpperCase()))];
    return tickers;
  } catch (error) {
    console.error('❌ Error fetching portfolio tickers:', error.message);
    return [];
  }
}

/**
 * Get tickers for a specific user
 */
async function getUserTickers(userId) {
  try {
    const positions = await Position.find({ user: userId }, 'symbol').lean();
    return positions.map(p => p.symbol.toUpperCase());
  } catch (error) {
    console.error(`❌ Error fetching tickers for user ${userId}:`, error.message);
    return [];
  }
}

/**
 * Fetch news from Finnhub for a specific ticker
 */
/**
 * Fetch news from Finnhub via shared service
 */
async function fetchFinnhubNews(ticker) {
  try {
    // Use shared service (handles caching and deduplication)
    const data = await getCompanyNews(ticker);

    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    // Convert Finnhub format to our format
    return data.map(item => ({
      id: `finnhub-${item.id || item.datetime}-${ticker}`,
      source: item.source || 'Finnhub',
      headline: sanitizeContent(item.headline),
      summary: sanitizeContent(item.summary),
      content: sanitizeContent(item.headline), // Use headline as primary content
      link: item.url,
      image: item.image,
      pubDate: new Date(item.datetime * 1000),
      tickers: [ticker],
      related: item.related ? item.related.split(',') : [ticker]
    }));
  } catch (error) {
    console.log(`❌ News fetch error for ${ticker}: ${error.message}`);
    return [];
  }
}

/**
 * Add news items to user's buffer - maintains chronological order (newest first)
 */
function addToBuffer(userId, items) {
  if (!newsBuffer.has(userId)) {
    newsBuffer.set(userId, []);
  }

  const buffer = newsBuffer.get(userId);
  const now = Date.now();

  // Add new items (only if not seen before)
  items.forEach(item => {
    if (!seenItems.has(item.id)) {
      seenItems.add(item.id);
      buffer.push(item);
    }
  });

  // Sort by date (newest first), filter old items, and trim to max size
  const sorted = buffer
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .filter(item => (now - new Date(item.pubDate).getTime()) < MAX_AGE_MS)
    .slice(0, MAX_BUFFER_SIZE);

  newsBuffer.set(userId, sorted);
  return sorted;
}

/**
 * Get buffered news for a user
 */
function getBufferedNews(userId) {
  return newsBuffer.get(userId) || [];
}

/**
 * Format relative time (e.g., "5m ago")
 */
function formatRelativeTime(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Main polling function - fetches news from Finnhub for all portfolio tickers
 */
async function pollNews(io) {
  console.log('📰 Starting Finnhub news poll cycle...');

  const allTickers = await getAllActiveTickers();

  if (allTickers.length === 0) {
    console.log('⚠️ No active tickers in any portfolio, skipping poll');
    return;
  }

  console.log(`📊 Polling news for ${allTickers.length} tickers: ${allTickers.join(', ')}`);

  let allNewsItems = [];

  // Fetch news for each ticker (with small delay to avoid rate limiting)
  for (const ticker of allTickers.slice(0, 10)) { // Limit to 10 tickers per poll
    const items = await fetchFinnhubNews(ticker);
    if (items.length > 0) {
      allNewsItems.push(...items);
      console.log(`   ✅ ${ticker}: ${items.length} news items`);
    }
    // Small delay between requests (100ms)
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`✅ Finnhub returned ${allNewsItems.length} total news items`);

  if (allNewsItems.length === 0) return;

  // Sort by date (newest first)
  allNewsItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Deduplicate by ID
  const uniqueItems = [];
  const seen = new Set();
  for (const item of allNewsItems) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      uniqueItems.push(item);
    }
  }

  // Store in global buffer for new connections
  globalRecentNews = uniqueItems.slice(0, MAX_BUFFER_SIZE);

  // Emit to connected users based on their portfolios
  const sockets = await io.fetchSockets();
  console.log(`🔌 Connected sockets: ${sockets.length}`);

  for (const socket of sockets) {
    if (!socket.userId) continue;

    const userTickers = await getUserTickers(socket.userId);
    if (userTickers.length === 0) continue;

    // Filter news to only items matching user's portfolio
    const userTickerSet = new Set(userTickers);
    const userItems = uniqueItems.filter(item =>
      item.tickers.some(t => userTickerSet.has(t)) ||
      item.related?.some(t => userTickerSet.has(t))
    );

    if (userItems.length === 0) continue;

    // Check for new items not in user's buffer
    const existingBuffer = getBufferedNews(socket.userId);
    const existingIds = new Set(existingBuffer.map(item => item.id));
    const newItems = userItems.filter(item => !existingIds.has(item.id));

    if (newItems.length > 0) {
      // Add to buffer and emit
      const updatedBuffer = addToBuffer(socket.userId, newItems);

      // Format for frontend
      const formattedItems = updatedBuffer.map(item => ({
        ...item,
        relativeTime: formatRelativeTime(item.pubDate)
      }));

      socket.emit('market-news-update', {
        items: formattedItems,
        newCount: newItems.length
      });

      console.log(`📤 Emitted ${newItems.length} new items to user ${socket.userId}`);
    }
  }
}

/**
 * Start the news polling service
 */
export function startNewsPollingService(io) {
  console.log('🚀 Starting Finnhub News Polling Service...');
  console.log(`   📊 Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`   📦 Max buffer size: ${MAX_BUFFER_SIZE}`);
  console.log(`   🔑 API Key: ${process.env.FINNHUB_API_KEY ? 'SET ✓' : 'NOT SET ✗'}`);

  // Initial poll after 5 seconds
  setTimeout(() => pollNews(io), 5000);

  // Poll every 2 minutes
  setInterval(() => pollNews(io), POLL_INTERVAL_MS);

  // Handle socket connections - send buffered news
  io.on('connection', async (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (User: ${socket.userId})`);

    if (socket.userId) {
      // Get user's tickers
      const userTickers = await getUserTickers(socket.userId);
      const userTickerSet = new Set(userTickers);

      // Send buffered news on connect
      let buffer = getBufferedNews(socket.userId);

      // If user buffer is empty, use global news (all items, sorted by date)
      if (buffer.length === 0 && globalRecentNews.length > 0) {
        // Take ALL global news items and sort by date (newest first)
        buffer = [...globalRecentNews]
          .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
          .slice(0, MAX_BUFFER_SIZE);

        // Mark matching tickers for highlighting
        buffer = buffer.map(item => ({
          ...item,
          tickers: item.tickers.filter(t => userTickerSet.has(t)).length > 0
            ? item.tickers.filter(t => userTickerSet.has(t))
            : item.tickers
        }));

        if (buffer.length > 0) {
          addToBuffer(socket.userId, buffer);
        }
      }

      console.log(`📦 Buffer has ${buffer.length} items for user ${socket.userId}`);

      if (buffer.length > 0) {
        // Sort by date (newest first) before sending
        const sortedBuffer = [...buffer].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        const formattedItems = sortedBuffer.map(item => ({
          ...item,
          relativeTime: formatRelativeTime(item.pubDate)
        }));

        socket.emit('market-news-update', {
          items: formattedItems,
          newCount: 0 // Not new on initial connect
        });
        console.log(`📤 Sent ${buffer.length} buffered news items to user ${socket.userId}`);
      }
    }

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });

    // Handle manual refresh request
    socket.on('request-news-refresh', async () => {
      if (socket.userId) {
        const buffer = getBufferedNews(socket.userId);
        const formattedItems = buffer.map(item => ({
          ...item,
          relativeTime: formatRelativeTime(item.pubDate)
        }));

        socket.emit('market-news-update', {
          items: formattedItems,
          newCount: 0
        });
        console.log(`🔄 Sent refresh to user ${socket.userId}`);
      }
    });
  });
}

export default { startNewsPollingService };
