import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { positionsAPI } from '../api/positions';
import { stocksAPI, PortfolioAnalytics, RecommendationTrend, PriceTarget, CompanyProfile } from '../api/stocks';
import { useAuth } from './AuthContext';
import { getFinnhubWebSocket, PriceUpdateCallback } from '../services/websocket';
import { initSocket } from '../services/socket';
import { resolvePriceDetails, PriceStatus } from '../lib/priceDetails';

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
  priceSource?: string;
  priceUpdatedAt?: string;
  priceStatus?: PriceStatus;
  change: number; // Daily change $
  changePercent: number; // Daily change %

  // Extended hours data (pre-market or after-hours)
  extendedPrice?: number; // Extended hours price
  extendedChange?: number; // Extended hours change in $
  extendedChangePercent?: number; // Extended hours change %
  marketStatus?: 'regular' | 'pre-market' | 'after-hours' | 'closed'; // Current market status

  quantity: number;
  averagePrice: number;
  broker?: string;
  lots?: Lot[]; // Array of purchase lots
  sparklineData: number[];
  color: string;

  // Added via batch extended quotes
  fiftyTwoWeekLow?: number;
  nextEarningsDate?: keyof any; // using any to bypass strict type, it's a number timestamp from yahoo but we treat it loosely in React
}

interface PortfolioContextType {
  refreshing: boolean;
  positions: Position[];
  loading: boolean;
  positionsLoading: boolean;
  positionsReady: boolean;
  error: string | null;
  addPosition: (symbol: string, name: string, quantity: number, averagePrice: number, date?: string | Date, broker?: string) => Promise<void>;
  updatePosition: (id: string, quantity?: number, averagePrice?: number, lots?: Lot[]) => Promise<void>;
  removePosition: (id: string) => Promise<void>;

  // Analytics State
  portfolioAnalytics: PortfolioAnalytics | null;
  analyticsLoading: boolean;
  fetchAnalytics: (force?: boolean) => Promise<string | void>;

  // Insights State (Persists across tab switches)
  insightsData: {
    recommendations: Record<string, RecommendationTrend[]>;
    priceTargets: Record<string, PriceTarget>;
    profiles: Record<string, CompanyProfile>;
  } | null;
  setInsightsData: (data: any) => void;
  fetchPositions: () => Promise<void>;
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
const ANALYTICS_CACHE_KEY = 'portfolio_analytics_cache_v3'; // v2: keyed by portfolio hash
const INSIGHTS_CACHE_KEY = 'portfolio_insights_cache'; // profiles, recommendations, priceTargets

function loadCachedPositions(userId: string): Position[] {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}:${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].symbol) {
      return parsed.map(p => ({ ...p, priceStatus: p.priceStatus === 'estimated' ? 'estimated' : 'stale' }));
    }
  } catch { /* corrupted cache, ignore */ }
  return [];
}

function saveCachedPositions(positions: Position[], userId: string) {
  try {
    localStorage.setItem(`${CACHE_KEY}:${userId}`, JSON.stringify(positions));
  } catch { /* storage full, ignore */ }
}

function clearCachedPositions(userId: string) {
  localStorage.removeItem(`${CACHE_KEY}:${userId}`);
}

/** Build a stable hash of the portfolio composition for cache keying */
function getPortfolioHash(positions: Position[]): string {
  return positions.map(p => `${p._id}:${p.symbol}:${p.quantity}:${p.averagePrice}:${JSON.stringify(p.lots || [])}`).sort().join(',');
}

/** Check if analytics data contains 50/50/50 backend defaults */
function isDefaultAnalytics(data: PortfolioAnalytics): boolean {
  return data.healthScore === 50 &&
    data.components?.diversification === 50 &&
    data.components?.volatility === 50 &&
    data.components?.sentiment === 50;
}

function loadCachedAnalytics(positions: Position[], userId: string): PortfolioAnalytics | null {
  try {
    const raw = localStorage.getItem(`${ANALYTICS_CACHE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Must have healthScore
    if (!parsed || (parsed.healthScore !== null && typeof parsed.healthScore !== 'number')) return null;
    // NEVER load 50/50/50 defaults from cache
    if (isDefaultAnalytics(parsed)) return null;
    // Must match the current portfolio composition
    const cachedHash = parsed._portfolioHash;
    const currentHash = getPortfolioHash(positions);
    if (cachedHash !== currentHash) return null;
    return parsed;
  } catch { /* corrupted cache, ignore */ }
  return null;
}

function saveCachedAnalytics(analytics: PortfolioAnalytics, positions: Position[], userId: string) {
  try {
    const data = { ...analytics, _portfolioHash: getPortfolioHash(positions) };
    localStorage.setItem(`${ANALYTICS_CACHE_KEY}:${userId}`, JSON.stringify(data));
  } catch { /* storage full, ignore */ }
}

// ── Insights Cache (profiles, recommendations, priceTargets) ──
type InsightsData = {
  recommendations: Record<string, RecommendationTrend[]>;
  priceTargets: Record<string, PriceTarget>;
  profiles: Record<string, CompanyProfile>;
};

function loadCachedInsights(positions: Position[], userId: string): InsightsData | null {
  try {
    const raw = localStorage.getItem(`${INSIGHTS_CACHE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.profiles) return null;
    // Must match the current portfolio
    const cachedHash = parsed._portfolioHash;
    const currentHash = getPortfolioHash(positions);
    if (cachedHash !== currentHash) return null;
    // Must have at least some profiles (otherwise it's empty/rate-limited data)
    if (Object.keys(parsed.profiles).length === 0) return null;
    return {
      recommendations: parsed.recommendations || {},
      priceTargets: parsed.priceTargets || {},
      profiles: parsed.profiles || {}
    };
  } catch { /* corrupted cache, ignore */ }
  return null;
}

function saveCachedInsights(data: InsightsData, positions: Position[], userId: string) {
  try {
    const toSave = { ...data, _portfolioHash: getPortfolioHash(positions) };
    localStorage.setItem(`${INSIGHTS_CACHE_KEY}:${userId}`, JSON.stringify(toSave));
  } catch { /* storage full, ignore */ }
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, token } = useAuth();
  const userId = user?._id || 'signed-out';

  // Initialize from cache for instant render on refresh
  const [positions, setPositions] = useState<Position[]>(() => {
    if (!isAuthenticated) return [];
    return loadCachedPositions(userId);
  });
  // Only show loading if we DON'T have cached data
  const [loading, setLoading] = useState(false);
  // Tracks whether fresh positions have been loaded from API (not just stale cache)
  const [positionsReady, setPositionsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Analytics State — initialize from localStorage cache ONLY if it matches current positions
  const [portfolioAnalytics, setPortfolioAnalytics] = useState<PortfolioAnalytics | null>(() => {
    if (!isAuthenticated) return null;
    const cachedPositions = loadCachedPositions(userId);
    return loadCachedAnalytics(cachedPositions, userId);
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [lastAnalyticsFetch, setLastAnalyticsFetch] = useState<number>(0);

  // Insights State — initialize from localStorage cache for instant display
  const [insightsData, setInsightsDataRaw] = useState<InsightsData | null>(() => {
    if (!isAuthenticated) return null;
    const cachedPositions = loadCachedPositions(userId);
    return loadCachedInsights(cachedPositions, userId);
  });

  // Wrapper that also persists to localStorage
  const setInsightsData = useCallback((data: InsightsData | null) => {
    setInsightsDataRaw(data);
    if (data && positions.length > 0) {
      saveCachedInsights(data, positions, userId);
    }
  }, [positions, userId]);

  const isFetchingPositionsRef = useRef(false);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);
  const symbolsKey = [...new Set(positions.map(p => p.symbol))].sort().join(',');
  const compositionKey = getPortfolioHash(positions);
  const analyticsCompositionRef = useRef(compositionKey);
  analyticsCompositionRef.current = compositionKey;
  const previousCompositionRef = useRef(compositionKey);

  // Fetch positions from backend — FAST: uses batch extended quotes for prices
  const fetchPositions = useCallback(async () => {
    if (isFetchingPositionsRef.current) {
      console.log('fetchPositions already in-flight, skipping to prevent duplicate API hits.');
      return;
    }

    if (!isAuthenticated) {
      setPositions([]);
      clearCachedPositions(userId);
      return;
    }

    isFetchingPositionsRef.current = true;
    setRefreshing(true);
    const hasCachedData = positionsRef.current.length > 0;

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
        console.warn('Market quotes unavailable; retaining previous quotes or labeled estimates');
      }

      // Map positions with prices from batch result — NO individual API calls
      const positionsWithPrices = apiPositions.map((pos: any) => {
        const rawQuote = batchExtendedQuotes[pos.symbol];
        const extendedQuote = Number.isFinite(rawQuote?.regularMarketPrice) && rawQuote.regularMarketPrice > 0 ? rawQuote : undefined;

        // Extract price from batch extended quote (Yahoo Finance data)
        const previous = positionsRef.current.find(p => p._id === pos._id);
        const priceDetails = resolvePriceDetails(extendedQuote, previous, pos.averagePrice);
        const currentPrice = priceDetails.price;
        let change = previous?.change || 0;
        let changePercent = previous?.changePercent || 0;

        if (extendedQuote && priceDetails.priceStatus !== 'estimated') {
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
            } else if (extendedQuote.postMarketPrice) {
              // Pre-market hasn't started yet — show last AH price (like Yahoo/Google Finance do)
              marketStatus = 'after-hours';
              extendedPrice = extendedQuote.postMarketPrice;
              extendedChange = extendedQuote.postMarketChange || 0;
              extendedChangePercent = extendedQuote.postMarketChangePercent || 0;
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
          broker: pos.broker || 'Default',
          lots: pos.lots,
          ...priceDetails,
          change,
          changePercent,
          extendedPrice,
          extendedChange,
          extendedChangePercent,
          marketStatus,
          fiftyTwoWeekLow: extendedQuote?.fiftyTwoWeekLow,
          nextEarningsDate: extendedQuote?.earningsTimestamp,
          sparklineData: previous?.sparklineData || Array(10).fill(currentPrice),
          color: change >= 0 ? '#10B981' : '#EF4444',
        };
      });

      if (!activeRef.current) return;
      setPositions(positionsWithPrices);
      // Save fresh data to localStorage for next refresh
      saveCachedPositions(positionsWithPrices, userId);
      // Mark positions as ready (fresh from API, not stale cache)
      setPositionsReady(true);
    } catch (err: any) {
      if (!activeRef.current) return;
      setError(err.message || 'Failed to load positions');
      console.error('Error fetching positions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingPositionsRef.current = false;
    }
  }, [isAuthenticated, userId]);

  // Fetch Analytics (Health Score, TWR, etc.)
  const fetchAnalytics = useCallback(async (force = false) => {
    if (positions.length === 0) return;

    const now = Date.now();
    if (!force && analyticsLoading) return;
    if (!force && lastAnalyticsFetch > 0 && (now - lastAnalyticsFetch < 10 * 60 * 1000)) {
      return;
    }

    try {
      // Only show loading spinner if we have NO analytics at all (no cache)
      if (!portfolioAnalytics) {
        setAnalyticsLoading(true);
      }
      const symbols = positions.map(p => p.symbol);
      const quantities = positions.map(p => p.quantity);
      const prices = positions.map(p => p.price);

      const requestedComposition = getPortfolioHash(positions);
      const data = await stocksAPI.getPortfolioAnalytics(symbols, quantities, prices);
      if (!activeRef.current || requestedComposition !== analyticsCompositionRef.current) return 'outdated';

      // Detect if the backend returned default/placeholder values (cold-start fallback)
      if (isDefaultAnalytics(data)) {
        // NEVER show or cache 50/50/50 defaults — they are meaningless
        // Don't update lastAnalyticsFetch → allows retry
        return 'defaults';
      } else {
        setPortfolioAnalytics(data);
        setLastAnalyticsFetch(Date.now());
        saveCachedAnalytics(data, positions, userId);
        return 'success';
      }
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      return 'error';
    } finally {
      setAnalyticsLoading(false);
    }
  }, [positions, analyticsLoading, portfolioAnalytics, lastAnalyticsFetch, userId]);

  // Load positions on mount
  useEffect(() => {
    fetchPositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPositions]);

  // Invalidate analytics timestamp when positions change (add/remove)
  useEffect(() => {
    if (previousCompositionRef.current !== compositionKey) {
      setPortfolioAnalytics(null);
      previousCompositionRef.current = compositionKey;
    }
    setLastAnalyticsFetch(0);
  }, [compositionKey]);

  // Eagerly fetch analytics after fresh positions load
  // If backend returns defaults (cold start), retry up to 3 times with 5s delay
  useEffect(() => {
    if (positions.length === 0 || !positionsReady) return;

    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout>;

    const attemptFetch = async () => {
      const result = await fetchAnalytics();
      if (result === 'defaults' && retryCount < 3) {
        retryCount++;
        retryTimer = setTimeout(attemptFetch, 5000);
      }
    };

    attemptFetch();
    return () => clearTimeout(retryTimer);
  }, [positions.length, positionsReady, fetchAnalytics]);

  // Background sparkline enrichment — runs AFTER positions are rendered
  useEffect(() => {
    if (!symbolsKey || !isAuthenticated) return;
    let cancelled = false;

    // Only enrich if sparklines are still placeholders (all values identical)
    const needsEnrichment = positions.some(p =>
      p.sparklineData.length > 0 && new Set(p.sparklineData).size === 1
    );
    if (!needsEnrichment) return;

    const enrichSparklines = async () => {
      const to = Math.floor(Date.now() / 60000) * 60;
      const from = to - (30 * 24 * 60 * 60); // 30 days ago

      const results = await stocksAPI.getBatchHistory(symbolsKey.split(','), from, to);
      if (cancelled) return;

      // Batch update all sparklines at once
      setPositions(prev => {
        const enriched = prev.map(pos => {
          const history = results[pos.symbol];
          return history?.c?.length ? { ...pos, sparklineData: history.c } : pos;
        });

        // Save the enriched positions (with sparklines) to localStorage
        // This allows them to render instantly on next page load (Stale-While-Revalidate)
        saveCachedPositions(enriched, userId);
        return enriched;
      });
    };

    void enrichSparklines().catch(() => console.warn('Price history temporarily unavailable'));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, isAuthenticated, userId]);

  // WebSocket integration for real-time updates
  useEffect(() => {
    if (!isAuthenticated || !token || !symbolsKey) return;

    console.log('🚀 Initializing WebSocket for real-time updates...');
    const ws = getFinnhubWebSocket();
    initSocket(token);

    // Connect to WebSocket
    ws.connect();

    // Subscribe to all position symbols
    const symbols = symbolsKey.split(',').filter(s => !s.startsWith('FUND:') && !/^\d+$/.test(s));
    symbols.forEach(symbol => ws.subscribeToSymbol(symbol));

    // Handle price updates
    const handlePriceUpdate: PriceUpdateCallback = (symbol, price, timestamp) => {
      setPositions(prev => prev.map(pos => {
        if (pos.symbol === symbol) {
          if (pos.priceUpdatedAt && timestamp * 1000 < new Date(pos.priceUpdatedAt).getTime()) return pos;
          // Check market status
          const marketStatus = getMarketStatus();
          const inExtendedHours = marketStatus !== 'regular';
          // Extended-hours change is relative to regular close.
          const baseline = inExtendedHours ? pos.price : pos.price - pos.change;
          const change = price - baseline;
          const changePercent = baseline > 0 ? (change / baseline) * 100 : 0;

          return {
            ...pos,
            price: inExtendedHours ? pos.price : price,
            change: inExtendedHours ? pos.change : change,
            changePercent: inExtendedHours ? pos.changePercent : changePercent,
            priceSource: inExtendedHours ? pos.priceSource : 'Finnhub',
            priceUpdatedAt: inExtendedHours ? pos.priceUpdatedAt : new Date(timestamp * 1000).toISOString(),
            priceStatus: inExtendedHours ? pos.priceStatus : 'available',

            // Update extended hours data when market is not in regular session
            extendedPrice: inExtendedHours ? price : undefined,
            extendedChange: inExtendedHours ? change : undefined,
            extendedChangePercent: inExtendedHours ? changePercent : undefined,
            marketStatus,

            fiftyTwoWeekLow: pos.fiftyTwoWeekLow, // retain
            nextEarningsDate: pos.nextEarningsDate, // retain

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
      symbols.forEach(symbol => ws.unsubscribeFromSymbol(symbol));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token, symbolsKey]);

  const addPosition = async (symbol: string, name: string, quantity: number, averagePrice: number, date?: string | Date, broker?: string) => {
    try {
      setError(null);
      const assignedBroker = (broker && typeof broker === 'string' && broker.trim()) ? broker.trim() : 'Default';
      const newPosition = await positionsAPI.create({
        symbol: symbol.toUpperCase(),
        name,
        quantity,
        averagePrice, // Ensure this field is sent
        date: date || new Date(),
        broker: assignedBroker,
      });

      // Try to fetch current price, but don't fail if it doesn't work
      let currentPrice = averagePrice; // Default to average price
      let change = 0;
      let changePercent = 0;
      let priceDetails = resolvePriceDetails(undefined, undefined, averagePrice);

      try {
        const quote = await stocksAPI.getQuote(symbol);
        priceDetails = resolvePriceDetails({ regularMarketPrice: quote.c, regularMarketTime: quote.t, source: quote.source || 'Market data' }, undefined, averagePrice);
        currentPrice = priceDetails.price;
        if (priceDetails.priceStatus !== 'estimated') {
          const previousClose = Number.isFinite(quote.pc) && quote.pc > 0 ? quote.pc : currentPrice;
          change = currentPrice - previousClose;
          changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
        }
      } catch (priceError) {
        console.warn(`Could not fetch price for ${symbol}, using defaults: `, priceError);
        // Price will stay as averagePrice, which is a reasonable default
      }

      // Check market status
      const marketStatus = getMarketStatus();
      const inExtendedHours = marketStatus !== 'regular';

      const positionWithPrice: Position = {
        _id: newPosition._id,
        symbol: newPosition.symbol,
        name: newPosition.name,
        broker: newPosition.broker || assignedBroker,
        quantity: newPosition.quantity,
        averagePrice: newPosition.averagePrice,
        lots: newPosition.lots,
        ...priceDetails,
        change,
        changePercent,

        // Extended hours data
        extendedPrice: inExtendedHours ? currentPrice : undefined,
        extendedChange: inExtendedHours ? change : undefined,
        extendedChangePercent: inExtendedHours ? changePercent : undefined,
        marketStatus,

        fiftyTwoWeekLow: undefined, // Will be fetched on next refresh or WS doesn't provide
        nextEarningsDate: undefined,

        sparklineData: Array.from({ length: 8 }, () => currentPrice),
        color: change >= 0 ? '#10B981' : '#EF4444',
      };

      setPositions((prev) => {
        const existingIdx = prev.findIndex(p => p._id === newPosition._id);
        let updated: Position[];
        if (existingIdx >= 0) {
          updated = prev.map((p, idx) => idx === existingIdx ? {
            ...p,
            quantity: newPosition.quantity,
            averagePrice: newPosition.averagePrice,
            lots: newPosition.lots,
            broker: newPosition.broker || p.broker || assignedBroker
          } : p);
        } else {
          updated = [...prev, positionWithPrice];
        }
        saveCachedPositions(updated, userId);
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
              fiftyTwoWeekLow: pos.fiftyTwoWeekLow,
              nextEarningsDate: pos.nextEarningsDate,
              sparklineData: pos.sparklineData,
              color: pos.color
            }
            : pos
        );
        saveCachedPositions(updated, userId);
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
        saveCachedPositions(updated, userId);
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
        refreshing,
        loading,
        positionsLoading: loading,
        positionsReady,
        error,
        fetchPositions,
        addPosition,
        updatePosition,
        removePosition,
        // Analytics
        portfolioAnalytics,
        analyticsLoading,
        fetchAnalytics,
        insightsData,
        setInsightsData
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
