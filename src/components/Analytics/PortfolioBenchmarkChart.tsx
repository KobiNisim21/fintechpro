
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

interface BenchmarkPoint {
    date: string;
    portfolio: number;
    spy: number;
}

interface PortfolioBenchmarkChartProps {
    data: BenchmarkPoint[] | undefined;
    isLoading: boolean;
}

const PortfolioBenchmarkChart = React.memo(({ data, isLoading }: PortfolioBenchmarkChartProps) => {
    const [range, setRange] = useState<'1M' | '6M' | '1Y'>('1Y');

    const slicedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const daysMap = { '1M': 22, '6M': 130, '1Y': 365 };
        const days = daysMap[range];
        const sliced = data.slice(Math.max(0, data.length - days));

        // Re-normalise so both start at 0%
        if (sliced.length === 0) return [];
        const base = sliced[0];
        return sliced.map(d => ({
            date: d.date,
            portfolio: +(d.portfolio - base.portfolio).toFixed(2),
            spy: +(d.spy - base.spy).toFixed(2),
        }));
    }, [data, range]);

    return (
        <Card className="bg-white/5 backdrop-blur-md border-white/10 rounded-2xl shadow-lg lg:col-span-2 relative overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold text-white/90 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Portfolio vs S&P 500
                </CardTitle>
                <div className="flex gap-1">
                    {(['1M', '6M', '1Y'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${range === r
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                                }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="h-[280px]">
                {isLoading || !data ? (
                    <div className="w-full h-full bg-white/5 animate-pulse rounded-xl" />
                ) : slicedData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={slicedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                                tickFormatter={(d: string) => { const m = d.split('-'); return `${m[1]}/${m[2]}`; }}
                                interval={Math.max(1, Math.floor(slicedData.length / 6))}
                                axisLine={false} tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                                axisLine={false} tickLine={false}
                            />
                            <RechartsTooltip
                                contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: 12 }}
                                labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                                formatter={(value: number, name: string) => [
                                    `${value > 0 ? '+' : ''}${value.toFixed(2)}%`,
                                    name === 'portfolio' ? 'My Portfolio' : 'S&P 500'
                                ]}
                            />
                            <Area type="monotone" dataKey="portfolio" stroke="#22d3ee" strokeWidth={2} fill="url(#portfolioFill)" />
                            <Area type="monotone" dataKey="spy" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} strokeDasharray="6 3" fill="none" />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-sm">No benchmark data</div>
                )}
            </CardContent>
            {/* Watermark */}
            <img src="/logo.png" alt="" className="absolute bottom-3 right-3 w-8 h-8 opacity-10 pointer-events-none" />
        </Card>
    );
});

export default PortfolioBenchmarkChart;
