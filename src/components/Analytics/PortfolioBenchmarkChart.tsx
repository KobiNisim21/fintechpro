import { t, useLanguage, locale } from '@/i18n';

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
    useLanguage();
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
        <Card className="benchmark-chart bg-surface rounded-xl shadow-card p-card-sm md:p-card border border-line/50 gap-4 lg:col-span-2 relative overflow-hidden">
            <CardHeader className="p-0 flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-subhead text-ink font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-accent" />
                    {t("Portfolio vs S&P 500")}</CardTitle>
                <div className="benchmark-range flex flex-wrap gap-1 bg-canvas rounded-lg p-1">
                    {(['1M', '6M', '1Y'] as const).map(r => (
                        <button
                            key={t(r)}
                            onClick={() => setRange(r)}
                            className={`min-h-11 min-w-11 px-3 py-1.5 text-caption font-medium rounded-md transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${range === r
                                ? 'bg-surface shadow-subtle text-ink font-semibold'
                                : 'text-secondary hover:text-ink hover:bg-surface-alt'
                                }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <p className="text-caption text-secondary">{t("Estimate from remaining purchase lots. Excludes closed holdings, sale proceeds, cash, fees and dividends; not a complete account return.")}</p>
            <CardContent className="benchmark-chart-area h-[300px] md:h-[380px] px-0 [&:last-child]:pb-0">
                {isLoading || !data ? (
                    <div className="w-full h-full bg-canvas motion-safe:animate-pulse rounded-lg" />
                ) : slicedData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={slicedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--app-positive)" stopOpacity={0.2} />
                                    <stop offset="100%" stopColor="var(--app-positive)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                            <XAxis
                                dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }}
                                tickFormatter={(d: string) => { return new Date(d + 'T00:00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric' }); }}
                                interval={Math.max(1, Math.floor(slicedData.length / 6))}
                                axisLine={false} tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                                axisLine={false} tickLine={false}
                            />
                            <RechartsTooltip
                                contentStyle={{ background: 'var(--app-surface)', border: '1px solid var(--app-line)', borderRadius: '10px', fontSize: 13, padding: '12px', boxShadow: 'var(--shadow-ios-card)' }}
                                labelStyle={{ color: 'var(--app-secondary)', fontFamily: 'var(--app-font)', fontSize: 11 }}
                                formatter={(value: number, name: string) => [
                                    `${value > 0 ? '+' : ''}${value.toFixed(2)}%`,
                                    name === 'portfolio' ? t('My Portfolio') : 'S&P 500'
                                ]}
                            />
                            <Area type="monotone" dataKey="portfolio" stroke="var(--app-positive)" strokeWidth={2} fill="url(#portfolioFill)" />
                            <Area type="monotone" dataKey="spy" stroke="var(--app-secondary)" strokeWidth={1.5} strokeDasharray="6 3" fill="none" />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-secondary text-caption">{t("No benchmark data")}</div>
                )}
            </CardContent>
            {/* Watermark & Version */}
            <div className="absolute bottom-3 end-3 flex flex-col items-end opacity-20 pointer-events-none">
                <img src="/logo.png" alt="" className="w-6 h-6 mb-1" />
                <span className="text-micro text-secondary font-mono font-medium" style={{ textShadow: 'none' }}>v9.0</span>
            </div>
        </Card>
    );
});

export default PortfolioBenchmarkChart;
