
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

        // Calculate the cutoff date based on selected range
        const now = new Date();
        const cutoffDate = new Date(now);
        if (range === '1M') cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        else if (range === '6M') cutoffDate.setMonth(cutoffDate.getMonth() - 6);
        else cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        // Filter by actual calendar date, not array position
        const sliced = data.filter(d => d.date >= cutoffStr);

        // Calculate relative returns based on the start of this slice window
        if (sliced.length === 0) return [];

        const basePortfolio = 1 + (sliced[0].portfolio / 100);
        const baseSpy = 1 + (sliced[0].spy / 100);

        return sliced.map(d => {
            const currentPortfolio = 1 + (d.portfolio / 100);
            const currentSpy = 1 + (d.spy / 100);

            return {
                date: d.date,
                portfolio: +((currentPortfolio / basePortfolio - 1) * 100).toFixed(2),
                spy: +((currentSpy / baseSpy - 1) * 100).toFixed(2),
            };
        });
    }, [data, range]);

    return (
        <Card className="glass-card rounded-[32px] lg:col-span-2 relative overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    Portfolio vs S&P 500
                </CardTitle>
                <div className="flex gap-1">
                    {(['1M', '6M', '1Y'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${range === r
                                ? 'bg-emerald-500 text-white'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="h-[280px]">
                {isLoading || !data ? (
                    <div className="w-full h-full bg-slate-100 animate-pulse rounded-xl" />
                ) : slicedData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={slicedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                            <XAxis
                                dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }}
                                tickFormatter={(d: string) => { const m = d.split('-'); return `${m[1]}/${m[2]}`; }}
                                interval={Math.max(1, Math.floor(slicedData.length / 6))}
                                axisLine={false} tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                                axisLine={false} tickLine={false}
                            />
                            <RechartsTooltip
                                contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', fontSize: 12, boxShadow: '0 8px 32px rgba(31,38,135,0.07)' }}
                                labelStyle={{ color: '#64748b' }}
                                formatter={(value: number, name: string) => [
                                    `${value > 0 ? '+' : ''}${value.toFixed(2)}%`,
                                    name === 'portfolio' ? 'My Portfolio' : 'S&P 500'
                                ]}
                            />
                            <Area type="monotone" dataKey="portfolio" stroke="#10b981" strokeWidth={2} fill="url(#portfolioFill)" />
                            <Area type="monotone" dataKey="spy" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 3" fill="none" />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">No benchmark data</div>
                )}
            </CardContent>
            {/* Watermark & Version */}
            <div className="absolute bottom-3 right-3 flex flex-col items-end opacity-20 pointer-events-none">
                <img src="/logo.png" alt="" className="w-8 h-8 mb-1" />
                <span className="text-[10px] text-slate-400 font-mono">v9.0</span>
            </div>
        </Card>
    );
});

export default PortfolioBenchmarkChart;
