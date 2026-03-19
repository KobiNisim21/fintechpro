import { usePortfolio } from '@/context/PortfolioContext';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Treemap,
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

// ─── Skeleton Component ─────────────────────────────────────────
const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse bg-[var(--color-clay-input-bg)] rounded-[16px] ${className}`} />
);

const SkeletonCard = () => (
    <div className="bg-[var(--color-clay-card-bg)] backdrop-blur-xl border border-white/60 shadow-clayCard rounded-[32px] p-5 space-y-4">
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
    <Card className="bg-[var(--color-clay-card-bg)] backdrop-blur-xl border-white/60 rounded-[32px] shadow-clayCard">
        <CardHeader className="pb-2">
            <Skeleton className="h-6 w-44" />
        </CardHeader>
        <CardContent className="h-[340px] flex items-center justify-center">
            <Skeleton className="h-[200px] w-[200px] rounded-[100px]" />
        </CardContent>
    </Card>
);

// ─── Custom Treemap Cell (Bento-box iOS style) ──────────────────
const BentoTreemapContent = (props: any) => {
    const { root, x, y, width, height, index, name, value, colors } = props;
    const GAP = 3;
    const RADIUS = 10;
    const clampedX = x + GAP / 2;
    const clampedY = y + GAP / 2;
    const clampedW = Math.max(width - GAP, 0);
    const clampedH = Math.max(height - GAP, 0);
    const fillColor = colors[index % colors.length];


    return (
        <g>
            <rect x={clampedX} y={clampedY} width={clampedW} height={clampedH}
                rx={RADIUS} ry={RADIUS}
                style={{ fill: fillColor, fillOpacity: 0.82, stroke: 'none' }}
            />
            {clampedW > 30 && clampedH > 30 && (
                <foreignObject x={clampedX} y={clampedY} width={clampedW} height={clampedH}>
                    <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center overflow-hidden">
                        <span className="text-[var(--color-clay-fg)] font-black leading-tight break-words w-full font-display"
                            style={{ fontSize: clampedW < 60 ? '9px' : '12px' }}>
                            {name}
                        </span>
                        {clampedH > 50 && root?.value > 0 && (
                            <span className="text-[var(--color-clay-fg)] font-extrabold mt-0.5 opacity-80"
                                style={{ fontSize: clampedW < 60 ? '8px' : '10px' }}>
                                {((value / root.value) * 100).toFixed(1)}%
                            </span>
                        )}
                    </div>
                </foreignObject>
            )}
        </g>
    );
};

// ─── Custom Tooltip ─────────────────────────────────────────────
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        return (
            <div className="bg-[var(--color-clay-card-bg)] backdrop-blur-xl border border-white/60 rounded-[16px] px-4 py-3 shadow-clayCard">
                <p className="text-[var(--color-clay-muted)] font-bold text-sm mb-1">{data.name}</p>
                <p className="text-[var(--color-clay-fg)] font-black font-display text-base">
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
                fill="var(--color-clay-muted)" fontSize={12} fontWeight="700"
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
                <Card className="bg-[var(--color-clay-card-bg)] border-white/60 backdrop-blur-xl rounded-[32px] shadow-clayCard lg:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-black text-[var(--color-clay-fg)] font-display flex items-center gap-2 tracking-tight">
                            <ShieldCheck className="w-5 h-5 text-cyan-400" />
                            Portfolio Health
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center py-4">
                        {analyticsLoading || !analytics ? (
                            <div className="w-48 h-48 rounded-[100px] bg-[var(--color-clay-input-bg)] animate-pulse" />
                        ) : (() => {
                            const score = analytics.healthScore;
                            const radius = 80;
                            const stroke = 12;
                            const circumference = Math.PI * radius; // half circle
                            const progress = (score / 100) * circumference;
                            const riskLabel = score > 80 ? 'Low Risk' : score > 50 ? 'Moderate' : 'High Risk';
                            const riskColor = score > 80 ? 'text-[var(--color-clay-success)]' : score > 50 ? 'text-amber-500' : 'text-[var(--color-clay-danger)]';
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
                                        <text x={radius + stroke} y={radius - 4} textAnchor="middle" fill="var(--color-clay-fg)" fontSize="36" fontWeight="900" fontFamily="Nunito, system-ui, sans-serif">
                                            {score}
                                        </text>
                                        <text x={radius + stroke} y={radius + 18} textAnchor="middle" fill="var(--color-clay-muted)" fontSize="14" fontWeight="bold" fontFamily="Nunito, system-ui, sans-serif">
                                            / 100
                                        </text>
                                    </svg>
                                    {/* Risk label */}
                                    <div className="text-center mt-1">
                                        <span className={`text-sm font-black font-display ${riskColor}`}>{riskLabel}</span>
                                    </div>
                                    {/* Component breakdown */}
                                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                                        <div>
                                            <div className="text-xs text-[var(--color-clay-muted)] font-bold mb-0.5">Diversity</div>
                                            <div className="text-sm font-black font-display text-[var(--color-clay-fg)]">{analytics.components.diversification}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-[var(--color-clay-muted)] font-bold mb-0.5">Volatility</div>
                                            <div className="text-sm font-black font-display text-[var(--color-clay-fg)]">{analytics.components.volatility}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-[var(--color-clay-muted)] font-bold mb-0.5">Sentiment</div>
                                            <div className="text-sm font-black font-display text-[var(--color-clay-fg)]">{analytics.components.sentiment}</div>
                                        </div>
                                    </div>
                                    <div className="text-center mt-3">
                                        <span className="text-xs font-bold text-[var(--color-clay-muted)]">β = {analytics.portfolioBeta}</span>
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
                <Card className="bg-[var(--color-clay-card-bg)] border-white/60 backdrop-blur-xl rounded-[32px] shadow-clayCard">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-black text-[var(--color-clay-fg)] font-display flex items-center gap-2 tracking-tight">
                            <CalendarDays className="w-5 h-5 text-emerald-400" />
                            Upcoming Dividends
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {analyticsLoading || !analytics ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-10 bg-[var(--color-clay-input-bg)] rounded-[16px] animate-pulse" />
                                ))}
                            </div>
                        ) : analytics.dividends?.length > 0 ? (
                            <div className="overflow-hidden">
                                {/* Header Row */}
                                <div className="grid grid-cols-4 gap-2 text-[10px] text-[var(--color-clay-muted)] font-black uppercase tracking-wider pb-2 border-b border-[var(--color-clay-input-bg)]">
                                    <span>Symbol</span>
                                    <span>Ex-Date</span>
                                    <span className="text-right">Amount</span>
                                    <span className="text-right">Est. Payout</span>
                                </div>
                                {/* Data rows */}
                                {analytics.dividends.map((div, i) => (
                                    <div key={i} className="grid grid-cols-4 gap-2 items-center py-2.5 border-b border-[var(--color-clay-input-bg)] last:border-0">
                                        <span className="text-sm font-black text-[var(--color-clay-fg)] font-display">{div.symbol}</span>
                                        <span className="text-xs text-[var(--color-clay-muted)] font-bold">
                                            {new Date(div.exDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className="text-sm text-[var(--color-clay-muted)] text-right font-bold font-mono">${div.amount.toFixed(2)}</span>
                                        <span className="text-sm text-cyan-600 text-right font-black font-mono">${div.estimatedPayout.toFixed(2)}</span>
                                    </div>
                                ))}
                                {/* Total row */}
                                <div className="grid grid-cols-4 gap-2 items-center pt-3 mt-1 border-t border-[var(--color-clay-input-bg)]">
                                    <span className="text-xs text-[var(--color-clay-muted)] font-bold col-span-3">Total Estimated Payout</span>
                                    <span className="text-sm text-cyan-600 text-right font-black font-mono">
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
                            <div className="mt-6 border-t border-[var(--color-clay-input-bg)] pt-4">
                                <h4 className="text-xs text-[var(--color-clay-muted)] font-black uppercase tracking-wider mb-3">Pending Payouts (Passed Ex-Date)</h4>
                                <div className="grid grid-cols-4 gap-2 text-[10px] text-[var(--color-clay-muted)] font-black uppercase tracking-wider pb-2 border-b border-[var(--color-clay-input-bg)]">
                                    <span>Symbol</span>
                                    <span>Ex-Date</span>
                                    <span className="text-right">Pay Date</span>
                                    <span className="text-right">Payout</span>
                                </div>
                                <div className="overflow-hidden opacity-90">
                                    {analytics.pendingPayouts.map((div, i) => (
                                        <div key={`pending-${i}`} className="grid grid-cols-4 gap-2 items-center py-2 border-b border-[var(--color-clay-input-bg)] last:border-0 relative">
                                            {/* Subtle processing indicator */}
                                            <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[var(--color-clay-success)] animate-pulse" />
                                            <span className="text-sm font-black text-[var(--color-clay-fg)] pl-2 font-display">{div.symbol}</span>
                                            <span className="text-xs text-[var(--color-clay-muted)] font-bold">
                                                {new Date(div.exDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                            <span className="text-[10px] text-[var(--color-clay-muted)] font-bold text-right leading-tight flex flex-col items-end">
                                                {div.paymentDate ? new Date(div.paymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
                                            </span>
                                            <span className="text-sm text-[var(--color-clay-success)] text-right font-black font-mono">
                                                ${div.estimatedPayout.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {analytics?.lastUpdated && (
                            <div className="mt-3 text-[10px] text-[var(--color-clay-muted)] font-bold text-right flex items-center justify-end gap-1">
                                <Activity className="w-3 h-3" />
                                Updated: {new Date(analytics.lastUpdated).toLocaleTimeString()}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Sector Distribution (Treemap) ── */}
                {!insightsLoaded ? (
                    <Card className="bg-[var(--color-clay-card-bg)] border-white/60 backdrop-blur-xl rounded-[32px] shadow-clayCard h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-black text-[var(--color-clay-fg)] font-display flex items-center gap-2 tracking-tight">
                                <Activity className="w-5 h-5 text-violet-400" />
                                Sector Distribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-[340px]">
                            <div className="w-full h-full bg-[var(--color-clay-input-bg)] rounded-[16px] animate-pulse" />
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="bg-[var(--color-clay-card-bg)] border-white/60 backdrop-blur-xl rounded-[32px] shadow-clayCard h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-black text-[var(--color-clay-fg)] font-display flex items-center gap-2 tracking-tight">
                                <Activity className="w-5 h-5 text-violet-400" />
                                Sector Distribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-[340px]">
                            {sectorData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <Treemap
                                        data={sectorData}
                                        dataKey="value"
                                        aspectRatio={isMobile ? 1 / 2 : 4 / 3}
                                        stroke="none"
                                        content={<BentoTreemapContent colors={COLORS} />}
                                    >
                                        <RechartsTooltip content={<CustomTooltip />} />
                                    </Treemap>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-zinc-500">
                                    No sector data available
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </motion.div>

            {/* ══ Portfolio Allocation + Correlation Matrix Row ══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Portfolio Allocation (Left - Small, col-span-1) ── */}
                <Card className="bg-[var(--color-clay-card-bg)] border-white/60 backdrop-blur-xl rounded-[32px] shadow-clayCard lg:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-black text-[var(--color-clay-fg)] font-display flex items-center gap-2 tracking-tight">
                            <PieChartIcon className="w-5 h-5 text-cyan-400" />
                            Portfolio Allocation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[280px] flex justify-center items-center">
                        {loading ? (
                            <div className="w-full h-full bg-[var(--color-clay-input-bg)] animate-pulse rounded-[16px]" />
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
                <h3 className="text-lg font-black text-[var(--color-clay-fg)] font-display mb-4 flex items-center gap-2 tracking-tight">
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
                                className="bg-[var(--color-clay-card-bg)] border border-white/60 backdrop-blur-xl rounded-[32px] shadow-clayCard p-5 pb-6 hover:-translate-y-2 hover:shadow-clayCardHover transition-all duration-500 cursor-pointer"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-black text-[var(--color-clay-fg)] text-lg font-display tracking-tight">{item.symbol}</h4>
                                            <Badge className={`${item.consensusColor} text-white text-[10px] font-semibold border-none px-2 py-0.5`}>
                                                {item.consensus}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-[var(--color-clay-muted)] font-bold truncate max-w-[180px]">{item.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-[var(--color-clay-muted)] font-bold uppercase tracking-wider">Current</div>
                                        <div className="font-mono text-[var(--color-clay-fg)] font-black">${item.price.toFixed(2)}</div>
                                    </div>
                                </div>

                                {/* Target + Potential */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-[var(--color-clay-input-bg)] shadow-clayPressed rounded-[16px] p-3">
                                        <div className="text-[10px] text-[var(--color-clay-muted)] font-bold uppercase tracking-wider mb-1">Avg Target</div>
                                        <div className="font-black text-[var(--color-clay-fg)] font-display text-sm">
                                            {item.target ? `$${item.target.toFixed(2)}` : 'No Data'}
                                        </div>
                                    </div>
                                    <div className="bg-[var(--color-clay-input-bg)] shadow-clayPressed rounded-[16px] p-3">
                                        <div className="text-[10px] text-[var(--color-clay-muted)] font-bold uppercase tracking-wider mb-1">Potential</div>
                                        <div className={`font-black font-display text-sm flex items-center gap-1 ${item.target
                                            ? item.upside >= 0 ? 'text-[var(--color-clay-success)]' : 'text-[var(--color-clay-danger)]'
                                            : 'text-[var(--color-clay-muted)]'
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
                                    <div className="flex justify-between text-[10px] text-[var(--color-clay-muted)] font-bold uppercase tracking-wider">
                                        <span>Ratings ({item.totalVotes})</span>
                                    </div>
                                    <div className="h-1.5 w-full flex rounded-full overflow-hidden bg-[var(--color-clay-input-bg)] shadow-clayPressed">
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
                                    <div className="flex justify-between text-[10px] text-[var(--color-clay-muted)] font-bold">
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
