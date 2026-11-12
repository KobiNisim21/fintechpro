import { t, useLanguage, locale } from '@/i18n';
import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { Plus, X, Trash2, Eye, TrendingUp, TrendingDown, Search, RefreshCw } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { watchlistAPI, WatchlistItem } from '@/api/watchlist';
import { stocksAPI, type ExtendedQuote } from '@/api/stocks';
import { ExtendedHoursQuotes } from './ExtendedHoursQuotes';
import { PriceFreshness } from './PriceFreshness';
import { resolvePriceDetails, type PriceStatus } from '@/lib/priceDetails';
import { SimpleDialog } from './SimpleDialog';
import { Button } from '@/components/ui/button';

// ─── Types ──────────────────────────────────────────────────────
interface WatchlistStock extends WatchlistItem {
    quote?: ExtendedQuote;
    price: number;
    priceSource?: string;
    priceUpdatedAt?: string;
    priceStatus?: PriceStatus;
    dailyChange: number | null;
    weeklyChange: number | null;
    monthlyChange: number | null;
    yearlyChange: number | null;
    chartData: { date: string; price: number }[];
    loaded: boolean;
}

// ─── Skeleton ───────────────────────────────────────────────────
function SkeletonCard() {
    useLanguage();
    return (
        <div className="relative overflow-hidden rounded-[32px] bg-[var(--color-ios-card)] backdrop-blur-xl border border-white/60 shadow-[var(--shadow-ios-card)] p-5 pb-6 animate-pulse">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="h-5 w-20 bg-[var(--color-ios-input)] rounded mb-2" />
                    <div className="h-3 w-32 bg-[var(--color-ios-input)] rounded" />
                </div>
                <div className="h-8 w-24 bg-[var(--color-ios-input)] rounded" />
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-[var(--color-ios-input)] rounded-[16px]" />
                ))}
            </div>
            <div className="h-32 bg-[var(--color-ios-input)] rounded-[16px]" />
        </div>
    );
}

// ─── Custom Chart Tooltip ───────────────────────────────────────
function ChartTooltipContent({ active, payload, label }: any) {
    useLanguage();
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[var(--color-ios-card)] border border-white/60 rounded-[16px] px-3 py-2 backdrop-blur-xl shadow-[var(--shadow-ios-card)]">
            <p className="text-[var(--color-ios-secondary)]  text-xs mb-0.5">{new Date(label).toLocaleDateString(locale())}</p>
            <p dir="ltr" className="text-[var(--color-ios-fg)] font-bold  text-sm">${payload[0].value.toFixed(2)}</p>
        </div>
    );
}

// ─── Change Badge ───────────────────────────────────────────────
function ChangeBadge({ label, value }: { label: string; value: number | null }) {
    useLanguage();
    if (value === null) return (
        <div className="flex flex-col items-center p-2 rounded-[16px] bg-[var(--color-ios-input)] shadow-none">
            <span className="text-[10px] text-[var(--color-ios-secondary)] uppercase tracking-wide font-bold">{t(label)}</span>
            <span className="text-xs text-[var(--color-ios-secondary)] font-bold mt-0.5">—</span>
        </div>
    );

    const isPositive = value >= 0;
    return (
        <div className="flex flex-col items-center p-2 rounded-[16px] bg-[var(--color-ios-input)] shadow-[var(--shadow-ios-card)] transition-colors">
            <span className="text-[10px] text-[var(--color-ios-secondary)] uppercase tracking-wide font-bold">{t(label)}</span>
            <span dir="ltr" className={`text-xs font-bold  mt-0.5 flex items-center gap-0.5 ${isPositive ? 'text-[var(--color-ios-success)]' : 'text-[var(--color-ios-danger)]'}`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isPositive ? '+' : ''}{value.toFixed(2)}%
            </span>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════
//  WATCHLIST VIEW
// ═════════════════════════════════════════════════════════════════
export interface WatchlistHandle { refresh: () => Promise<void> }

export const WatchlistView = forwardRef<WatchlistHandle>(function WatchlistView(_, ref) {
    useLanguage();
    const [watchlist, setWatchlist] = useState<WatchlistStock[]>([]);
    const [loading, setLoading] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [refreshError, setRefreshError] = useState(false);
    const inFlight = useRef<Promise<void> | null>(null);
    const generation = useRef(0);
    const historyCache = useRef(new Map<string, { data: Awaited<ReturnType<typeof stocksAPI.getStockHistory>>; at: number }>());

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [addingSymbol, setAddingSymbol] = useState('');

    // ─── Fetch watchlist from API ─────────────────────────────────
    const fetchWatchlist = useCallback((): Promise<void> => {
        if (inFlight.current) return inFlight.current;
        const currentGeneration = generation.current;
        const current = () => currentGeneration === generation.current;
        const run = async () => {
        try {
            setLoading(true);
            setRefreshError(false);
            const items = await watchlistAPI.getAll();
            if (!current()) return;

            // Initialize with empty data
            const stocks: WatchlistStock[] = items.map(item => ({
                ...item,
                price: 0,
                dailyChange: null,
                weeklyChange: null,
                monthlyChange: null,
                yearlyChange: null,
                chartData: [],
                loaded: false,
            }));

            setWatchlist(prev => stocks.map(stock => ({ ...stock, ...prev.find(existing => existing._id === stock._id) })));

            if (stocks.length === 0) {
                setLoading(false);
                return;
            }

            // Fetch prices + history in parallel
            const symbols = stocks.map(s => s.symbol);

            // 1. Batch quotes for current prices
            let batchQuotes: Record<string, ExtendedQuote> = {};
            try {
                batchQuotes = await stocksAPI.getBatchExtendedQuotes(symbols);
            } catch { if (current()) setRefreshError(true); }
            if (!current()) return;
            if (symbols.some(symbol => !Number.isFinite(batchQuotes[symbol]?.regularMarketPrice) || !(batchQuotes[symbol]?.regularMarketPrice > 0))) setRefreshError(true);
            // Show received prices immediately; charts must not block quotes.
            setWatchlist(prev => prev.map(stock => {
                const quote = batchQuotes[stock.symbol];
                const details = resolvePriceDetails(quote, stock, 0);
                return { ...stock, ...details, quote: details.priceStatus === 'estimated' || details.priceStatus === 'stale' ? stock.quote : quote, loaded: true };
            }));

            // 2. Historical data for each symbol (1 year)
            const to = Math.floor(Date.now() / 1000);
            const from = to - (365 * 24 * 60 * 60); // 1 year ago

            const historyResults = await Promise.all(
                symbols.map(async (symbol) => {
                    const cached = historyCache.current.get(symbol);
                    if (cached && Date.now() - cached.at < 15 * 60_000) return { symbol, data: cached.data };
                    try {
                        const data = await stocksAPI.getStockHistory(symbol, from, to, 'D');
                        if (current()) historyCache.current.set(symbol, { data, at: Date.now() });
                        return { symbol, data };
                    } catch {
                        return { symbol, data: cached?.data ?? { c: [], t: [] } };
                    }
                })
            );
            if (!current()) return;

            // 3. Combine all data
            setWatchlist(prev => prev.map(stock => {
                const quote = batchQuotes[stock.symbol];
                const histResult = historyResults.find(r => r.symbol === stock.symbol);
                const hist = histResult?.data;

                const details = resolvePriceDetails(quote, stock, 0);
                const currentPrice = details.price;
                const closePrices = hist?.c || [];
                const timestamps = hist?.t || [];

                // Calculate period changes from history
                const now = Date.now() / 1000;
                const oneDay = 24 * 60 * 60;

                const findPriceAtAge = (seconds: number): number | null => {
                    const target = now - seconds;
                    for (let i = timestamps.length - 1; i >= 0; i--) {
                        if (timestamps[i] <= target) return closePrices[i];
                    }
                    return closePrices[0] || null;
                };

                const calcChange = (oldPrice: number | null): number | null => {
                    if (!oldPrice || !Number.isFinite(oldPrice) || oldPrice <= 0 || currentPrice <= 0) return null;
                    return ((currentPrice - oldPrice) / oldPrice) * 100;
                };

                const dailyChange = typeof quote?.regularMarketChangePercent === 'number' && Number.isFinite(quote.regularMarketChangePercent)
                    ? quote.regularMarketChangePercent : calcChange(findPriceAtAge(1 * oneDay));
                const weeklyChange = calcChange(findPriceAtAge(7 * oneDay));
                const monthlyChange = calcChange(findPriceAtAge(30 * oneDay));
                const yearlyChange = calcChange(findPriceAtAge(365 * oneDay));

                // Chart data (last 30 days for clean display)
                const thirtyDaysAgo = now - (30 * oneDay);
                const chartData: { date: string; price: number }[] = [];
                for (let i = 0; i < timestamps.length; i++) {
                    if (timestamps[i] >= thirtyDaysAgo) {
                        chartData.push({
                            date: new Date(timestamps[i] * 1000).toISOString(),
                            price: closePrices[i],
                        });
                    }
                }

                return {
                    ...stock,
                    ...details,
                    dailyChange,
                    weeklyChange,
                    monthlyChange,
                    yearlyChange,
                    chartData: chartData.length ? chartData : stock.chartData,
                    loaded: true,
                };
            }));
        } catch (err) {
            console.error('Failed to load watchlist:', err);
            if (current()) {
                setRefreshError(true);
                setWatchlist(prev => prev.map(stock => ({ ...stock, priceStatus: 'stale' })));
            }
        } finally {
            if (current()) setLoading(false);
        }
        };
        const task = run();
        inFlight.current = task;
        void task.finally(() => { if (inFlight.current === task) inFlight.current = null; });
        return task;
    }, []);

    useImperativeHandle(ref, () => ({ refresh: fetchWatchlist }), [fetchWatchlist]);

    useEffect(() => {
        void fetchWatchlist();
        const refreshVisible = () => { if (document.visibilityState === 'visible') void fetchWatchlist(); };
        const timer = setInterval(refreshVisible, 60_000);
        window.addEventListener('focus', refreshVisible);
        document.addEventListener('visibilitychange', refreshVisible);
        return () => {
            generation.current++;
            clearInterval(timer);
            window.removeEventListener('focus', refreshVisible);
            document.removeEventListener('visibilitychange', refreshVisible);
        };
    }, [fetchWatchlist]);

    // ─── Search debounce ──────────────────────────────────────────
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length > 1) {
                setSearching(true);
                try {
                    const results = await stocksAPI.search(searchQuery);
                    setSearchResults(results);
                } catch {
                    setSearchResults([]);
                } finally {
                    setSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // ─── Add to watchlist ─────────────────────────────────────────
    const handleAdd = async (symbol: string, name: string) => {
        setAddingSymbol(symbol);
        try {
            await watchlistAPI.add(symbol, name);
            setAddDialogOpen(false);
            setSearchQuery('');
            setSearchResults([]);
            fetchWatchlist(); // refresh
        } catch (err: any) {
            alert(t(err.response?.data?.message || 'Failed to add'));
        } finally {
            setAddingSymbol('');
        }
    };

    // ─── Remove from watchlist ────────────────────────────────────
    const handleRemove = async (id: string) => {
        setWatchlist(prev => prev.filter(s => s._id !== id));
        try {
            await watchlistAPI.remove(id);
        } catch {
            fetchWatchlist(); // rollback on error
        }
    };

    // ─── Empty State ──────────────────────────────────────────────
    if (!loading && watchlist.length === 0 && !refreshError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-[var(--color-ios-card)] rounded-[32px] border border-white/60 shadow-[var(--shadow-ios-card)]">
                <div className="w-20 h-20 rounded-[24px] bg-[var(--color-ios-input)] flex items-center justify-center mb-6 shadow-none text-cyan-500">
                    <Eye className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold  text-[var(--color-ios-fg)] mb-2">{t("No Stocks in Watchlist")}</h3>
                <p className="text-[var(--color-ios-secondary)] font-bold text-sm mb-6 text-center max-w-sm">
                    {t("Add stocks to track their daily, weekly, monthly, and yearly performance — without adding them to your portfolio.")}</p>
                <Button
                    onClick={() => setAddDialogOpen(true)}
                    className="bg-[var(--color-ios-input)] hover:bg-white text-[var(--color-ios-fg)] font-bold border-none shadow-[var(--shadow-ios-card)] hover:shadow-[var(--shadow-ios-card)] active:scale-[0.92] transition-all"
                >
                    <Plus className="w-4 h-4 me-2" /> {t(" Add to Watchlist")}</Button>
                {renderAddDialog()}
            </div>
        );
    }

    // ─── Add Dialog ───────────────────────────────────────────────
    function renderAddDialog() {
        return (
            <SimpleDialog open={addDialogOpen} onClose={() => { setAddDialogOpen(false); setSearchQuery(''); setSearchResults([]); }}>
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => { setAddDialogOpen(false); setSearchQuery(''); setSearchResults([]); }}
                        style={{
                            position: 'absolute', top: '-4px', right: '-4px',
                            background: 'var(--color-ios-input)', border: 'none',
                            color: 'var(--color-ios-secondary)', cursor: 'pointer',
                            padding: '8px', borderRadius: '16px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s', boxShadow: 'inset -2px -2px 5px rgba(255, 255, 255, 0.7), inset 2px 2px 5px rgba(0, 0, 0, 0.05)'
                        }}
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <h2 className="text-2xl font-bold  text-[var(--color-ios-fg)] mb-2">
                        {t("Add to Watchlist")}</h2>
                    <p className="text-sm font-bold text-[var(--color-ios-secondary)] mb-4">
                        {t("Search for a stock to track its performance.")}</p>

                    {/* Search Input */}
                    <div className="relative mb-4">
                        <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ios-secondary)]" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t("Search by symbol or name...")}
                            className="w-full ps-11 pe-4 py-3 bg-[var(--color-ios-input)] shadow-none rounded-[16px] text-[var(--color-ios-fg)] font-bold text-sm placeholder:text-[var(--color-ios-secondary)] focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all  border-none"
                            autoFocus
                        />
                    </div>

                    {/* Results */}
                    <div className="max-h-64 overflow-y-auto space-y-2 p-1">
                        {searching && (
                            <div className="text-center py-6 text-[var(--color-ios-secondary)] font-bold text-sm">{t("Searching...")}</div>
                        )}
                        {!searching && searchQuery.length > 1 && searchResults.length === 0 && (
                            <div className="text-center py-6 text-[var(--color-ios-secondary)] font-bold text-sm">{t("No stocks found.")}</div>
                        )}
                        {searchResults.map((stock) => (
                            <button
                                key={stock.symbol}
                                onClick={() => handleAdd(stock.symbol, stock.description)}
                                disabled={addingSymbol === stock.symbol}
                                className="w-full flex items-center justify-between p-3 rounded-[16px] hover:bg-white/80 bg-[var(--color-ios-card)] shadow-[var(--shadow-ios-card)] hover:shadow-[var(--shadow-ios-card)] active:scale-[0.98] transition-all group text-start border-white/60 border"
                            >
                                <div>
                                    <span className="text-[var(--color-ios-fg)] font-bold  text-sm">{stock.displaySymbol}</span>
                                    <span className="text-[var(--color-ios-secondary)] font-bold text-xs ms-2">{t(stock.type)}</span>
                                    <p className="text-[var(--color-ios-secondary)] font-bold text-xs mt-0.5 truncate max-w-[220px]">{stock.description}</p>
                                </div>
                                <span className="text-cyan-600 font-bold text-xs opacity-100 transition-opacity">
                                    {addingSymbol === stock.symbol ? t("Adding...") : t("+ Add")}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </SimpleDialog>
        );
    }

    // ─── Main Render ──────────────────────────────────────────────
    return (
        <div>
            {/* Header with Add Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-2">
                <div className="flex items-center gap-2 text-[var(--color-ios-secondary)] font-bold">
                    <Eye className="w-5 h-5 text-cyan-600" />
                    <span className="text-sm">{t("{0} securities tracked", [watchlist.length])}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                <button type="button" className="data-action inline-flex items-center gap-2" disabled={loading} onClick={() => void fetchWatchlist()}>
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />{t('Refresh')}
                </button>
                <Button
                    onClick={() => setAddDialogOpen(true)}
                    size="sm"
                    className="bg-[var(--color-ios-input)] hover:bg-white text-[var(--color-ios-fg)] font-bold shadow-[var(--shadow-ios-card)] hover:shadow-[var(--shadow-ios-card)] border-none active:scale-[0.92] transition-all rounded-[16px] px-4"
                >
                    <Plus className="w-4 h-4 me-1" /> {t(" Add Stock")}</Button>
                </div>
            </div>
            {refreshError && <p role="status" className="text-caption text-warning mb-4">{t('Watchlist refresh failed. Previous prices are kept where available. Retry Refresh.')}</p>}

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading && watchlist.length === 0
                    ? [0, 1, 2, 3].map(i => <SkeletonCard key={i} />)
                    : watchlist.map(stock => (
                        <div
                            key={stock._id}
                            className="relative overflow-hidden rounded-[32px] bg-[var(--color-ios-card)] border border-white/60 backdrop-blur-xl shadow-[var(--shadow-ios-card)] p-5 pb-6 hover:-translate-y-2 hover:shadow-[var(--shadow-ios-card)]Hover transition-all duration-500 group"
                        >
                            {/* Header: Symbol + Price */}
                            <div className="watchlist-card-header">
                                <div className="watchlist-card-identity min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                            <span className="text-cyan-400 text-xs font-bold">{stock.symbol.slice(0, 2)}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-[var(--color-ios-fg)] font-bold text-lg  tracking-tight leading-none"><bdi dir="ltr">{stock.symbol}</bdi></h3>
                                            <p className="text-[13px] font-bold text-[var(--color-ios-secondary)] truncate max-w-[150px]  mt-0.5"><bdi>{stock.name}</bdi></p>
                                        </div>
                                    </div>
                                </div>
                                <div className="watchlist-card-price text-end min-w-0">
                                    <p dir="ltr" className="text-xl font-bold text-[var(--color-ios-fg)]  tracking-tight">
                                        {stock.loaded ? stock.price > 0 ? `$${stock.price.toFixed(2)}` : t('Price unavailable') : '...'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(stock._id)}
                                    className="data-action watchlist-remove"
                                    aria-label={t("Remove from watchlist")}
                                    title={t("Remove from watchlist")}
                                >
                                    <Trash2 size={18} aria-hidden="true" />
                                </button>
                            </div>

                            {stock.price > 0 && <PriceFreshness source={stock.priceSource} updatedAt={stock.priceUpdatedAt} status={stock.priceStatus} />}

                            <div className="mb-4"><ExtendedHoursQuotes quote={stock.quote} loaded={stock.loaded} /></div>

                            {/* Performance Badges */}
                            <div className="grid grid-cols-4 gap-2 mb-4">
                                <ChangeBadge label={t("Day")} value={stock.loaded ? stock.dailyChange : null} />
                                <ChangeBadge label={t("Week")} value={stock.loaded ? stock.weeklyChange : null} />
                                <ChangeBadge label={t("Month")} value={stock.loaded ? stock.monthlyChange : null} />
                                <ChangeBadge label={t("Year")} value={stock.loaded ? stock.yearlyChange : null} />
                            </div>

                            {/* Interactive Chart */}
                            <div className="h-32 -mx-1">
                                {stock.chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={stock.chartData}>
                                            <defs>
                                                <linearGradient id={`grad-${stock.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={(stock.monthlyChange ?? 0) >= 0 ? 'var(--app-positive)' : 'var(--app-negative)'} stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor={(stock.monthlyChange ?? 0) >= 0 ? 'var(--app-positive)' : 'var(--app-negative)'} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="var(--color-ios-secondary)"
                                                style={{ fontSize: '10px' }}
                                                tickLine={false}
                                                axisLine={false}
                                                minTickGap={40}
                                            />
                                            <YAxis
                                                stroke="var(--color-ios-secondary)"
                                                style={{ fontSize: '10px', fontWeight: 'bold' }}
                                                tickLine={false}
                                                axisLine={false}
                                                domain={['auto', 'auto']}
                                                tickFormatter={(v) => `$${v.toFixed(0)}`}
                                                width={45}
                                            />
                                            <Tooltip content={<ChartTooltipContent />} />
                                            <Line
                                                type="monotone"
                                                dataKey="price"
                                                stroke={(stock.monthlyChange ?? 0) >= 0 ? 'var(--app-positive)' : 'var(--app-negative)'}
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 4, fill: (stock.monthlyChange ?? 0) >= 0 ? 'var(--app-positive)' : 'var(--app-negative)', stroke: '#fff', strokeWidth: 1 }}
                                                fill={`url(#grad-${stock.symbol})`}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center">
                                        <span className="text-white/20 text-xs">{t("Loading chart...")}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                }
            </div>

            {renderAddDialog()}
        </div>
    );
});
