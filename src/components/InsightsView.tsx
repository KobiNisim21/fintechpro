import { usePortfolio } from '@/context/PortfolioContext';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Treemap } from 'recharts';
import { stocksAPI, RecommendationTrend, PriceTarget, CompanyProfile } from '@/api/stocks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Activity, PieChart as PieChartIcon, TrendingUp, TrendingDown } from 'lucide-react';

// ─── Premium Color Palette ───────────────────────────────────────
const COLORS = [
    '#22d3ee', '#34d399', '#818cf8', '#f472b6', '#fbbf24',
    '#a78bfa', '#fb923c', '#38bdf8', '#4ade80', '#e879f9',
];

// ─── Skeleton Component ─────────────────────────────────────────
const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse bg-white/10 rounded-xl ${className}`} />
);

const SkeletonCard = () => (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 space-y-4">
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
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex justify-between">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
            </div>
        </div>
    </div>
);

const SkeletonChart = () => (
    <Card className="bg-white/5 backdrop-blur-md border-white/10 rounded-2xl shadow-lg">
        <CardHeader className="pb-2">
            <Skeleton className="h-6 w-44" />
        </CardHeader>
        <CardContent className="h-[340px] flex items-center justify-center">
            <Skeleton className="h-[200px] w-[200px] rounded-full" />
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
    const showName = clampedW > 65 && clampedH > 38;
    const showPercent = clampedW > 65 && clampedH > 55;

    return (
        <g>
            <rect x={clampedX} y={clampedY} width={clampedW} height={clampedH}
                rx={RADIUS} ry={RADIUS}
                style={{ fill: fillColor, fillOpacity: 0.82, stroke: 'none' }}
            />
            {showName && (
                <text x={clampedX + clampedW / 2} y={clampedY + clampedH / 2 - (showPercent ? 7 : 0)}
                    textAnchor="middle" dominantBaseline="central"
                    fill="#fff" fontSize={clampedW > 100 ? 14 : 12} fontWeight="600"
                    fontFamily="Inter, system-ui, -apple-system, sans-serif"
                >{name}</text>
            )}
            {showPercent && root?.value > 0 && (
                <text x={clampedX + clampedW / 2} y={clampedY + clampedH / 2 + 15}
                    textAnchor="middle" dominantBaseline="central"
                    fill="rgba(255,255,255,0.75)" fontSize={11} fontWeight="500"
                    fontFamily="Inter, system-ui, -apple-system, sans-serif"
                >{((value / root.value) * 100).toFixed(1)}%</text>
            )}
        </g>
    );
};

// ─── Custom Tooltip ─────────────────────────────────────────────
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        return (
            <div className="bg-[#111]/95 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
                <p className="text-white/90 font-semibold text-sm mb-1">{data.name}</p>
                <p className="text-white font-mono text-base">
                    ${Number(data.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {data.payload?.percent !== undefined && (
                    <p className="text-cyan-400 text-xs mt-1">
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
            <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
            <text x={tx} y={ty} textAnchor={textAnchor} dominantBaseline="central"
                fill="rgba(255,255,255,0.8)" fontSize={11} fontWeight="500"
                fontFamily="Inter, system-ui, -apple-system, sans-serif"
            >{name} {(percent * 100).toFixed(1)}%</text>
        </g>
    );
};

// ═════════════════════════════════════════════════════════════════
//  INSIGHTS VIEW
// ═════════════════════════════════════════════════════════════════
export function InsightsView({ isActive = true }: { isActive?: boolean }) {
    const { positions } = usePortfolio();
    const isMobile = useIsMobile();
    const [recommendations, setRecommendations] = useState<Record<string, RecommendationTrend[]>>({});
    const [priceTargets, setPriceTargets] = useState<Record<string, PriceTarget>>({});
    const [profiles, setProfiles] = useState<Record<string, CompanyProfile>>({});
    const [loading, setLoading] = useState(false);
    const hasFetchedRef = useRef(false);

    // ── Portfolio Distribution (Pie Chart) ──
    const distributionData = useMemo(() => {
        return positions.map((pos) => ({
            name: pos.symbol,
            value: pos.price * pos.quantity,
        })).sort((a, b) => b.value - a.value);
    }, [positions]);

    // ── Lazy Fetch: Only when tab is active and not yet fetched ──
    useEffect(() => {
        if (!isActive || positions.length === 0 || hasFetchedRef.current) return;

        const fetchInsights = async () => {
            setLoading(true);
            try {
                const symbols = positions.map(p => p.symbol);
                const data = await stocksAPI.getBatchInsights(symbols);
                setRecommendations(data.recommendations || {});
                setPriceTargets(data.priceTargets || {});
                setProfiles(data.profiles || {});
                hasFetchedRef.current = true;
            } catch (error) {
                console.error("Failed to fetch batch insights", error);
            } finally {
                setLoading(false);
            }
        };
        fetchInsights();
    }, [isActive, positions]);

    // Reset fetch flag when positions change
    useEffect(() => {
        hasFetchedRef.current = false;
    }, [positions.length]);

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

            {/* ── Top Row: Allocation + Sectors ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {loading ? (
                    <>
                        <SkeletonChart />
                        <SkeletonChart />
                    </>
                ) : (
                    <>
                        {/* Pie Chart */}
                        <Card className="bg-white/5 backdrop-blur-md border-white/10 rounded-2xl shadow-lg">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-semibold text-white/90 flex items-center gap-2">
                                    <PieChartIcon className="w-5 h-5 text-cyan-400" />
                                    Portfolio Allocation
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[340px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={distributionData} cx="50%" cy="50%"
                                            innerRadius={isMobile ? 40 : 55}
                                            outerRadius={isMobile ? 70 : 95}
                                            paddingAngle={2}
                                            dataKey="value" stroke="none" minAngle={3}
                                            label={renderCustomLabel} labelLine={false}
                                            isAnimationActive={true} animationDuration={800}
                                        >
                                            {distributionData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Treemap – Bento Box */}
                        <Card className="bg-white/5 backdrop-blur-md border-white/10 rounded-2xl shadow-lg">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-semibold text-white/90 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-violet-400" />
                                    Sector Distribution
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[340px]">
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
                    </>
                )}
            </div>

            {/* ── Analyst Recommendations ── */}
            <div>
                <h3 className="text-lg font-semibold text-white/90 mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-400" />
                    Analyst Recommendations & Price Targets
                </h3>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : (
                    <>
                        {analystCards.length === 0 && (
                            <p className="text-zinc-500 text-sm">No analyst-rated holdings in your portfolio.</p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {analystCards.map((item) => (
                                <div key={item.symbol}
                                    className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:bg-white/8 transition-all duration-200"
                                >
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-lg text-white">{item.symbol}</h4>
                                                <Badge className={`${item.consensusColor} text-white text-[10px] font-semibold border-none px-2 py-0.5`}>
                                                    {item.consensus}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-zinc-500 truncate max-w-[180px]">{item.name}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Current</div>
                                            <div className="font-mono text-white font-semibold">${item.price.toFixed(2)}</div>
                                        </div>
                                    </div>

                                    {/* Target + Potential */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-white/5 rounded-xl p-3">
                                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Avg Target</div>
                                            <div className="font-bold text-white text-sm">
                                                {item.target ? `$${item.target.toFixed(2)}` : 'No Data'}
                                            </div>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-3">
                                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Potential</div>
                                            <div className={`font-bold text-sm flex items-center gap-1 ${item.target
                                                ? item.upside >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                                : 'text-zinc-500'
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
                                        <div className="flex justify-between text-[10px] text-zinc-500 uppercase tracking-wider">
                                            <span>Ratings ({item.totalVotes})</span>
                                        </div>
                                        <div className="h-1.5 w-full flex rounded-full overflow-hidden bg-white/5">
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
                                        <div className="flex justify-between text-[10px] text-zinc-500">
                                            <span>Buy {item.buyVotes}</span>
                                            <span>Hold {item.holdVotes}</span>
                                            <span>Sell {item.sellVotes}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
