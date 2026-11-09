import { t, useLanguage, locale } from '@/i18n';
import type { PortfolioAnalytics } from '@/api/stocks';
export default function DividendCalendar({ analytics, loading }: { analytics: PortfolioAnalytics | null; loading: boolean }) {
    useLanguage();
    const rows = [...(analytics?.dividends || []), ...(analytics?.pendingPayouts || [])];
    const date = (value: string | null) => value ? new Date(value).toLocaleDateString(locale()) : t('Not announced');
    const money = (value: number | null, currency: string) => value === null ? t('Not announced') : `${value.toFixed(2)} ${currency}`;
    return <div className="data-panel p-5 min-w-0 space-y-4">
        <h3 className="font-bold text-lg">{t("Dividend calendar")}</h3>
        <p className="text-xs text-slate-600">{t("Current holdings only. Ex-date determines purchase eligibility; payment date is when the company pays. Annual rates are not divided by four. Forecasts are indicative, before tax, and are not received payments. Sold holdings may still be entitled; record actual net payments in Activity, including archived holdings.")}</p>
        {loading && !analytics ? <p role="status">{t("Loading dividends…")}</p> : !rows.length ? <p className="text-sm">{t("No dividend dates available. This does not prove that no dividend will be paid.")}</p> : rows.map((row, i) => <article key={`${row.symbol}-${i}`} className="border-b py-3 space-y-2">
            <strong>{row.symbol}</strong><dl className="grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs text-slate-500">{t("Ex-date")}</dt><dd>{date(row.exDate)}</dd></div><div><dt className="text-xs text-slate-500">{t("Payment date")}</dt><dd>{date(row.paymentDate)}</dd></div>
                <div><dt className="text-xs text-slate-500">{t("Per payment / share")}</dt><dd>{money(row.amount, row.currency || 'USD')}</dd></div><div><dt className="text-xs text-slate-500">{t("Indicative payout")}</dt><dd>{money(row.estimatedPayout, row.currency || 'USD')}</dd></div>
            </dl><p className="text-xs text-slate-500">{row.source || 'Yahoo Finance'} · {t(row.eligibility || "Eligibility requires purchase history")}</p>
        </article>)}
        {analytics?.lastUpdated && <p className="text-xs text-slate-500">{t("Updated ")}{new Date(analytics.lastUpdated).toLocaleString(locale())}</p>}
    </div>;
}
