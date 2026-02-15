import { usePortfolio } from '@/context/PortfolioContext';
import { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Treemap, Legend } from 'recharts';
import { stocksAPI, RecommendationTrend, PriceTarget, CompanyProfile } from '@/api/stocks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Activity, PieChart as PieChartIcon } from 'lucide-react';

// Custom tooltip for Treemap
const CustomTreemapContent = (props: any) => {
    const { root, depth, x, y, width, height, index, name, value, colors } = props;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: colors[index % colors.length],
                    stroke: '#fff',
                    strokeWidth: 2 / (depth + 1e-10),
                    strokeOpacity: 1 / (depth + 1e-10),
                }}
            />
            {width > 50 && height > 30 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={12}
                    fontWeight="bold"
                >
                    {name}
                </text>
            )}
            {width > 50 && height > 50 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 16}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.7)"
                    fontSize={11}
                >
                    {((value / root.value) * 100).toFixed(1)}%
                </text>
            )}
        </g>
    );
};

export function InsightsView() {
    const { positions } = usePortfolio();
    const [recommendations, setRecommendations] = useState<Record<string, RecommendationTrend[]>>({});
    const [priceTargets, setPriceTargets] = useState<Record<string, PriceTarget>>({});
    const [profiles, setProfiles] = useState<Record<string, CompanyProfile>>({});
    const [loading, setLoading] = useState(false);

    // Color palette for charts (Cyan/Green theme compatible)
    const COLORS = ['#06b6d4', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444'];

    // 1. Calculate Portfolio Distribution (Pie Chart)
    const distributionData = useMemo(() => {
        return positions.map((pos) => ({
            name: pos.symbol,
            value: pos.price * pos.quantity,
        })).sort((a, b) => b.value - a.value);
    }, [positions]);

    // 2. Fetch Insights Data (Recs, Targets, Profiles)
    useEffect(() => {
        const fetchInsights = async () => {
            if (positions.length === 0) return;
            setLoading(true);

            const recsMap: Record<string, RecommendationTrend[]> = {};
            const targetsMap: Record<string, PriceTarget> = {};
            const profilesMap: Record<string, CompanyProfile> = {};

            try {
                // Fetch in parallel for all positions
                await Promise.all(positions.map(async (pos) => {
                    try {
                        const [recs, target, profile] = await Promise.all([
                            stocksAPI.getAnalystRecommendations(pos.symbol).catch(() => []),
                            stocksAPI.getPriceTarget(pos.symbol).catch(() => null),
                            stocksAPI.getCompanyProfile(pos.symbol).catch(() => null)
                        ]);

                        if (recs) recsMap[pos.symbol] = recs;
                        if (target) targetsMap[pos.symbol] = target as PriceTarget;
                        if (profile) profilesMap[pos.symbol] = profile as CompanyProfile;
                    } catch (e) {
                        console.error(`Error fetching insights for ${pos.symbol}`, e);
                    }
                }));

                setRecommendations(recsMap);
                setPriceTargets(targetsMap);
                setProfiles(profilesMap);
            } catch (error) {
                console.error("Failed to fetch all insights", error);
            } finally {
                setLoading(false);
            }
        };

        fetchInsights();
    }, [positions]);

    // 3. Prepare Sector Data (Treemap)
    const sectorData = useMemo(() => {
        const sectors: Record<string, number> = {};
        let totalValue = 0;

        positions.forEach(pos => {
            const value = pos.price * pos.quantity;
            const profile = profiles[pos.symbol];
            const sector = profile?.finnhubIndustry || 'Other';

            sectors[sector] = (sectors[sector] || 0) + value;
            totalValue += value;
        });

        return Object.entries(sectors).map(([name, value]) => ({
            name,
            value,
        })).sort((a, b) => b.value - a.value);
    }, [positions, profiles]);

    // 4. Prepare Recommendations List (Sorted by consensus)
    const analystCards = useMemo(() => {
        return positions.map(pos => {
            const recs = recommendations[pos.symbol];
            const target = priceTargets[pos.symbol];
            const latestRec = recs?.[0]; // Assuming sorted by date descending from API? reliable? Finnhub sends array.
            // Actually Finnhub /recommendation returns array of periods. [0] is usually latest.

            const buyVotes = latestRec ? (latestRec.buy + latestRec.strongBuy) : 0;
            const sellVotes = latestRec ? (latestRec.sell + latestRec.strongSell) : 0;
            const holdVotes = latestRec ? latestRec.hold : 0;
            const totalVotes = buyVotes + sellVotes + holdVotes;

            let consensus = 'Neutral';
            let consensusColor = 'bg-zinc-500';

            if (totalVotes > 0) {
                if (buyVotes > sellVotes && buyVotes > holdVotes) {
                    consensus = 'Buy';
                    consensusColor = 'bg-emerald-500';
                } else if (sellVotes > buyVotes && sellVotes > holdVotes) {
                    consensus = 'Sell';
                    consensusColor = 'bg-rose-500';
                } else {
                    consensus = 'Hold';
                    consensusColor = 'bg-yellow-500';
                }
            }

            // Calculate Upside
            const upside = target ? ((target.targetMean - pos.price) / pos.price) * 100 : 0;

            return {
                symbol: pos.symbol,
                name: pos.name,
                price: pos.price,
                consensus,
                consensusColor,
                target: target?.targetMean,
                upside,
                buyVotes,
                holdVotes,
                sellVotes
            };
        });
    }, [positions, recommendations, priceTargets]);


    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Top Row: Portfolio Allocation & Sectors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Allocation Pie Chart */}
                <Card className="bg-zinc-900/50 backdrop-blur-xl border-white/10">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <PieChartIcon className="w-5 h-5 text-cyan-400" />
                            Portfolio Allocation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={distributionData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {distributionData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    formatter={(value: number) => `$${value.toFixed(2)}`}
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                                />
                                <Legend
                                    layout="vertical"
                                    verticalAlign="middle"
                                    align="right"
                                    formatter={(value, _: any) => (
                                        <span className="text-zinc-300 text-sm ml-2">{value}</span>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Sector Heatmap */}
                <Card className="bg-zinc-900/50 backdrop-blur-xl border-white/10">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-purple-400" />
                            Sector Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {sectorData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <Treemap
                                    data={sectorData}
                                    dataKey="value"
                                    aspectRatio={4 / 3}
                                    stroke="#fff"
                                    content={<CustomTreemapContent colors={COLORS} />}
                                >
                                    <RechartsTooltip
                                        formatter={(value: number) => `$${value.toFixed(2)}`}
                                        contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                                    />
                                </Treemap>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-500">
                                {loading ? 'Loading sector data...' : 'No sector data available'}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Analyst Recommendations Feed */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-400" />
                    Analyst Recommendations & Price Targets
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {analystCards.map((item) => (
                        <div key={item.symbol} className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 hover:bg-zinc-900/60 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-lg text-white">{item.symbol}</h4>
                                        <Badge className={`${item.consensusColor} text-white border-none`}>
                                            {item.consensus}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-zinc-400 truncate max-w-[180px]">{item.name}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-zinc-400">Current</div>
                                    <div className="font-mono text-white">${item.price.toFixed(2)}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-white/5 rounded-lg p-3">
                                    <div className="text-xs text-zinc-500 mb-1">Avg Target</div>
                                    <div className="font-bold text-white">
                                        {item.target ? `$${item.target.toFixed(2)}` : 'N/A'}
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <div className="text-xs text-zinc-500 mb-1">Potential</div>
                                    <div className={`font-bold ${item.upside >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {item.upside > 0 ? '+' : ''}{item.upside.toFixed(1)}%
                                    </div>
                                </div>
                            </div>

                            {/* Recommendation Bar */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-zinc-400">
                                    <span>Analyst Ratings ({item.buyVotes + item.holdVotes + item.sellVotes})</span>
                                </div>
                                <div className="h-2 w-full flex rounded-full overflow-hidden bg-zinc-800">
                                    {item.buyVotes > 0 && (
                                        <div style={{ width: `${(item.buyVotes / (item.buyVotes + item.holdVotes + item.sellVotes)) * 100}%` }} className="bg-emerald-500 h-full" />
                                    )}
                                    {item.holdVotes > 0 && (
                                        <div style={{ width: `${(item.holdVotes / (item.buyVotes + item.holdVotes + item.sellVotes)) * 100}%` }} className="bg-yellow-500 h-full" />
                                    )}
                                    {item.sellVotes > 0 && (
                                        <div style={{ width: `${(item.sellVotes / (item.buyVotes + item.holdVotes + item.sellVotes)) * 100}%` }} className="bg-rose-500 h-full" />
                                    )}
                                </div>
                                <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                                    <span>Buy: {item.buyVotes}</span>
                                    <span>Hold: {item.holdVotes}</span>
                                    <span>Sell: {item.sellVotes}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
