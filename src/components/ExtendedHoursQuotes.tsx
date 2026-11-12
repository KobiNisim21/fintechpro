import { t, useLanguage, locale } from '@/i18n';
import type { ExtendedQuote } from '@/api/stocks';

/** Keep both reported sessions distinct from the regular-session quote. */
export function ExtendedHoursQuotes({ quote, loaded }: { quote?: ExtendedQuote; loaded: boolean }) {
    useLanguage();
    const sessions = [
        { label: 'Pre-market', price: quote?.preMarketPrice, change: quote?.preMarketChangePercent },
        { label: 'After-hours', price: quote?.postMarketPrice, change: quote?.postMarketChangePercent },
    ];
    return <section className="watchlist-extended-quotes" aria-label={t('Extended-hours quotes')}>
        <dl className="grid grid-cols-2 gap-2">
            {sessions.map(session => {
                const available = typeof session.price === 'number' && Number.isFinite(session.price) && session.price > 0;
                const hasChange = typeof session.change === 'number' && Number.isFinite(session.change);
                return <div key={session.label} className="min-w-0 rounded-lg bg-canvas p-3">
                    <dt className="text-caption text-secondary">{t(session.label)}</dt>
                    <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-body text-ink font-semibold tabular-nums">
                            {!loaded ? '…' : available ? <bdi dir="ltr">{session.price!.toLocaleString(locale(), { style: 'currency', currency: 'USD' })}</bdi> : t('Price unavailable')}
                        </span>
                        {loaded && available && hasChange && <bdi dir="ltr" className={`text-caption tabular-nums ${session.change! >= 0 ? 'text-positive' : 'text-negative'}`}>
                            {session.change!.toLocaleString(locale(), { signDisplay: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                        </bdi>}
                    </dd>
                </div>;
            })}
        </dl>
        <p className="text-caption text-secondary mt-2">{t('Latest reported extended-hours quotes. May be delayed or from an earlier session.')}</p>
    </section>;
}
