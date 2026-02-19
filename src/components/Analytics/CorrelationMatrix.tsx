
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
        if (isLoading || !data) {
            return (
                <div className="w-full aspect-square max-w-[400px] mx-auto bg-white/5 rounded-xl animate-pulse" />
            );
        }

        const { symbols: corrSymbols, matrix } = data;
        const cellSize = corrSymbols.length <= 5 ? 48 : corrSymbols.length <= 8 ? 36 : 28;
        const labelSize = corrSymbols.length <= 5 ? 40 : corrSymbols.length <= 8 ? 32 : 24;

        const getColor = (val: number | null) => {
            if (val === null) return 'rgba(255,255,255,0.05)';
            if (val >= 0) {
                const g = Math.round(120 + val * 135); // 120 → 255
                return `rgba(${Math.round(34 + (1 - val) * 100)}, ${g}, ${Math.round(100 - val * 40)}, ${0.15 + val * 0.5})`;
            } else {
                const r = Math.round(180 + Math.abs(val) * 75);
                return `rgba(${r}, ${Math.round(100 - Math.abs(val) * 50)}, ${Math.round(100 - Math.abs(val) * 30)}, ${0.15 + Math.abs(val) * 0.5})`;
            }
        };

        return (
            <div className="overflow-x-auto">
                <div className="inline-block">
                    {/* Header row with symbols */}
                    <div className="flex" style={{ paddingLeft: labelSize }}>
                        {corrSymbols.map(sym => (
                            <div key={sym} style={{ width: cellSize, minWidth: cellSize }}
                                className="text-[9px] text-white/40 text-center font-mono truncate">
                                {sym}
                            </div>
                        ))}
                    </div>
                    {/* Matrix rows */}
                    {matrix.map((row, i) => (
                        <div key={i} className="flex items-center">
                            <div style={{ width: labelSize, minWidth: labelSize }}
                                className="text-[9px] text-white/40 font-mono truncate pr-1 text-right">
                                {corrSymbols[i]}
                            </div>
                            {row.map((val, j) => (
                                <div
                                    key={j}
                                    className="relative group cursor-pointer transition-all duration-200 hover:scale-110 hover:z-10 rounded-sm"
                                    style={{
                                        width: cellSize - 2, height: cellSize - 2, margin: 1,
                                        background: getColor(val),
                                    }}
                                >
                                    {/* Value inside cell (only if big enough) */}
                                    {cellSize >= 36 && val !== null && (
                                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-white/60">
                                            {val.toFixed(2)}
                                        </span>
                                    )}
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-white text-xs font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                        {corrSymbols[i]} vs {corrSymbols[j]}: {val !== null ? val.toFixed(2) : 'N/A'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }, [data, isLoading]);

    return (
        <Card className="bg-white/5 backdrop-blur-md border-white/10 rounded-2xl shadow-lg relative overflow-hidden">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-white/90 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-violet-400" />
                    Correlation Matrix
                    <span className="text-[10px] text-white/30 ml-auto">30-day Pearson</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {content}
            </CardContent>
            {/* Watermark */}
            <img src="/logo.png" alt="" className="absolute bottom-3 right-3 w-8 h-8 opacity-10 pointer-events-none" />
        </Card>
    );
});

export default CorrelationMatrix;
