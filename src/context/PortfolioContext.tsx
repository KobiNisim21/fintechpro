import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { positionsAPI } from '../api/positions';
import { stocksAPI } from '../api/stocks';
import { useAuth } from './AuthContext';
import { getFinnhubWebSocket, PriceUpdateCallback } from '../services/websocket';

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
  sparklineData: number[];
  color: string;
}

interface PortfolioContextType {
  positions: Position[];
  loading: boolean;
  error: string | null;
  addPosition: (symbol: string, name: string, quantity: number, averagePrice: number) => Promise<void>;
  updatePosition: (id: string, quantity?: number, averagePrice?: number) => Promise<void>;
  removePosition: (id: string) => Promise<void>;
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

// Check if we're in extended hours (pre-market or after-hours)
function isExtendedHours(): boolean {
  const status = getMarketStatus();
  return status !== 'regular';
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch positions from backend — FAST: uses batch extended quotes for prices
  const fetchPositions = async () => {
    if (!isAuthenticated) {
      setPositions([]);
      return;
    }

    try {
      setLoading(true);
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
    } catch (err: any) {
      setError(err.message || 'Failed to load positions');
      console.error('Error fetching positions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load positions on mount and when auth status changes
  useEffect(() => {
    fetchPositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

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

  const addPosition = async (symbol: string, name: string, quantity: number, averagePrice: number) => {
    try {
      setError(null);
      const newPosition = await positionsAPI.create({
        symbol: symbol.toUpperCase(),
        name,
        quantity,
        averagePrice, // Ensure this field is sent
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

      setPositions((prev) => [...prev, positionWithPrice]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add position');
      throw err;
    }
  };

  const updatePosition = async (id: string, quantity?: number, averagePrice?: number) => {
    try {
      setError(null);
      await positionsAPI.update(id, { quantity, averagePrice });

      // Update local state
      setPositions((prev) =>
        prev.map((pos) =>
          pos._id === id
            ? { ...pos, quantity: quantity ?? pos.quantity, averagePrice: averagePrice ?? pos.averagePrice }
            : pos
        )
      );
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update position');
      throw err;
    }
  };

  const removePosition = async (id: string) => {
    try {
      setError(null);
      await positionsAPI.delete(id);
      setPositions((prev) => prev.filter((pos) => pos._id !== id));
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
