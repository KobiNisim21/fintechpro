import { usePortfolio } from '@/context/PortfolioContext';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useIsMobile } from '@/components/ui/use-mobile';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts';
import { stocksAPI } from '@/api/stocks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Activity, PieChart as PieChartIcon, TrendingUp, TrendingDown, ShieldCheck, DollarSign, CalendarDays } from 'lucide-react';
import { motion } from 'framer-motion';
import CorrelationMatrix from './Analytics/CorrelationMatrix';
import PortfolioBenchmarkChart from './Analytics/PortfolioBenchmarkChart';

// ─── Premium Color Palette ───────────────────────────────────────
const COLORS = [
    '#22d3ee', '#34d399', '#818cf8', '#f472b6', '#fbbf24',
    '#a78bfa', '#fb923c', '#38bdf8', '#4ade80', '#e879f9',
];

// ─── Sector Tile Gradients (soft pastel, iOS-integrated) ─────────
const SECTOR_GRADIENTS: [string, string, string][] = [
    // [gradient-from, gradient-to, text-color]
    ['#0d9488', '#0f766e', '#ffffff'],   // teal
    ['#6366f1', '#4338ca', '#ffffff'],   // indigo
    ['#f59e0b', '#d97706', '#1e293b'],   // amber
    ['#ec4899', '#be185d', '#ffffff'],   // pink
    ['#3b82f6', '#2563eb', '#ffffff'],   // blue
    ['#8b5cf6', '#6d28d9', '#ffffff'],   // violet
    ['#10b981', '#059669', '#ffffff'],   // emerald
    ['#f97316', '#ea580c', '#ffffff'],   // orange
    ['#06b6d4', '#0891b2', '#ffffff'],   // cyan
    ['#a855f7', '#7c3aed', '#ffffff'],   // purple
];

// ─── Skeleton Component ─────────────────────────────────────────
const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse bg-slate-100 rounded-[16px] ${className}`} />
);

const SkeletonCard = () => (
    <div className="glass-card rounded-[32px] p-5 space-y-4">
        <div className="flex justify-between items-start">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <Skeleton className="h-4 w-28" />
            </div>
            <div className="space-y-1.5">
                <Skeleton className="h-3 w-12 ml-auto" />
                <Skeleton className="h-5 w-16" />
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
        </div>
        <div className="space-y-2">
            <Skeleton className="h-1.5 w-full rounded-[16px]" />
            <div className="flex justify-between">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
            </div>
        </div>
    </div>
);

const SkeletonChart = () => (
    <Card className="glass-card rounded-[32px]">
        <CardHeader className="pb-2">
            <Skeleton className="h-6 w-44" />
        </CardHeader>
        <CardContent className="h-[340px] flex items-center justify-center">
            <Skeleton className="h-[200px] w-[200px] rounded-[100px]" />
        </CardContent>
    </Card>
);

// ─── Sector Distribution Grid Component ─────────────────────────
const SectorGrid = ({ data }: { data: { name: string; value: number }[] }) => {
    const totalValue = data.reduce((sum, d) => sum + d.value, 0);
    if (totalValue === 0 || data.length === 0) return <div className="text-slate-400 text-center py-8">No sector data</div>;

    const items = data.map((d, i) => ({
        ...d,
        percent: (d.value / totalValue) * 100,
        gradient: SECTOR_GRADIENTS[i % SECTOR_GRADIENTS.length],
    }));

    return (
        <div className="grid grid-cols-3 auto-rows-fr gap-3 w-full h-full min-h-[340px]">
            {items.map((item, i) => {
                const isLarge = i < 2;
                const textColor = item.gradient[2];
                return (
                    <div
                        key={item.name}
                        className={`flex flex-col justify-end p-4 overflow-hidden rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer ${
                            isLarge ? 'row-span-2' : ''
                        }`}
                        style={{
                            background: `linear-gradient(135deg, ${item.gradient[0]} 0%, ${item.gradient[1]} 100%)`,
                        }}
                    >
                        <span className="text-sm font-medium leading-tight truncate" style={{ color: textColor, opacity: 0.85 }}>
                            {item.name}
                        </span>
                        <span className="text-xl font-bold mt-0.5" style={{ color: textColor }}>
                            {item.percent.toFixed(1)}%
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Custom Tooltip ─────────────────────────────────────────────
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        return (
            <div className="bg-[var(--color-ios-card)] backdrop-blur-xl border border-white/60 rounded-[16px] px-4 py-3 shadow-[var(--shadow-ios-card)]">
                <p className="text-[var(--color-ios-secondary)] font-bold text-sm mb-1">{data.name}</p>
                <p className="text-[var(--color-ios-fg)] font-bold  text-base">
                    ${Number(data.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {data.payload?.percent !== undefined && (
                    <p className="text-cyan-600 font-bold text-xs mt-1">
                        {(data.payload.percent * 100).toFixed(1)}% of portfolio
                    </p>
                )}
            </div>
        );
    }
    return null;
};

// ─── Custom Pie Label ───────────────────────────────────────────
const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, name, percent }: any) => {
    if (percent < 0.04) return null;
    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const lineStart = outerRadius + 6;
    const lineEnd = outerRadius + 22;
    const textOffset = outerRadius + 28;
    const sx = cx + lineStart * cos, sy = cy + lineStart * sin;
    const ex = cx + lineEnd * cos, ey = cy + lineEnd * sin;
    const tx = cx + textOffset * cos, ty = cy + textOffset * sin;
    const textAnchor = cos >= 0 ? 'start' : 'end';
    return (
        <g>
            <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />
            <text x={tx} y={ty} textAnchor={textAnchor} dominantBaseline="central"
                fill="var(--color-ios-secondary)" fontSize={12} fontWeight="700"
                fontFamily="Nunito, system-ui, -apple-system, sans-serif"
            >{name} {(percent * 100).toFixed(1)}%</text>
        </g>
    );
};

// ═════════════════════════════════════════════════════════════════
//  INSIGHTS VIEW
// ═════════════════════════════════════════════════════════════════
export function InsightsView({ isActive = true }: { isActive?: boolean }) {
    const { positions, positionsReady, portfolioAnalytics, analyticsLoading, fetchAnalytics, insightsData, setInsightsData } = usePortfolio();
    const isMobile = useIsMobile();
    const [loading, setLoading] = useState(false);
    const hasFetchedRef = useRef(false);

    // Provide default empty objects if context data is currently null
    const recommendations = insightsData?.recommendations || {};
    const priceTargets = insightsData?.priceTargets || {};
    const profiles = insightsData?.profiles || {};

    // TRUE only when batch insights (profiles/sectors) have been loaded from the API
    const insightsLoaded = insightsData !== null && Object.keys(insightsData.profiles).length > 0;

    // ── Analytics (Health Score + Benchmark) ──
    const analytics = portfolioAnalytics;

    // ── Portfolio Distribution (Pie Chart) ──
    const distributionData = useMemo(() => {
        return positions.map((pos) => ({
            name: pos.symbol,
            value: pos.price * pos.quantity,
        })).sort((a, b) => b.value - a.value);
    }, [positions]);

    // ── Fetch insights: instant from cache, background refresh from API ──
    useEffect(() => {
        // Already fetched fresh data this session — no need to refetch
        if (hasFetchedRef.current) return;

        // Not ready yet
        if (!isActive || positions.length === 0 || !positionsReady) return;

        // If we have cached data, mark as "loaded" but still do a background refresh
        const hasCachedData = insightsData !== null && Object.keys(insightsData.profiles).length > 0;

        let retryCount = 0;
        let retryTimer: ReturnType<typeof setTimeout>;
        let staggerTimer: ReturnType<typeof setTimeout>;

        const fetchInsights = async () => {
            // Only show loading spinner if there's NO cached data at all
            if (!hasCachedData) {
                setLoading(true);
            }

            try {
                const symbols = positions.map(p => p.symbol);
                const data = await stocksAPI.getBatchInsights(symbols);

                const recsSize = Object.keys(data.recommendations || {}).length;
                const profilesSize = Object.keys(data.profiles || {}).length;

                // If we got NO profiles AND no recommendations, it's likely a Finnhub rate limit
                if (profilesSize === 0 && recsSize === 0 && symbols.length > 0 && retryCount < 3) {
                    console.warn(`[Insights] Got empty data (likely rate limit). Retrying... (${retryCount + 1}/3)`);
                    retryCount++;
                    retryTimer = setTimeout(fetchInsights, 5000);
                } else {
                    // Only update if fresh data has substance — don't overwrite good cache with empty results
                    if (profilesSize > 0) {
                        setInsightsData({
                            recommendations: data.recommendations || {},
                            priceTargets: data.priceTargets || {},
                            profiles: data.profiles || {}
                        });
                    }
                    hasFetchedRef.current = true;
                }
            } catch (error) {
                console.error("Failed to fetch batch insights", error);
                if (retryCount < 3) {
                    retryCount++;
                    retryTimer = setTimeout(fetchInsights, 5000);
                }
                // If we have cached data, just keep showing it — don't break the UI
            } finally {
                setLoading(false);
            }
        };

        // If we have cached data, skip the stagger — start the background refresh immediately
        // If no cache, stagger by 2s to avoid collision with analytics API
        const delay = hasCachedData ? 100 : 2000;
        staggerTimer = setTimeout(fetchInsights, delay);

        return () => {
            clearTimeout(staggerTimer);
            clearTimeout(retryTimer);
        };
    }, [isActive, positions, positionsReady]);

    // Reset fetch flag when positions change
    useEffect(() => {
        hasFetchedRef.current = false;
    }, [positions.length]);

    // Trigger fetch if missing or stale when tab becomes active
    useEffect(() => {
        if (!isActive || positions.length === 0 || !positionsReady) return;
        fetchAnalytics();
    }, [isActive, positions.length, positionsReady, fetchAnalytics]);

    // ── Slice benchmark data by range (no re-fetch) ──
    // MOVED TO PortfolioBenchmarkChart COMPONENT

    // ── Sector Data (Treemap) ──
    const sectorData = useMemo(() => {
        const sectors: Record<string, number> = {};
        positions.forEach(pos => {
            const value = pos.price * pos.quantity;
            const profile = profiles[pos.symbol];
            const sector = profile?.finnhubIndustry || 'Other';
            sectors[sector] = (sectors[sector] || 0) + value;
        });
        return Object.entries(sectors)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [positions, profiles]);

    // ── Analyst Cards (filter out zero-rated ETFs) ──
    const analystCards = useMemo(() => {
        return positions.map(pos => {
            const recs = recommendations[pos.symbol];
            const target = priceTargets[pos.symbol];
            const latestRec = recs?.[0];
            const buyVotes = latestRec ? (latestRec.buy + latestRec.strongBuy) : 0;
            const sellVotes = latestRec ? (latestRec.sell + latestRec.strongSell) : 0;
            const holdVotes = latestRec ? latestRec.hold : 0;
            const totalVotes = buyVotes + sellVotes + holdVotes;
            let consensus = 'Neutral';
            let consensusColor = 'bg-zinc-500/80';
            if (totalVotes > 0) {
                if (buyVotes > sellVotes && buyVotes > holdVotes) {
                    consensus = 'Buy'; consensusColor = 'bg-emerald-500/90';
                } else if (sellVotes > buyVotes && sellVotes > holdVotes) {
                    consensus = 'Sell'; consensusColor = 'bg-rose-500/90';
                } else {
                    consensus = 'Hold'; consensusColor = 'bg-amber-500/90';
                }
            }
            const targetMean = target?.targetMean || 0;
            const upside = targetMean > 0 && pos.price > 0 ? ((targetMean / pos.price) - 1) * 100 : 0;
            return {
                symbol: pos.symbol, name: pos.name, price: pos.price,
                consensus, consensusColor,
                target: targetMean > 0 ? targetMean : null,
                upside, buyVotes, holdVotes, sellVotes, totalVotes,
            };
        }).filter(card => card.totalVotes > 0);
    }, [positions, recommendations, priceTargets]);

    // ═══════════════════════════  RENDER  ═══════════════════════════
    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">

            {/* ══ Analytics Row: Health Score + Benchmark ══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Health Score Gauge ── */}
                <Card className="bg-[var(--color-ios-card)] border-white/60 backdrop-blur-xl rounded-[32px] shadow-[var(--shadow-ios-card)] lg:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-[var(--color-ios-fg)]  flex items-center gap-2 tracking-tight">
                            <ShieldCheck className="w-5 h-5 text-cyan-400" />
                            Portfolio Health
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center py-4">
                        {analyticsLoading || !analytics ? (
                            <div className="w-48 h-48 rounded-[100px] bg-[var(--color-ios-input)] animate-pulse" />
                        ) : (() => {
                            const score = analytics.healthScore;
                            const radius = 80;
                            const stroke = 12;
                            const circumference = Math.PI * radius; // half circle
                            const progress = (score / 100) * circumference;
                            const riskLabel = score > 80 ? 'Low Risk' : score > 50 ? 'Moderate' : 'High Risk';
                            const riskColor = score > 80 ? 'text-[var(--color-ios-success)]' : score > 50 ? 'text-amber-500' : 'text-[var(--color-ios-danger)]';
                            return (
                                <div className="relative">
                                    <svg width={2 * (radius + stroke)} height={radius + stroke + 24} className="overflow-visible">
                                        <defs>
                                            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#22d3ee" />
                                                <stop offset="100%" stopColor="#34d399" />
                                            </linearGradient>
                                        </defs>
                                        {/* Track */}
                                        <path
                                            d={`M ${stroke / 2}, ${radius + stroke / 2} A ${radius},${radius} 0 0,1 ${2 * radius + stroke * 1.5},${radius + stroke / 2}`}
                                            fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={stroke} strokeLinecap="round"
                                        />
                                        {/* Progress */}
                                        <path
                                            d={`M ${stroke / 2}, ${radius + stroke / 2} A ${radius},${radius} 0 0,1 ${2 * radius + stroke * 1.5},${radius + stroke / 2}`}
                                            fill="none" stroke="url(#gaugeGrad)" strokeWidth={stroke} strokeLinecap="round"
                                            strokeDasharray={`${progress} ${circumference}`}
                                            className="transition-all duration-1000"
                                        />
                                        {/* Score number */}
                                        <text x={radius + stroke} y={radius - 4} textAnchor="middle" fill="var(--color-ios-fg)" fontSize="36" fontWeight="900" fontFamily="Nunito, system-ui, sans-serif">
                                            {score}
                                        </text>
                                        <text x={radius + stroke} y={radius + 18} textAnchor="middle" fill="var(--color-ios-secondary)" fontSize="14" fontWeight="bold" fontFamily="Nunito, system-ui, sans-serif">
                                            / 100
                                        </text>
                                    </svg>
                                    {/* Risk label */}
                                    <div className="text-center mt-1">
                                        <span className={`text-sm font-bold  ${riskColor}`}>{riskLabel}</span>
                                    </div>
                                    {/* Component breakdown */}
                                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                                        <div>
                                            <div className="text-xs text-[var(--color-ios-secondary)] font-bold mb-0.5">Diversity</div>
                                            <div className="text-sm font-bold  text-[var(--color-ios-fg)]">{analytics.components.diversification}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-[var(--color-ios-secondary)] font-bold mb-0.5">Volatility</div>
                                            <div className="text-sm font-bold  text-[var(--color-ios-fg)]">{analytics.components.volatility}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-[var(--color-ios-secondary)] font-bold mb-0.5">Sentiment</div>
                                            <div className="text-sm font-bold  text-[var(--color-ios-fg)]">{analytics.components.sentiment}</div>
                                        </div>
                                    </div>
                                    <div className="text-center mt-3">
                                        <span className="text-xs font-bold text-[var(--color-ios-secondary)]">β = {analytics.portfolioBeta}</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>

                {/* ── Benchmark Comparison Chart ── */}
                <PortfolioBenchmarkChart
                    data={analytics?.benchmarkData}
                    isLoading={analyticsLoading || !analytics}
                />
            </div>

            {/* ══ Dividend Calendar + Correlation Matrix Row ══ */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: analytics ? 1 : 0, y: analytics ? 0 : 20 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
                {/* ── Dividend Calendar ── */}
                <Card className="bg-[var(--color-ios-card)] border-white/60 backdrop-blur-xl rounded-[32px] shadow-[var(--shadow-ios-card)]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-[var(--color-ios-fg)]  flex items-center gap-2 tracking-tight">
                            <CalendarDays className="w-5 h-5 text-emerald-400" />
                            Upcoming Dividends
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {analyticsLoading || !analytics ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-10 bg-[var(--color-ios-input)] rounded-[16px] animate-pulse" />
                                ))}
                            </div>
                        ) : analytics.dividends?.length > 0 ? (
                            <div className="overflow-hidden">
                                {/* Header Row */}
                                <div className="grid grid-cols-4 gap-2 text-[10px] text-[var(--color-ios-secondary)] font-bold uppercase tracking-wider pb-2 border-b border-[var(--color-ios-input)]">
                                    <span>Symbol</span>
                                    <span>Ex-Date</span>
                                    <span className="text-right">Amount</span>
                                    <span className="text-right">Est. Payout</span>
                                </div>
                                {/* Data rows */}
                                {analytics.dividends.map((div, i) => (
                                    <div key={i} className="grid grid-cols-4 gap-2 items-center py-2.5 border-b border-[var(--color-ios-input)] last:border-0">
                                        <span className="text-sm font-bold text-[var(--color-ios-fg)] ">{div.symbol}</span>
                                        <span className="text-xs text-[var(--color-ios-secondary)] font-bold">
                                            {new Date(div.exDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className="text-sm text-[var(--color-ios-secondary)] text-right font-bold font-mono">${div.amount.toFixed(2)}</span>
                                        <span className="text-sm text-cyan-600 text-right font-bold font-mono">${div.estimatedPayout.toFixed(2)}</span>
                                    </div>
                                ))}
                                {/* Total row */}
                                <div className="grid grid-cols-4 gap-2 items-center pt-3 mt-1 border-t border-[var(--color-ios-input)]">
                                    <span className="text-xs text-[var(--color-ios-secondary)] font-bold col-span-3">Total Estimated Payout</span>
                                    <span className="text-sm text-cyan-600 text-right font-bold font-mono">
                                        ${analytics.dividends.reduce((s, d) => s + d.estimatedPayout, 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                                <DollarSign className="w-8 h-8 mb-2 opacity-30" />
                                <p className="text-sm">No upcoming dividends</p>
                            </div>
                        )}
                        {analytics?.pendingPayouts && analytics.pendingPayouts.length > 0 && (
                            <div className="mt-6 border-t border-[var(--color-ios-input)] pt-4">
                                <h4 className="text-xs text-[var(--color-ios-secondary)] font-bold uppercase tracking-wider mb-3">Pending Payouts (Passed Ex-Date)</h4>
                                <div className="grid grid-cols-4 gap-2 text-[10px] text-[var(--color-ios-secondary)] font-bold uppercase tracking-wider pb-2 border-b border-[var(--color-ios-input)]">
                                    <span>Symbol</span>
                                    <span>Ex-Date</span>
                                    <span className="text-right">Pay Date</span>
                                    <span className="text-right">Payout</span>
                                </div>
                                <div className="overflow-hidden opacity-90">
                                    {analytics.pendingPayouts.map((div, i) => (
                                        <div key={`pending-${i}`} className="grid grid-cols-4 gap-2 items-center py-2 border-b border-[var(--color-ios-input)] last:border-0 relative">
                                            {/* Subtle processing indicator */}
                                            <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[var(--color-ios-success)] animate-pulse" />
                                            <span className="text-sm font-bold text-[var(--color-ios-fg)] pl-2 ">{div.symbol}</span>
                                            <span className="text-xs text-[var(--color-ios-secondary)] font-bold">
                                                {new Date(div.exDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                            <span className="text-[10px] text-[var(--color-ios-secondary)] font-bold text-right leading-tight flex flex-col items-end">
                                                {div.paymentDate ? new Date(div.paymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
                                            </span>
                                            <span className="text-sm text-[var(--color-ios-success)] text-right font-bold font-mono">
                                                ${div.estimatedPayout.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {analytics?.lastUpdated && (
                            <div className="mt-3 text-[10px] text-[var(--color-ios-secondary)] font-bold text-right flex items-center justify-end gap-1">
                                <Activity className="w-3 h-3" />
                                Updated: {new Date(analytics.lastUpdated).toLocaleTimeString()}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Sector Distribution (Grid) ── */}
                {!insightsLoaded ? (
                    <Card className="glass-card rounded-[32px] h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                                <Activity className="w-5 h-5 text-violet-400" />
                                Sector Distribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-[340px]">
                            <div className="w-full h-full bg-slate-100 rounded-2xl animate-pulse" />
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="glass-card rounded-[32px] h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                                <Activity className="w-5 h-5 text-violet-400" />
                                Sector Distribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <SectorGrid data={sectorData} />
                        </CardContent>
                    </Card>
                )}
            </motion.div>

            {/* ══ Portfolio Allocation + Correlation Matrix Row ══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Portfolio Allocation (Left - Small, col-span-1) ── */}
                <Card className="bg-[var(--color-ios-card)] border-white/60 backdrop-blur-xl rounded-[32px] shadow-[var(--shadow-ios-card)] lg:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-[var(--color-ios-fg)]  flex items-center gap-2 tracking-tight">
                            <PieChartIcon className="w-5 h-5 text-cyan-400" />
                            Portfolio Allocation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[280px] flex justify-center items-center">
                        {loading ? (
                            <div className="w-full h-full bg-[var(--color-ios-input)] animate-pulse rounded-[16px]" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={distributionData} cx="50%" cy="50%"
                                        innerRadius={isMobile ? 40 : 55}
                                        outerRadius={isMobile ? 70 : 95}
                                        paddingAngle={2}
                                        dataKey="value" stroke="none" minAngle={3}
                                        label={renderCustomLabel} labelLine={false}
                                        isAnimationActive={false}
                                    >
                                        {distributionData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* ── Correlation Matrix (Right - Wide, col-span-2 is baked into the component) ── */}
                <CorrelationMatrix
                    data={analytics?.correlationMatrix ?? null}
                    isLoading={analyticsLoading || !analytics}
                />
            </div>

            {/* ── Analyst Recommendations ── */}
            <div>
                <h3 className="text-lg font-bold text-[var(--color-ios-fg)]  mb-4 flex items-center gap-2 tracking-tight">
                    <Target className="w-5 h-5 text-emerald-400" />
                    Analyst Recommendations & Price Targets
                </h3>

                {!insightsLoaded ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : analystCards.length === 0 ? (
                    <p className="text-zinc-500 text-sm">No analyst-rated holdings in your portfolio.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {analystCards.map((item) => (
                            <div key={item.symbol}
                                className="bg-[var(--color-ios-card)] border border-white/60 backdrop-blur-xl rounded-[32px] shadow-[var(--shadow-ios-card)] p-5 pb-6 hover:-translate-y-2 hover:shadow-[var(--shadow-ios-card)]Hover transition-all duration-500 cursor-pointer"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-[var(--color-ios-fg)] text-lg  tracking-tight">{item.symbol}</h4>
                                            <Badge className={`${item.consensusColor} text-white text-[10px] font-semibold border-none px-2 py-0.5`}>
                                                {item.consensus}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-[var(--color-ios-secondary)] font-bold truncate max-w-[180px]">{item.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-[var(--color-ios-secondary)] font-bold uppercase tracking-wider">Current</div>
                                        <div className="font-mono text-[var(--color-ios-fg)] font-bold">${item.price.toFixed(2)}</div>
                                    </div>
                                </div>

                                {/* Target + Potential */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-[var(--color-ios-input)] shadow-none rounded-[16px] p-3">
                                        <div className="text-[10px] text-[var(--color-ios-secondary)] font-bold uppercase tracking-wider mb-1">Avg Target</div>
                                        <div className="font-bold text-[var(--color-ios-fg)]  text-sm">
                                            {item.target ? `$${item.target.toFixed(2)}` : 'No Data'}
                                        </div>
                                    </div>
                                    <div className="bg-[var(--color-ios-input)] shadow-none rounded-[16px] p-3">
                                        <div className="text-[10px] text-[var(--color-ios-secondary)] font-bold uppercase tracking-wider mb-1">Potential</div>
                                        <div className={`font-bold  text-sm flex items-center gap-1 ${item.target
                                            ? item.upside >= 0 ? 'text-[var(--color-ios-success)]' : 'text-[var(--color-ios-danger)]'
                                            : 'text-[var(--color-ios-secondary)]'
                                            }`}>
                                            {item.target ? (
                                                <>
                                                    {item.upside >= 0
                                                        ? <TrendingUp className="w-3.5 h-3.5" />
                                                        : <TrendingDown className="w-3.5 h-3.5" />
                                                    }
                                                    {item.upside > 0 ? '+' : ''}{item.upside.toFixed(1)}%
                                                </>
                                            ) : 'No Data'}
                                        </div>
                                    </div>
                                </div>

                                {/* Rating Bar */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] text-[var(--color-ios-secondary)] font-bold uppercase tracking-wider">
                                        <span>Ratings ({item.totalVotes})</span>
                                    </div>
                                    <div className="h-1.5 w-full flex rounded-full overflow-hidden bg-[var(--color-ios-input)] shadow-none">
                                        {item.buyVotes > 0 && (
                                            <div style={{ width: `${(item.buyVotes / item.totalVotes) * 100}%` }}
                                                className="bg-emerald-500 h-full transition-all duration-500" />
                                        )}
                                        {item.holdVotes > 0 && (
                                            <div style={{ width: `${(item.holdVotes / item.totalVotes) * 100}%` }}
                                                className="bg-amber-500 h-full transition-all duration-500" />
                                        )}
                                        {item.sellVotes > 0 && (
                                            <div style={{ width: `${(item.sellVotes / item.totalVotes) * 100}%` }}
                                                className="bg-rose-500 h-full transition-all duration-500" />
                                        )}
                                    </div>
                                    <div className="flex justify-between text-[10px] text-[var(--color-ios-secondary)] font-bold">
                                        <span>Buy {item.buyVotes}</span>
                                        <span>Hold {item.holdVotes}</span>
                                        <span>Sell {item.sellVotes}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
