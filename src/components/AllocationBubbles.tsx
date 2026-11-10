import { useMemo } from 'react';
import { locale, t, useLanguage } from '@/i18n';
import { ALLOCATION_BUBBLE_LIMIT, buildAllocationBubbles, type AllocationValue } from '@/lib/allocationBubbles';
import { buildHoldingColors, groupedHoldingColor } from '@/lib/chartPalette';

const percentage = (value: number) => `${value.toLocaleString(locale(), { maximumFractionDigits: 1 })}%`;

export default function AllocationBubbles({ data }: { data: readonly AllocationValue[] }) {
    useLanguage();
    const { rows, bubbles, viewBox } = useMemo(() => buildAllocationBubbles(data), [data]);
    const colors = buildHoldingColors(rows.map(row => row.name));
    if (!rows.length) return <p className="text-caption text-secondary py-8 text-center">{t('No allocation data')}</p>;

    return <div className="allocation-bubbles">
        <div className="allocation-bubble-layout">
            <ul className="allocation-bubble-legend" tabIndex={0} aria-label={t('Allocation details')}>
                {rows.map((row) => <li key={row.name}>
                    <span className="allocation-bubble-swatch" aria-hidden="true" style={{ backgroundColor: colors.get(row.name)!.fill }} />
                    <div className="min-w-0">
                        <div className="allocation-bubble-legend-heading">
                            <bdi className="text-caption text-ink font-semibold">{row.name}</bdi>
                            <span dir="ltr" className="text-caption text-secondary tabular-nums">{percentage(row.percent)}</span>
                        </div>
                        <span dir="ltr" className="text-micro text-secondary tabular-nums block">
                            {row.value.toLocaleString(locale(), { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </li>)}
            </ul>
            <svg className="allocation-bubble-graphic" viewBox={viewBox} role="img" aria-label={t('Portfolio allocation bubbles')}>
                {bubbles.map((bubble, index) => {
                    const color = bubble.otherCount ? groupedHoldingColor : colors.get(bubble.name)!;
                    const label = bubble.otherCount ? t('Other {0} holdings', [bubble.otherCount]) : bubble.name;
                    return <g key={bubble.otherCount ? 'other-holdings' : bubble.name}>
                        <title>{`${label}: ${percentage(bubble.percent)}`}</title>
                        <circle cx={bubble.x} cy={bubble.y} r={bubble.r + 3} fill="none" stroke={color.fill} strokeWidth={.6} strokeDasharray={`${bubble.r * 3.5} ${bubble.r * 3}`} transform={`rotate(${index * 55}, ${bubble.x}, ${bubble.y})`} aria-hidden="true" />
                        <circle cx={bubble.x} cy={bubble.y} r={bubble.r} fill={color.fill} stroke="white" strokeWidth={1.5} />
                        {bubble.r >= 20 && <text x={bubble.x} y={bubble.y} textAnchor="middle" dominantBaseline="central" direction="ltr" fill={color.text} style={{ fontSize: bubble.r >= 35 ? 14 : 12, fontWeight: 600 }}>
                            {bubble.otherCount ? <>
                                <tspan x={bubble.x} dy="-.45em">{t('Other')}</tspan>
                                <tspan x={bubble.x} dy="1.2em">{percentage(bubble.percent)}</tspan>
                            </> : percentage(bubble.percent)}
                        </text>}
                    </g>;
                })}
            </svg>
        </div>
        <p className="text-micro text-secondary mt-3">{t('Circle area represents portfolio weight. Full values are listed alongside.')}</p>
        {rows.length > ALLOCATION_BUBBLE_LIMIT && <>
            <p className="text-micro text-secondary mt-1">{t('Smaller holdings are grouped in one bubble; every holding is listed.')}</p>
            <details className="allocation-all-details border-t border-line mt-3 pt-1">
                <summary className="text-caption text-accent cursor-pointer min-h-11 py-3">{t('All holding bubbles ({0})', [rows.length])}</summary>
                <ul className="allocation-all-bubbles" tabIndex={0} aria-label={t('All holding bubbles ({0})', [rows.length])}>
                    {rows.map(row => {
                        const color = colors.get(row.name)!;
                        const r = 52 * Math.sqrt(row.value / rows[0].value);
                        return <li key={row.name}>
                            <svg viewBox="0 0 112 112" role="img" aria-label={`${row.name}: ${percentage(row.percent)}`}>
                                <circle cx={56} cy={56} r={r} fill={color.fill} />
                            </svg>
                            <bdi className="text-caption text-ink font-semibold">{row.name}</bdi>
                            <span dir="ltr" className="text-caption text-secondary tabular-nums">{percentage(row.percent)}</span>
                        </li>;
                    })}
                </ul>
            </details>
        </>}
    </div>;
}
