import { t, useLanguage, locale } from '@/i18n';
import PortfolioRiskPanel from './PortfolioRiskPanel';
import AllocationBubbles from './AllocationBubbles';
import { sectorColors } from '@/lib/chartPalette';
import DividendCalendar from './DividendCalendar';
import { usePortfolio } from '@/context/PortfolioContext';
import { useMemo, useState, useEffect, useRef, type CSSProperties } from 'react';
import { useIsMobile } from '@/components/ui/use-mobile';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts';
import { stocksAPI } from '@/api/stocks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Activity, PieChart as PieChartIcon, TrendingUp, TrendingDown } from 'lucide-react';
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
    <div className={`motion-safe:animate-pulse bg-canvas rounded-lg ${className}`} />
);

const SkeletonCard = () => (
    <div className="bg-surface rounded-xl shadow-card p-card-sm md:p-card border border-line/50 space-y-4">
        <div className="flex justify-between items-start">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <Skeleton className="h-4 w-28" />
            </div>
            <div className="space-y-1.5">
                <Skeleton className="h-3 w-12 ms-auto" />
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

// ─── Sector Distribution Grid Component ─────────────────────────
const SectorGrid = ({ data }: { data: { name: string; value: number }[] }) => {
    useLanguage();
    const totalValue = data.reduce((sum, d) => sum + d.value, 0);
    if (totalValue === 0 || data.length === 0) return <div className="text-caption text-secondary text-center py-8">{t("No sector data")}</div>;

    const items = data.map((d, i) => ({
        ...d,
        percent: (d.value / totalValue) * 100,
        colors: sectorColors(d.name, i),
    }));

    return (
        <div className="sector-distribution-grid grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
            {items.map((item, i) => {
                const isLarge = i < 2;
                const textColor = item.colors[1];
                return (
                    <div
                        key={item.name}
                        className={`sector-tile flex flex-col justify-end min-w-0 p-4 overflow-hidden rounded-lg transition-shadow duration-base ${
                            isLarge ? 'sector-tile-major' : ''
                        }`}
                        style={{
                            backgroundColor: item.colors[0],
                            '--sector-tint': item.colors[0],
                        } as CSSProperties}
                    >
                        <span className="text-caption font-medium leading-tight break-words" style={{ color: textColor }}>
                            {t(item.name)}
                        </span>
                        <span dir="ltr" className="sector-tile-value text-heading font-bold tabular-nums mt-1" style={{ color: textColor }}>
                            {item.percent.toFixed(1)}%
                        </span>
                        <span className="sector-share-track" aria-hidden="true"><span style={{ width: `${item.percent}%`, backgroundColor: textColor }} /></span>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Custom Tooltip ─────────────────────────────────────────────
const CustomTooltip = ({ active, payload }: any) => {
    useLanguage();
    if (active && payload && payload.length) {
        const data = payload[0];
        return (
            <div className="bg-surface rounded-lg shadow-card p-3 border border-line text-caption">
                <p className="text-secondary text-micro mb-1">{data.name}</p>
                <p dir="ltr" className="text-body text-ink font-semibold tabular-nums">
                    ${Number(data.value).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {data.payload?.percent !== undefined && (
                    <p className="text-accent text-caption font-medium tabular-nums mt-1">
                        {(data.payload.percent * 100).toFixed(1)}{t("% of portfolio")}</p>
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
    useLanguage();
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
        if (analytics?.exposures?.sectors?.length) return analytics.exposures.sectors.map(row => ({ name: row.name, value: row.value }));
        const sectors: Record<string, number> = {};
        positions.forEach(pos => {
            const value = pos.price * pos.quantity;
            const profile = profiles[pos.symbol];
            const sector = profile?.sector || 'Unknown';
            sectors[sector] = (sectors[sector] || 0) + value;
        });
        return Object.entries(sectors)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [positions, profiles, analytics]);

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
        <div className="insights-view space-y-5 pb-20 motion-safe:animate-in motion-safe:fade-in duration-base">

            {/* ══ Analytics Row: Health Score + Benchmark ══ */}
            <div className="insights-summary-grid grid grid-cols-1 lg:grid-cols-3 gap-gap">
                {/* ── Health Score Gauge ── */}
                <PortfolioRiskPanel />

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
                className="insights-income-grid grid grid-cols-1 lg:grid-cols-2 gap-gap"
            >
                {/* ── Dividend Calendar ── */}
                <DividendCalendar analytics={analytics} loading={analyticsLoading} />

                {/* ── Sector Distribution (Grid) ── */}
                {!insightsLoaded && !analytics?.exposures ? (
                    <Card className="bg-surface rounded-xl shadow-card p-card-sm md:p-card border border-line/50 gap-4 h-full flex flex-col">
                        <CardHeader className="p-0">
                            <CardTitle className="text-subhead text-ink font-semibold flex items-center gap-2">
                                <Activity className="w-5 h-5 text-accent" />
                                {t("Sector Distribution")}</CardTitle>
                        </CardHeader>
                        <CardContent className="px-0 [&:last-child]:pb-0 flex-1 min-h-[300px]">
                            <div className="w-full h-full bg-canvas rounded-lg motion-safe:animate-pulse" />
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="bg-surface rounded-xl shadow-card p-card-sm md:p-card border border-line/50 gap-4 h-full flex flex-col">
                        <CardHeader className="p-0">
                            <CardTitle className="text-subhead text-ink font-semibold flex items-center gap-2">
                                <Activity className="w-5 h-5 text-accent" />
                                {t("Sector Distribution")}</CardTitle>
                        </CardHeader>
                        <CardContent className="px-0 [&:last-child]:pb-0 flex-1">
                            <SectorGrid data={sectorData} />
                        </CardContent>
                    </Card>
                )}
            </motion.div>

            {/* ══ Portfolio Allocation + Correlation Matrix Row ══ */}
            <div className="insights-allocation-grid grid grid-cols-1 lg:grid-cols-3 gap-gap">
                {/* ── Portfolio Allocation (Left - Small, col-span-1) ── */}
                <Card className="bg-surface rounded-xl shadow-card p-card-sm md:p-card border border-line/50 gap-4 min-w-0 lg:col-span-1">
                    <CardHeader className="p-0">
                        <CardTitle className="text-subhead text-ink font-semibold flex items-center gap-2">
                            <PieChartIcon className="w-5 h-5 text-accent" />
                            {t("Portfolio Allocation")}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-0 [&:last-child]:pb-0">
                        {loading ? (
                            <div className="w-full h-[300px] bg-canvas motion-safe:animate-pulse rounded-lg" />
                        ) : (
                            <div className="space-y-4">
                                <AllocationBubbles data={distributionData} />
                                <details className="allocation-donut-details border-t border-line pt-3">
                                    <summary className="text-caption text-secondary cursor-pointer min-h-11 py-3">{t("Donut chart")}</summary>
                                    <div className="allocation-chart h-[300px] md:h-[380px]">
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
                                    </div>
                                </details>
                            </div>
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
                <h3 className="text-subhead text-ink font-semibold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-positive" />
                    {t("Analyst Recommendations & Price Targets")}</h3>

                {!insightsLoaded ? (
                    <div className="insights-analyst-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gap">
                        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : analystCards.length === 0 ? (
                    <p className="text-secondary text-body">{t("No analyst-rated holdings in your portfolio.")}</p>
                ) : (
                    <div className="insights-analyst-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gap">
                        {analystCards.map((item) => (
                            <div key={item.symbol}
                                className="bg-surface rounded-xl shadow-card p-card-sm md:p-card border border-line/50 hover:shadow-card-hover transition-shadow duration-base min-w-0"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-subhead text-ink font-semibold tracking-tight">{item.symbol}</h4>
                                            <Badge data-rating={item.consensus} className={`analyst-consensus ${item.consensusColor} rounded-pill text-micro font-semibold border-none px-2.5 py-1`}>
                                                {t(item.consensus)}
                                            </Badge>
                                        </div>
                                        <p className="text-caption text-secondary truncate max-w-[180px]">{item.name}</p>
                                    </div>
                                    <div className="text-end">
                                        <div className="text-micro text-secondary font-medium uppercase tracking-wider">{t("Current")}</div>
                                        <div dir="ltr" className="text-body text-ink font-semibold tabular-nums">${item.price.toFixed(2)}</div>
                                    </div>
                                </div>

                                {/* Target + Potential */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-surface-alt border border-line/50 rounded-lg p-3">
                                        <div className="text-micro text-secondary font-medium uppercase tracking-wider mb-1">{t("Avg Target")}</div>
                                        <div className="text-body text-ink font-semibold tabular-nums">
                                            {item.target ? `$${item.target.toFixed(2)}` : t("No Data")}
                                        </div>
                                    </div>
                                    <div className="bg-surface-alt border border-line/50 rounded-lg p-3">
                                        <div className="text-micro text-secondary font-medium uppercase tracking-wider mb-1">{t("Potential")}</div>
                                        <div className={`text-body font-semibold tabular-nums flex items-center gap-1 ${item.target
                                            ? item.upside >= 0 ? 'text-positive' : 'text-negative'
                                            : 'text-secondary'
                                            }`}>
                                            {item.target ? (
                                                <>
                                                    {item.upside >= 0
                                                        ? <TrendingUp className="w-3.5 h-3.5" />
                                                        : <TrendingDown className="w-3.5 h-3.5" />
                                                    }
                                                    {item.upside > 0 ? '+' : ''}{item.upside.toFixed(1)}%
                                                </>
                                            ) : t("No Data")}
                                        </div>
                                    </div>
                                </div>

                                {/* Rating Bar */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-micro text-secondary font-medium uppercase tracking-wider">
                                        <span>{t("Ratings (")}{item.totalVotes})</span>
                                    </div>
                                    <div className="h-1.5 w-full flex rounded-pill overflow-hidden bg-canvas">
                                        {item.buyVotes > 0 && (
                                            <div style={{ width: `${(item.buyVotes / item.totalVotes) * 100}%` }}
                                                className="bg-positive h-full transition-all duration-base" />
                                        )}
                                        {item.holdVotes > 0 && (
                                            <div style={{ width: `${(item.holdVotes / item.totalVotes) * 100}%` }}
                                                className="bg-warning h-full transition-all duration-base" />
                                        )}
                                        {item.sellVotes > 0 && (
                                            <div style={{ width: `${(item.sellVotes / item.totalVotes) * 100}%` }}
                                                className="bg-negative h-full transition-all duration-base" />
                                        )}
                                    </div>
                                    <div className="flex justify-between text-micro text-secondary font-medium tabular-nums">
                                        <span>{t("Buy ")}{item.buyVotes}</span>
                                        <span>{t("Hold ")}{item.holdVotes}</span>
                                        <span>{t("Sell ")}{item.sellVotes}</span>
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
