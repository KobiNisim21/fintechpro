import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2, Eye, TrendingUp, TrendingDown, Search } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { watchlistAPI, WatchlistItem } from '@/api/watchlist';
import { stocksAPI } from '@/api/stocks';
import { SimpleDialog } from './SimpleDialog';
import { Button } from '@/components/ui/button';

// ─── Types ──────────────────────────────────────────────────────
interface WatchlistStock extends WatchlistItem {
    price: number;
    dailyChange: number;
    weeklyChange: number;
    monthlyChange: number;
    yearlyChange: number;
    chartData: { date: string; price: number }[];
    loaded: boolean;
}

// ─── Skeleton ───────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="relative overflow-hidden rounded-[32px] bg-[var(--color-clay-card-bg)] backdrop-blur-xl border border-white/60 shadow-clayCard p-5 pb-6 animate-pulse">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="h-5 w-20 bg-[var(--color-clay-input-bg)] rounded mb-2" />
                    <div className="h-3 w-32 bg-[var(--color-clay-input-bg)] rounded" />
                </div>
                <div className="h-8 w-24 bg-[var(--color-clay-input-bg)] rounded" />
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-[var(--color-clay-input-bg)] rounded-[16px]" />
                ))}
            </div>
            <div className="h-32 bg-[var(--color-clay-input-bg)] rounded-[16px]" />
        </div>
    );
}

// ─── Custom Chart Tooltip ───────────────────────────────────────
function ChartTooltipContent({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[var(--color-clay-card-bg)] border border-white/60 rounded-[16px] px-3 py-2 backdrop-blur-xl shadow-clayCard">
            <p className="text-[var(--color-clay-muted)] font-display text-xs mb-0.5">{label}</p>
            <p className="text-[var(--color-clay-fg)] font-black font-display text-sm">${payload[0].value.toFixed(2)}</p>
        </div>
    );
}

// ─── Change Badge ───────────────────────────────────────────────
function ChangeBadge({ label, value }: { label: string; value: number | null }) {
    if (value === null) return (
        <div className="flex flex-col items-center p-2 rounded-[16px] bg-[var(--color-clay-input-bg)] shadow-clayPressed">
            <span className="text-[10px] text-[var(--color-clay-muted)] uppercase tracking-wide font-bold">{label}</span>
            <span className="text-xs text-[var(--color-clay-muted)] font-bold mt-0.5">—</span>
        </div>
    );

    const isPositive = value >= 0;
    return (
        <div className="flex flex-col items-center p-2 rounded-[16px] bg-[var(--color-clay-input-bg)] shadow-clayOrb transition-colors">
            <span className="text-[10px] text-[var(--color-clay-muted)] uppercase tracking-wide font-bold">{label}</span>
            <span className={`text-xs font-black font-display mt-0.5 flex items-center gap-0.5 ${isPositive ? 'text-[var(--color-clay-success)]' : 'text-[var(--color-clay-danger)]'}`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isPositive ? '+' : ''}{value.toFixed(2)}%
            </span>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════
//  WATCHLIST VIEW
// ═════════════════════════════════════════════════════════════════
export function WatchlistView() {
    const [watchlist, setWatchlist] = useState<WatchlistStock[]>([]);
    const [loading, setLoading] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [addingSymbol, setAddingSymbol] = useState('');

    // ─── Fetch watchlist from API ─────────────────────────────────
    const fetchWatchlist = useCallback(async () => {
        try {
            setLoading(true);
            const items = await watchlistAPI.getAll();

            // Initialize with empty data
            const stocks: WatchlistStock[] = items.map(item => ({
                ...item,
                price: 0,
                dailyChange: 0,
                weeklyChange: 0,
                monthlyChange: 0,
                yearlyChange: 0,
                chartData: [],
                loaded: false,
            }));

            setWatchlist(stocks);

            if (stocks.length === 0) {
                setLoading(false);
                return;
            }

            // Fetch prices + history in parallel
            const symbols = stocks.map(s => s.symbol);

            // 1. Batch quotes for current prices
            let batchQuotes: Record<string, any> = {};
            try {
                batchQuotes = await stocksAPI.getBatchExtendedQuotes(symbols);
            } catch { /* fallback below */ }

            // 2. Historical data for each symbol (1 year)
            const to = Math.floor(Date.now() / 1000);
            const from = to - (365 * 24 * 60 * 60); // 1 year ago

            const historyResults = await Promise.all(
                symbols.map(async (symbol) => {
                    try {
                        const data = await stocksAPI.getStockHistory(symbol, from, to, 'D');
                        return { symbol, data };
                    } catch {
                        return { symbol, data: { c: [], t: [] } };
                    }
                })
            );

            // 3. Combine all data
            setWatchlist(prev => prev.map(stock => {
                const quote = batchQuotes[stock.symbol];
                const histResult = historyResults.find(r => r.symbol === stock.symbol);
                const hist = histResult?.data;

                const currentPrice = quote?.regularMarketPrice || 0;
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
                    if (!oldPrice || oldPrice === 0 || currentPrice === 0) return null;
                    return ((currentPrice - oldPrice) / oldPrice) * 100;
                };

                const dailyChange = calcChange(findPriceAtAge(1 * oneDay));
                const weeklyChange = calcChange(findPriceAtAge(7 * oneDay));
                const monthlyChange = calcChange(findPriceAtAge(30 * oneDay));
                const yearlyChange = calcChange(findPriceAtAge(365 * oneDay));

                // Chart data (last 30 days for clean display)
                const thirtyDaysAgo = now - (30 * oneDay);
                const chartData: { date: string; price: number }[] = [];
                for (let i = 0; i < timestamps.length; i++) {
                    if (timestamps[i] >= thirtyDaysAgo) {
                        chartData.push({
                            date: new Date(timestamps[i] * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                            price: closePrices[i],
                        });
                    }
                }

                return {
                    ...stock,
                    price: currentPrice,
                    dailyChange: dailyChange ?? 0,
                    weeklyChange: weeklyChange ?? 0,
                    monthlyChange: monthlyChange ?? 0,
                    yearlyChange: yearlyChange ?? 0,
                    chartData,
                    loaded: true,
                };
            }));
        } catch (err) {
            console.error('Failed to load watchlist:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWatchlist();
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
            alert(err.response?.data?.message || 'Failed to add');
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
    if (!loading && watchlist.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-[var(--color-clay-card-bg)] rounded-[32px] border border-white/60 shadow-clayCard">
                <div className="w-20 h-20 rounded-[24px] bg-[var(--color-clay-input-bg)] flex items-center justify-center mb-6 shadow-clayPressed text-cyan-500">
                    <Eye className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black font-display text-[var(--color-clay-fg)] mb-2">No Stocks in Watchlist</h3>
                <p className="text-[var(--color-clay-muted)] font-bold text-sm mb-6 text-center max-w-sm">
                    Add stocks to track their daily, weekly, monthly, and yearly performance — without adding them to your portfolio.
                </p>
                <Button
                    onClick={() => setAddDialogOpen(true)}
                    className="bg-[var(--color-clay-input-bg)] hover:bg-white text-[var(--color-clay-fg)] font-bold border-none shadow-clayOrb hover:shadow-clayCard active:scale-[0.92] transition-all"
                >
                    <Plus className="w-4 h-4 mr-2" /> Add to Watchlist
                </Button>
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
                            background: 'var(--color-clay-input-bg)', border: 'none',
                            color: 'var(--color-clay-muted)', cursor: 'pointer',
                            padding: '8px', borderRadius: '16px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s', boxShadow: 'inset -2px -2px 5px rgba(255, 255, 255, 0.7), inset 2px 2px 5px rgba(0, 0, 0, 0.05)'
                        }}
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <h2 className="text-2xl font-black font-display text-[var(--color-clay-fg)] mb-2">
                        Add to Watchlist
                    </h2>
                    <p className="text-sm font-bold text-[var(--color-clay-muted)] mb-4">
                        Search for a stock to track its performance.
                    </p>

                    {/* Search Input */}
                    <div className="relative mb-4">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-clay-muted)]" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by symbol or name..."
                            className="w-full pl-11 pr-4 py-3 bg-[var(--color-clay-input-bg)] shadow-clayPressed rounded-[16px] text-[var(--color-clay-fg)] font-bold text-sm placeholder:text-[var(--color-clay-muted)] focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all font-display border-none"
                            autoFocus
                        />
                    </div>

                    {/* Results */}
                    <div className="max-h-64 overflow-y-auto space-y-2 p-1">
                        {searching && (
                            <div className="text-center py-6 text-[var(--color-clay-muted)] font-bold text-sm">Searching...</div>
                        )}
                        {!searching && searchQuery.length > 1 && searchResults.length === 0 && (
                            <div className="text-center py-6 text-[var(--color-clay-muted)] font-bold text-sm">No stocks found.</div>
                        )}
                        {searchResults.map((stock) => (
                            <button
                                key={stock.symbol}
                                onClick={() => handleAdd(stock.symbol, stock.description)}
                                disabled={addingSymbol === stock.symbol}
                                className="w-full flex items-center justify-between p-3 rounded-[16px] hover:bg-white/80 bg-[var(--color-clay-card-bg)] shadow-clayOrb hover:shadow-clayCard active:scale-[0.98] transition-all group text-left border-white/60 border"
                            >
                                <div>
                                    <span className="text-[var(--color-clay-fg)] font-black font-display text-sm">{stock.displaySymbol}</span>
                                    <span className="text-[var(--color-clay-muted)] font-bold text-xs ml-2">{stock.type}</span>
                                    <p className="text-[var(--color-clay-muted)] font-bold text-xs mt-0.5 truncate max-w-[220px]">{stock.description}</p>
                                </div>
                                <span className="text-cyan-600 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                    {addingSymbol === stock.symbol ? 'Adding...' : '+ Add'}
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
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2 text-[var(--color-clay-muted)] font-bold">
                    <Eye className="w-5 h-5 text-cyan-600" />
                    <span className="text-sm">{watchlist.length} stock{watchlist.length !== 1 ? 's' : ''} tracked</span>
                </div>
                <Button
                    onClick={() => setAddDialogOpen(true)}
                    size="sm"
                    className="bg-[var(--color-clay-input-bg)] hover:bg-white text-[var(--color-clay-fg)] font-bold shadow-clayOrb hover:shadow-clayCard border-none active:scale-[0.92] transition-all rounded-[16px] px-4"
                >
                    <Plus className="w-4 h-4 mr-1" /> Add Stock
                </Button>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading && watchlist.length === 0
                    ? [0, 1, 2, 3].map(i => <SkeletonCard key={i} />)
                    : watchlist.map(stock => (
                        <div
                            key={stock._id}
                            className="relative overflow-hidden rounded-[32px] bg-[var(--color-clay-card-bg)] border border-white/60 backdrop-blur-xl shadow-clayCard p-5 pb-6 hover:-translate-y-2 hover:shadow-clayCardHover transition-all duration-500 group cursor-pointer"
                        >
                            {/* Remove Button */}
                            <button
                                onClick={() => handleRemove(stock._id)}
                                className="absolute top-3 right-3 p-2 rounded-[16px] bg-white/60 shadow-clayOrb hover:shadow-clayCard hover:-translate-y-1 active:scale-[0.92] text-rose-400 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100 z-20"
                                title="Remove from watchlist"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            {/* Header: Symbol + Price */}
                            <div className="flex items-start justify-between mb-4 pr-8">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                            <span className="text-cyan-400 text-xs font-bold">{stock.symbol.slice(0, 2)}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-[var(--color-clay-fg)] font-black text-lg font-display tracking-tight leading-none">{stock.symbol}</h3>
                                            <p className="text-[13px] font-bold text-[var(--color-clay-muted)] truncate max-w-[150px] font-display mt-0.5">{stock.name}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right mt-1">
                                    <p className="text-xl font-black text-[var(--color-clay-fg)] font-display tracking-tight">
                                        {stock.loaded ? `$${stock.price.toFixed(2)}` : '...'}
                                    </p>
                                </div>
                            </div>

                            {/* Performance Badges */}
                            <div className="grid grid-cols-4 gap-2 mb-4">
                                <ChangeBadge label="Day" value={stock.loaded ? stock.dailyChange : null} />
                                <ChangeBadge label="Week" value={stock.loaded ? stock.weeklyChange : null} />
                                <ChangeBadge label="Month" value={stock.loaded ? stock.monthlyChange : null} />
                                <ChangeBadge label="Year" value={stock.loaded ? stock.yearlyChange : null} />
                            </div>

                            {/* Interactive Chart */}
                            <div className="h-32 -mx-1">
                                {stock.chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={stock.chartData}>
                                            <defs>
                                                <linearGradient id={`grad-${stock.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={stock.monthlyChange >= 0 ? '#10B981' : '#EF4444'} stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor={stock.monthlyChange >= 0 ? '#10B981' : '#EF4444'} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="var(--color-clay-muted)"
                                                style={{ fontSize: '10px' }}
                                                tickLine={false}
                                                axisLine={false}
                                                minTickGap={40}
                                            />
                                            <YAxis
                                                stroke="var(--color-clay-muted)"
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
                                                stroke={stock.monthlyChange >= 0 ? '#10B981' : '#EF4444'}
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 4, fill: stock.monthlyChange >= 0 ? '#10B981' : '#EF4444', stroke: '#fff', strokeWidth: 1 }}
                                                fill={`url(#grad-${stock.symbol})`}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center">
                                        <span className="text-white/20 text-xs">Loading chart...</span>
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
}
