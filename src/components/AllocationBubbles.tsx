import { useMemo } from 'react';
import { locale, t, useLanguage } from '@/i18n';
import { buildAllocationBubbles, type AllocationValue } from '@/lib/allocationBubbles';

const colors = ['#5D41EC', '#8A92B2', '#0A101F', '#F7931A', '#07AB81', '#3B82F6', '#E5484D', '#64748B'];
const percentage = (value: number) => `${value.toLocaleString(locale(), { maximumFractionDigits: 1 })}%`;

export default function AllocationBubbles({ data }: { data: readonly AllocationValue[] }) {
    useLanguage();
    const { rows, bubbles, viewBox } = useMemo(() => buildAllocationBubbles(data), [data]);
    if (!rows.length) return <p className="text-caption text-secondary py-8 text-center">{t('No allocation data')}</p>;

    return <div className="allocation-bubbles">
        <div className="allocation-bubble-layout">
            <ul className="allocation-bubble-legend" tabIndex={0} aria-label={t('Allocation details')}>
                {rows.map((row, index) => <li key={row.name}>
                    <span className="allocation-bubble-swatch" aria-hidden="true" style={{ backgroundColor: colors[rows.length > 8 && index >= 7 ? 7 : index] }} />
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
                    const color = colors[index];
                    const label = bubble.otherCount ? t('Other {0} holdings', [bubble.otherCount]) : bubble.name;
                    return <g key={bubble.otherCount ? 'other-holdings' : bubble.name}>
                        <title>{`${label}: ${percentage(bubble.percent)}`}</title>
                        <circle cx={bubble.x} cy={bubble.y} r={bubble.r + 3} fill="none" stroke={color} strokeWidth={.8} strokeDasharray={`${bubble.r * 3.5} ${bubble.r * 3}`} transform={`rotate(${index * 55}, ${bubble.x}, ${bubble.y})`} aria-hidden="true" />
                        <circle cx={bubble.x} cy={bubble.y} r={bubble.r} fill={color} stroke="white" strokeWidth={1} />
                        {bubble.r >= 20 && <text x={bubble.x} y={bubble.y} textAnchor="middle" dominantBaseline="central" direction="ltr" fill={index === 3 || index === 4 ? '#0A101F' : '#FFFFFF'} style={{ fontSize: bubble.r >= 35 ? 14 : 12, fontWeight: 600 }}>
                            {percentage(bubble.percent)}
                        </text>}
                    </g>;
                })}
            </svg>
        </div>
        <p className="text-micro text-secondary mt-3">{t('Circle area represents portfolio weight. Full values are listed alongside.')}</p>
        {rows.length > 8 && <p className="text-micro text-secondary mt-1">{t('Smaller holdings are grouped in one bubble; every holding is listed.')}</p>}
    </div>;
}
