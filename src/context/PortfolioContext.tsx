import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { positionsAPI } from '../api/positions';
import { stocksAPI, PortfolioAnalytics } from '../api/stocks';
import { useAuth } from './AuthContext';
import { getFinnhubWebSocket, PriceUpdateCallback } from '../services/websocket';

export interface Lot {
  quantity: number;
  price: number;
  date: string | Date; // Date of purchase
}

export interface Position {
  _id: string;
  symbol: string;
  name: string;
  price: number; // Current market price from API
  change: number; // Daily change $
  changePercent: number; // Daily change %

  // Extended hours data (pre-market or after-hours)
  extendedPrice?: number; // Extended hours price
  extendedChange?: number; // Extended hours change in $
  extendedChangePercent?: number; // Extended hours change %
  marketStatus?: 'regular' | 'pre-market' | 'after-hours' | 'closed'; // Current market status

  quantity: number;
  averagePrice: number;
  lots?: Lot[]; // Array of purchase lots
  sparklineData: number[];
  color: string;
}

interface PortfolioContextType {
  positions: Position[];
  loading: boolean;
  error: string | null;
  addPosition: (symbol: string, name: string, quantity: number, averagePrice: number, date?: string | Date) => Promise<void>;
  updatePosition: (id: string, quantity?: number, averagePrice?: number, lots?: Lot[]) => Promise<void>;
  removePosition: (id: string) => Promise<void>;

  // Analytics State
  portfolioAnalytics: PortfolioAnalytics | null;
  analyticsLoading: boolean;
  fetchAnalytics: (force?: boolean) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

// Market status type
type MarketStatus = 'regular' | 'pre-market' | 'after-hours' | 'closed';

// Get detailed market status for display
function getMarketStatus(): MarketStatus {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const day = etTime.getDay(); // 0 = Sunday, 6 = Saturday

  const timeInMinutes = hours * 60 + minutes;

  // Weekend - market fully closed
  if (day === 0 || day === 6) return 'closed';

  // Pre-market: 4:00 AM - 9:30 AM ET (240 min - 570 min)
  if (timeInMinutes >= 240 && timeInMinutes < 570) return 'pre-market';

  // Regular market: 9:30 AM - 4:00 PM ET (570 min - 960 min)
  if (timeInMinutes >= 570 && timeInMinutes < 960) return 'regular';

  // After-hours: 4:00 PM - 8:00 PM ET (960 min - 1200 min)
  if (timeInMinutes >= 960 && timeInMinutes < 1200) return 'after-hours';

  // Outside trading hours (before 4 AM or after 8 PM) - show last session data
  return 'closed';
}



// ============================================
// LOCAL STORAGE CACHE (stale-while-revalidate)
// ============================================
const CACHE_KEY = 'portfolio_positions_cache';

function loadCachedPositions(): Position[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Validate structure — must be an array with symbols
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].symbol) {
      return parsed;
    }
  } catch { /* corrupted cache, ignore */ }
  return [];
}

function saveCachedPositions(positions: Position[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(positions));
  } catch { /* storage full, ignore */ }
}

function clearCachedPositions() {
  localStorage.removeItem(CACHE_KEY);
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  // Initialize from cache for instant render on refresh
  const [positions, setPositions] = useState<Position[]>(() => {
    if (!isAuthenticated) return [];
    return loadCachedPositions();
  });
  // Only show loading if no cached data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analytics State
  const [portfolioAnalytics, setPortfolioAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [lastAnalyticsFetch, setLastAnalyticsFetch] = useState<number>(0);

  // Fetch positions from backend — FAST: uses batch extended quotes for prices
  const fetchPositions = async () => {
    if (!isAuthenticated) {
      setPositions([]);
      clearCachedPositions();
      return;
    }

    const hasCachedData = positions.length > 0;

    try {
      // Only show loading spinner if we DON'T have cached data
      if (!hasCachedData) setLoading(true);
      setError(null);
      const apiPositions = await positionsAPI.getAll();

      // Collect all unique symbols
      const allSymbols = [...new Set(apiPositions.map((p: any) => p.symbol))];

      // ONE batch call for ALL prices + extended hours data (replaces N individual getQuote calls)
      let batchExtendedQuotes: Record<string, any> = {};
      try {
        if (allSymbols.length > 0) {
          batchExtendedQuotes = await stocksAPI.getBatchExtendedQuotes(allSymbols);
        }
      } catch (batchErr) {
        console.warn('Batch extended quotes unavailable, falling back to individual quotes');
      }

      // Map positions with prices from batch result — NO individual API calls
      const positionsWithPrices = apiPositions.map((pos: any) => {
        const extendedQuote = batchExtendedQuotes[pos.symbol];

        // Extract price from batch extended quote (Yahoo Finance data)
        let currentPrice = pos.averagePrice; // fallback
        let change = 0;
        let changePercent = 0;

        if (extendedQuote) {
          currentPrice = extendedQuote.regularMarketPrice || pos.averagePrice;
          const prevClose = extendedQuote.regularMarketPreviousClose || currentPrice;
          change = extendedQuote.regularMarketChange ?? (currentPrice - prevClose);
          changePercent = extendedQuote.regularMarketChangePercent ?? (prevClose > 0 ? (change / prevClose) * 100 : 0);
        }

        // Map extended hours data
        let extendedPrice: number | undefined;
        let extendedChange: number | undefined;
        let extendedChangePercent: number | undefined;
        let marketStatus: MarketStatus = 'regular';

        if (extendedQuote) {
          if (extendedQuote.marketState === 'PRE' || extendedQuote.marketState === 'PREPRE') {
            marketStatus = 'pre-market';
            if (extendedQuote.preMarketPrice) {
              extendedPrice = extendedQuote.preMarketPrice;
              extendedChange = extendedQuote.preMarketChange || 0;
              extendedChangePercent = extendedQuote.preMarketChangePercent || 0;
            }
          } else if (extendedQuote.marketState === 'POST' || extendedQuote.marketState === 'POSTPOST') {
            marketStatus = 'after-hours';
            if (extendedQuote.postMarketPrice) {
              extendedPrice = extendedQuote.postMarketPrice;
              extendedChange = extendedQuote.postMarketChange || 0;
              extendedChangePercent = extendedQuote.postMarketChangePercent || 0;
            }
          } else if (extendedQuote.marketState === 'CLOSED') {
            marketStatus = 'closed';
            if (extendedQuote.postMarketPrice) {
              extendedPrice = extendedQuote.postMarketPrice;
              extendedChange = extendedQuote.postMarketChange || 0;
              extendedChangePercent = extendedQuote.postMarketChangePercent || 0;
            }
          }
        } else {
          marketStatus = getMarketStatus();
        }

        return {
          _id: pos._id,
          symbol: pos.symbol,
          name: pos.name,
          quantity: pos.quantity,
          averagePrice: pos.averagePrice,
          price: currentPrice,
          change,
          changePercent,
          extendedPrice,
          extendedChange,
          extendedChangePercent,
          marketStatus,
          sparklineData: Array(10).fill(currentPrice), // placeholder until background fetch
          color: change >= 0 ? '#10B981' : '#EF4444',
        };
      });

      setPositions(positionsWithPrices);
      // Save fresh data to localStorage for next refresh
      saveCachedPositions(positionsWithPrices);
    } catch (err: any) {
      setError(err.message || 'Failed to load positions');
      console.error('Error fetching positions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Analytics (Health Score, TWR, etc.)
  // Memoized to prevent excessive re-renders/calls
  const fetchAnalytics = useCallback(async (force = false) => {
    // Prevent fetching if no positions
    if (positions.length === 0) return;

    // Throttle: Don't fetch if fetched < 10 minutes ago, unless forced
    // Also don't fetch if already loading
    const now = Date.now();
    if (!force && analyticsLoading) return;
    if (!force && portfolioAnalytics && (now - lastAnalyticsFetch < 10 * 60 * 1000)) {
      console.log('Skipping analytics fetch (fresh enough)');
      return;
    }

    try {
      setAnalyticsLoading(true);
      console.log('Fetching portfolio analytics...');
      const symbols = positions.map(p => p.symbol);
      const quantities = positions.map(p => p.quantity);
      const prices = positions.map(p => p.price);

      const data = await stocksAPI.getPortfolioAnalytics(symbols, quantities, prices);
      setPortfolioAnalytics(data);
      setLastAnalyticsFetch(Date.now());
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      // Don't set error state globally as this is secondary data
    } finally {
      setAnalyticsLoading(false);
    }
  }, [positions, analyticsLoading, portfolioAnalytics, lastAnalyticsFetch]);

  // Load positions on mount and when auth status changes
  useEffect(() => {
    fetchPositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Clear analytics when positions change efficiently
  // Actually, we should probably invalidate logic. 
  // If positions change significantly (add/remove), we should reset stored analytics 
  // so next view fetches fresh data.
  useEffect(() => {
    // If positions count changes, invalidate cache timestamp
    setLastAnalyticsFetch(0);
  }, [positions.length]);

  // Background sparkline enrichment — runs AFTER positions are rendered
  useEffect(() => {
    if (positions.length === 0 || !isAuthenticated) return;

    // Only enrich if sparklines are still placeholders (all values identical)
    const needsEnrichment = positions.some(p =>
      p.sparklineData.length > 0 && new Set(p.sparklineData).size === 1
    );
    if (!needsEnrichment) return;

    const enrichSparklines = async () => {
      const to = Math.floor(Date.now() / 1000);
      const from = to - (30 * 24 * 60 * 60); // 30 days ago

      // Fetch all sparklines in parallel (non-blocking, dashboard already visible)
      const results = await Promise.all(
        positions.map(async (pos) => {
          try {
            const history = await stocksAPI.getStockHistory(pos.symbol, from, to, 'D');
            if (history && history.c && Array.isArray(history.c) && history.c.length > 0) {
              return { symbol: pos.symbol, sparklineData: history.c };
            }
          } catch (err) {
            console.warn(`Sparkline fetch failed for ${pos.symbol}`);
          }
          return { symbol: pos.symbol, sparklineData: Array(10).fill(pos.price) };
        })
      );

      // Batch update all sparklines at once
      setPositions(prev => prev.map(pos => {
        const result = results.find(r => r.symbol === pos.symbol);
        return result ? { ...pos, sparklineData: result.sparklineData } : pos;
      }));
    };

    enrichSparklines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.length, isAuthenticated]);

  // WebSocket integration for real-time updates
  useEffect(() => {
    if (!isAuthenticated || positions.length === 0) return;

    const apiKey = import.meta.env.VITE_FINNHUB_API_KEY;
    if (!apiKey) {
      console.error('❌ VITE_FINNHUB_API_KEY not found in environment variables');
      return;
    }

    console.log('🚀 Initializing WebSocket for real-time updates...');
    const ws = getFinnhubWebSocket(apiKey);

    // Connect to WebSocket
    ws.connect();

    // Subscribe to all position symbols
    positions.forEach(pos => {
      ws.subscribeToSymbol(pos.symbol);
    });

    // Store previous close prices for each stock (from initial fetch)
    const previousCloseMap = new Map<string, number>();
    positions.forEach(pos => {
      // Calculate previous close from current data
      const previousClose = pos.price - pos.change;
      previousCloseMap.set(pos.symbol, previousClose);
    });

    // Handle price updates
    const handlePriceUpdate: PriceUpdateCallback = (symbol, price) => {
      setPositions(prev => prev.map(pos => {
        if (pos.symbol === symbol) {
          // Calculate change against previous close (not last price!)
          const previousClose = previousCloseMap.get(symbol) || pos.price; // Fallback to current price if previousClose not found
          const change = price - previousClose;
          const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

          // Check market status
          const marketStatus = getMarketStatus();
          const inExtendedHours = marketStatus !== 'regular';

          return {
            ...pos,
            price,
            change,
            changePercent,

            // Update extended hours data when market is not in regular session
            extendedPrice: inExtendedHours ? price : undefined,
            extendedChange: inExtendedHours ? change : undefined,
            extendedChangePercent: inExtendedHours ? changePercent : undefined,
            marketStatus,

            color: change >= 0 ? '#10B981' : '#EF4444',
          };
        }
        return pos;
      }));
    };

    const unsubscribe = ws.onPriceUpdate(handlePriceUpdate);

    // Cleanup on unmount or when positions change
    return () => {
      console.log('🧹 Cleaning up WebSocket subscriptions...');
      unsubscribe();
      positions.forEach(pos => {
        ws.unsubscribeFromSymbol(pos.symbol);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, positions.length]);

  const addPosition = async (symbol: string, name: string, quantity: number, averagePrice: number, date?: string | Date) => {
    try {
      setError(null);
      const newPosition = await positionsAPI.create({
        symbol: symbol.toUpperCase(),
        name,
        quantity,
        averagePrice, // Ensure this field is sent
        date: date || new Date(),
      });

      // Try to fetch current price, but don't fail if it doesn't work
      let currentPrice = averagePrice; // Default to average price
      let change = 0;
      let changePercent = 0;

      try {
        const quote = await stocksAPI.getQuote(symbol);
        currentPrice = quote.c;
        change = currentPrice - quote.pc;
        changePercent = (change / quote.pc) * 100;
      } catch (priceError) {
        console.warn(`Could not fetch price for ${symbol}, using defaults:`, priceError);
        // Price will stay as averagePrice, which is a reasonable default
      }

      // Check market status
      const marketStatus = getMarketStatus();
      const inExtendedHours = marketStatus !== 'regular';

      const positionWithPrice: Position = {
        _id: newPosition._id,
        symbol: newPosition.symbol,
        name: newPosition.name,
        quantity: newPosition.quantity,
        averagePrice: newPosition.averagePrice,
        price: currentPrice,
        change,
        changePercent,

        // Extended hours data
        extendedPrice: inExtendedHours ? currentPrice : undefined,
        extendedChange: inExtendedHours ? change : undefined,
        extendedChangePercent: inExtendedHours ? changePercent : undefined,
        marketStatus,

        sparklineData: Array.from({ length: 8 }, () => currentPrice),
        color: change >= 0 ? '#10B981' : '#EF4444',
      };

      setPositions((prev) => {
        const updated = [...prev, positionWithPrice];
        saveCachedPositions(updated);
        return updated;
      });
      // Invalidate analytics
      setLastAnalyticsFetch(0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add position');
      throw err;
    }
  };

  const updatePosition = async (id: string, quantity?: number, averagePrice?: number, lots?: Lot[]) => {
    try {
      setError(null);
      // We expect the backend to return the fully updated position object
      // Note: positionsAPI.update needs to return Promise<Position>
      const updatedPos = await positionsAPI.update(id, { quantity, averagePrice, lots });

      // Update local state with the REAL data from backend
      setPositions((prev) => {
        const updated = prev.map((pos) =>
          pos._id === id
            ? {
              ...pos,
              // Merge backend response with existing UI state (like market price, colors)
              quantity: updatedPos.quantity,
              averagePrice: updatedPos.averagePrice,
              lots: updatedPos.lots,
              // Keep the live market data which isn't in the update response (unless backend fetches it)
              price: pos.price,
              change: pos.change,
              changePercent: pos.changePercent,
              extendedPrice: pos.extendedPrice,
              extendedChange: pos.extendedChange,
              extendedChangePercent: pos.extendedChangePercent,
              marketStatus: pos.marketStatus,
              sparklineData: pos.sparklineData,
              color: pos.color
            }
            : pos
        );
        saveCachedPositions(updated);
        return updated;
      });
      // Invalidate analytics
      setLastAnalyticsFetch(0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update position');
      throw err;
    }
  };

  const removePosition = async (id: string) => {
    try {
      setError(null);
      await positionsAPI.delete(id);
      setPositions((prev) => {
        const updated = prev.filter((pos) => pos._id !== id);
        saveCachedPositions(updated);
        return updated;
      });
      // Invalidate analytics
      setLastAnalyticsFetch(0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove position');
      throw err;
    }
  };

  return (
    <PortfolioContext.Provider
      value={{
        positions,
        loading,
        error,
        addPosition,
        updatePosition,
        removePosition,
        // Analytics
        portfolioAnalytics,
        analyticsLoading,
        fetchAnalytics
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
