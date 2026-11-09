import { t, useLanguage, locale, referenceText } from '@/i18n';
import { useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';

export default function PortfolioRiskPanel() {
    useLanguage();
    const { positions, portfolioAnalytics: analytics, analyticsLoading, fetchAnalytics } = usePortfolio();
    const summary = useMemo(() => {
        const values = new Map<string, number>();
        let total = 0, daily = 0, uncovered = 0;
        for (const p of positions) {
            const value = p.quantity * p.price;
            total += value; daily += p.quantity * p.change;
            values.set(p.symbol, (values.get(p.symbol) || 0) + value);
            if (p.priceStatus !== 'available') uncovered += value;
        }
        const rows = [...values].sort((a, b) => b[1] - a[1]);
        return { total, daily, largest: rows[0], topThree: rows.slice(0, 3).reduce((sum, row) => sum + row[1], 0), uncovered };
    }, [positions]);
    const broadFunds = analytics?.classifications?.filter(row => row.holdingCount) || [];
    return <div className="data-panel p-5 space-y-4 min-w-0">
        <h3 className="font-bold text-lg">{t("Portfolio Health & exposure")}</h3>
        <button className="data-action text-sm" disabled={analyticsLoading} onClick={() => void fetchAnalytics(true)}>{t("Refresh analysis")}</button>
        {analyticsLoading && !analytics ? <p role="status">{t("Loading analysis…")}</p> : <>
            <p className="text-3xl font-bold">{analytics?.healthScore == null ? t("Partial analysis") : <bdi dir="ltr">{`${analytics.healthScore} / 100`}</bdi>}</p>
            {analytics?.healthScore == null && <div className="text-sm text-amber-800 space-y-1" role="status">
                {(analytics?.coverage?.sectors ?? 0) < 80 && <p>{t("Sector data covers ")}{analytics?.coverage?.sectors ?? 0}{t("% of the portfolio; at least 80% is required to calculate the score.")}</p>}
                {(analytics?.coverage?.beta ?? 0) < 80 && <p>{t("Market-sensitivity data is missing for some holdings.")}</p>}
                {!analytics?.quoteCoverage && <p>{t("Some price data is unavailable.")}</p>}
                <p>{t("This is a data limitation, not a judgment that your portfolio is unhealthy. No investment action is required because of this message.")}</p>
                {!!analytics?.missingClassifications?.length && <p>{t("Missing sector data: ")}{analytics.missingClassifications.join(', ')}.</p>}
            </div>}
            <p className="text-xs text-slate-600">{t("A concentration and market-sensitivity heuristic, not a low-risk guarantee. Higher is better under this formula. Supported broad equity ETFs contribute their underlying diversification. Cash is excluded.")}</p>
            {analytics?.stale && <p role="status" className="text-sm text-amber-800">{t("Showing previous analysis; the latest refresh failed.")}</p>}
            <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt>{t("Sector coverage")}</dt><dd>{analytics?.coverage?.sectors ?? 0}%</dd></div><div><dt>{t("Beta coverage")}</dt><dd>{analytics?.coverage?.beta ?? 0}%</dd></div>
                <div><dt>{t("Covered weighted beta")}</dt><dd>{analytics?.portfolioBeta?.toFixed(2) ?? t("Unknown")}</dd></div><div><dt>{t("Quote coverage")}</dt><dd>{analytics?.quoteCoverage ? t("Available") : t("Incomplete")}</dd></div>
            </dl>
            <details className="text-xs text-slate-600"><summary className="cursor-pointer py-2">{t("How the score works")}</summary><p>{t("Current USD market values. 40% underlying issuer concentration, 40% sector concentration, 20% absolute beta sensitivity. Supported ETFs are expanded into their published holdings or an explicitly identified benchmark proxy. Direct and fund exposures to the same issuer are combined. Missing fund data receives no diversification credit. Requires at least 80% sector and beta coverage and quotes for every holding. Beta measures market sensitivity, not total volatility. Country and currency views describe listed instruments.")}</p></details>
        </>}
        {!!broadFunds.length && <div className="rounded-xl border border-emerald-200 p-3 space-y-2 text-sm">
            <h4 className="font-bold">{t("Broad-market funds")}</h4>
            <p>{analytics?.broadFundPercent?.toFixed(1)}{t("% of the portfolio is held in supported broad equity ETFs. Their underlying companies and sectors contribute to diversification.")}</p>
            {broadFunds.map(row => <p key={row.symbol}><strong><bdi dir="ltr">{row.symbol}</bdi></strong> · {t(row.label || "")} · {t(row.benchmark || "")} · {row.holdingCount} {t(" equity positions")}{row.proxy ? t(" · Benchmark proxy estimate") : ''}</p>)}
        </div>}
        {summary.total > 0 && <div className="border-t pt-4 space-y-2 text-sm">
            <h4 className="font-bold">{t("What your portfolio data shows")}</h4>
            {summary.largest && <p>{t("Your largest listed position is ")}<bdi dir="ltr">{summary.largest[0]}</bdi>{t(", at ")}{(summary.largest[1] / summary.total * 100).toFixed(1)}{t("% of securities value across accounts.")}</p>}
            <p>{t("Your three largest listed positions account for ")}{(summary.topThree / summary.total * 100).toFixed(1)}{t("%. A broad ETF can contain many companies within one listed position.")}</p>
            {analytics?.exposures?.issuers?.[0] && <p>{t("The largest combined underlying issuer exposure is ")}<bdi dir="ltr">{analytics.exposures.issuers[0].name}</bdi>{t(", at ")}{analytics.exposures.issuers[0].percent.toFixed(1)}{t("%, including supported fund holdings.")}</p>}
            <p>{t("The daily change calculated from received quotes is ")}{summary.daily.toLocaleString(locale(), { style: 'currency', currency: 'USD' })}{t(". This is not realized profit.")}</p>
            {summary.uncovered > 0 && <p>{(summary.uncovered / summary.total * 100).toFixed(1)}{t("% of value uses cached or estimated quotes. Allow for this when interpreting results.")}</p>}
            <p className="text-xs text-slate-500">{t("Calculated from the displayed data. No language model or external AI service is used.")}</p>
        </div>}
        {analytics?.exposures && <div className="space-y-3">{(['holdings', 'issuers', 'countries', 'currencies'] as const).map(key => <details key={key} className="text-sm"><summary className="cursor-pointer py-2">{key === 'currencies' ? t("Listing currencies") : key === 'countries' ? t("Issuer / fund domicile") : key === 'issuers' ? t("Underlying issuer exposure") : t("Combined listed positions")}</summary>{analytics.exposures?.[key]?.slice(0, key === 'issuers' ? 20 : undefined).map(row => <div key={row.name} className="flex justify-between gap-2 py-1"><span className="break-words">{key === "countries" ? t(row.name) : row.name === "Unknown" || row.name.endsWith(" unresolved") ? referenceText(row.name) : row.name}</span><span dir="ltr">{row.percent.toFixed(1)}%</span></div>)}{key === 'issuers' && <p className="text-xs text-slate-500">{t("Top 20 exposures. Alphabet share classes are combined.")}</p>}</details>)}</div>}
        {analytics?.exposures && !analytics.quoteCoverage && <p className="text-xs text-amber-800">{t("Exposure percentages cover available quotes only; missing quotes can change the weights.")}</p>}
        {!!analytics?.classifications?.length && <details className="text-sm border-t pt-3"><summary className="cursor-pointer py-2">{t("Classification sources")}</summary><div className="space-y-3 mt-2">{analytics.classifications.map(row => <div key={row.symbol} className="text-xs break-words"><strong><bdi dir="ltr">{row.symbol}</bdi> · {t(row.label || row.sector || "Not classified")}</strong><p>{referenceText(row.source || "No verified source")}{row.asOf ? ` · ${row.asOf.slice(0, 10)}` : ''}{row.status === 'stale' ? t(" · Previous data") : ''}</p>{row.proxy && <p>{t("Uses a broad-market holdings proxy, not this fund's exact holdings.")}</p>}</div>)}</div><p className="text-xs mt-3 text-slate-500">{t("Supported funds use dated issuer holdings. Sector and issuer weights include direct/fund overlap; unresolved holdings remain unknown.")}</p></details>}
    </div>;
}
