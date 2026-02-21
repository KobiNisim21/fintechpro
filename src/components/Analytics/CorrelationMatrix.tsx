
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface CorrelationMatrixProps {
    data: {
        symbols: string[];
        matrix: (number | null)[][];
    } | null;
    isLoading: boolean;
}

const CorrelationMatrix = React.memo(({ data, isLoading }: CorrelationMatrixProps) => {

    const content = useMemo(() => {
        if (isLoading || !data) return null;

        const { symbols: corrSymbols, matrix } = data;
        const cellSize = corrSymbols.length <= 5 ? 38 : corrSymbols.length <= 8 ? 28 : 22;
        const labelSize = corrSymbols.length <= 5 ? 36 : corrSymbols.length <= 8 ? 28 : 22;

        const getColor = (val: number | null) => {
            if (val === null) return 'rgba(255,255,255,0.05)';
            if (val >= 0) {
                const g = Math.round(120 + val * 135);
                return `rgba(${Math.round(34 + (1 - val) * 100)}, ${g}, ${Math.round(100 - val * 40)}, ${0.15 + val * 0.5})`;
            } else {
                const r = Math.round(180 + Math.abs(val) * 75);
                return `rgba(${r}, ${Math.round(100 - Math.abs(val) * 50)}, ${Math.round(100 - Math.abs(val) * 30)}, ${0.15 + Math.abs(val) * 0.5})`;
            }
        };

        return { corrSymbols, matrix, cellSize, labelSize, getColor };
    }, [data, isLoading]);

    return (
        <Card className="bg-white/5 backdrop-blur-md border-white/10 rounded-2xl shadow-lg lg:col-span-2 relative overflow-hidden">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-white/90 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-violet-400" />
                    Correlation Matrix
                    <span className="text-[10px] text-white/30 ml-auto">30-day Pearson</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {!content ? (
                    <div className="w-full h-[280px] bg-white/5 rounded-xl animate-pulse" />
                ) : (
                    <div className="overflow-x-auto overflow-y-hidden w-full py-2 max-h-[350px]">
                        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                            <div style={{ display: 'inline-block' }}>
                                {/* Header row */}
                                <div className="flex" style={{ paddingLeft: content.labelSize }}>
                                    {content.corrSymbols.map(sym => (
                                        <div key={sym} style={{ width: content.cellSize, minWidth: content.cellSize }}
                                            className="text-[9px] text-white/40 text-center font-mono truncate">
                                            {sym}
                                        </div>
                                    ))}
                                </div>
                                {/* Matrix rows */}
                                {content.matrix.map((row, i) => (
                                    <div key={i} className="flex items-center">
                                        <div style={{ width: content.labelSize, minWidth: content.labelSize }}
                                            className="text-[9px] text-white/40 font-mono truncate pr-1 text-right">
                                            {content.corrSymbols[i]}
                                        </div>
                                        {row.map((val, j) => (
                                            <div
                                                key={j}
                                                className="relative group cursor-pointer transition-all duration-200 hover:scale-110 hover:z-10 rounded-sm"
                                                style={{
                                                    width: content.cellSize - 2, height: content.cellSize - 2, margin: 1,
                                                    background: content.getColor(val),
                                                }}
                                            >
                                                {content.cellSize >= 36 && val !== null && (
                                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-white/60">
                                                        {val.toFixed(2)}
                                                    </span>
                                                )}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-white text-xs font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                                    {content.corrSymbols[i]} vs {content.corrSymbols[j]}: {val !== null ? val.toFixed(2) : 'N/A'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
            <img src="/logo.png" alt="" className="absolute bottom-3 right-3 w-8 h-8 opacity-10 pointer-events-none" />
        </Card>
    );
});

export default CorrelationMatrix;
