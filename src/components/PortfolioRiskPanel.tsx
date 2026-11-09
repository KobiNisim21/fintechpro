import { useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';

export default function PortfolioRiskPanel() {
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
    return <div className="data-panel p-5 space-y-4 min-w-0">
        <h3 className="font-bold text-lg">Portfolio Health & exposure</h3>
        <button className="data-action text-sm" disabled={analyticsLoading} onClick={() => void fetchAnalytics(true)}>Refresh analysis</button>
        {analyticsLoading && !analytics ? <p role="status">Loading analysis…</p> : <>
            <p className="text-3xl font-bold">{analytics?.healthScore == null ? 'Partial analysis' : `${analytics.healthScore} / 100`}</p>
            {analytics?.healthScore == null && <div dir="rtl" className="text-sm text-right text-amber-800 space-y-1" role="status">
                {(analytics?.coverage?.sectors ?? 0) < 80 && <p>חסר סיווג ענפי לחלק מהתיק. כיסוי נוכחי: {analytics?.coverage?.sectors ?? 0}%; נדרש לפחות 80% לחישוב הציון.</p>}
                {(analytics?.coverage?.beta ?? 0) < 80 && <p>חסרים גם נתוני רגישות לשוק לחלק מהאחזקות.</p>}
                {!analytics?.quoteCoverage && <p>חלק מנתוני המחיר אינם זמינים לחישוב מלא.</p>}
                <p>זו מגבלת נתונים, לא קביעה שהתיק אינו בריא. אין צורך לשנות את ההשקעות בגלל הודעה זו.</p>
                {!!analytics?.missingClassifications?.length && <p>ניירות ללא סיווג: <bdi>{analytics.missingClassifications.join(', ')}</bdi>.</p>}
            </div>}
            <p className="text-xs text-slate-600">A concentration and market-sensitivity heuristic, not a low-risk guarantee. Higher is better under this formula. Cash and fund underlying holdings are excluded.</p>
            {analytics?.stale && <p role="status" className="text-sm text-amber-800">Showing previous analysis; the latest refresh failed.</p>}
            <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt>Sector coverage</dt><dd>{analytics?.coverage?.sectors ?? 0}%</dd></div><div><dt>Beta coverage</dt><dd>{analytics?.coverage?.beta ?? 0}%</dd></div>
                <div><dt>Weighted beta</dt><dd>{analytics?.portfolioBeta?.toFixed(2) ?? 'Unknown'}</dd></div><div><dt>Quote coverage</dt><dd>{analytics?.quoteCoverage ? 'Available' : 'Incomplete'}</dd></div>
            </dl>
            <details className="text-xs text-slate-600"><summary className="cursor-pointer py-2">How the score works</summary><p>Current USD market values. 40% largest holding concentration, 40% largest known sector concentration, 20% absolute beta sensitivity. Requires at least 80% sector and beta coverage and quotes for every holding. Missing data produces no score; analyst sentiment does not affect it. Beta measures market sensitivity, not total volatility. Listing currency and country do not describe the underlying exposures of funds.</p></details>
        </>}
        {summary.total > 0 && <div dir="rtl" className="border-t pt-4 space-y-2 text-sm text-right">
            <h4 className="font-bold">מה הנתונים אומרים על התיק?</h4>
            {summary.largest && <p>האחזקה הגדולה היא <bdi>{summary.largest[0]}</bdi>, במשקל {(summary.largest[1] / summary.total * 100).toFixed(1)}% מהניירות בתיק, כולל חשבונות שונים.</p>}
            <p>שלוש האחזקות הגדולות מהוות {(summary.topThree / summary.total * 100).toFixed(1)}%. ככל שהמשקל מרוכז יותר, שינוי בנייר יחיד משפיע יותר על התיק.</p>
            <p>השינוי היומי המחושב מהציטוטים שהתקבלו: <bdi>{summary.daily.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</bdi>. זה אינו רווח ממומש.</p>
            {summary.uncovered > 0 && <p>ל־{(summary.uncovered / summary.total * 100).toFixed(1)}% מהשווי יש ציטוט שמור או משוער. יש להביא זאת בחשבון בפענוח התוצאות.</p>}
            <p className="text-xs text-slate-500">הסבר מחושב מהנתונים המוצגים, ללא מודל שפה וללא שליחה לשירות חיצוני.</p>
        </div>}
        {analytics?.exposures && <div className="space-y-3">{(['holdings', 'countries', 'currencies'] as const).map(key => <details key={key} className="text-sm"><summary className="cursor-pointer py-2 capitalize">{key === 'currencies' ? 'Listing currencies' : key === 'countries' ? 'Issuer countries' : 'Combined holdings'}</summary>{analytics.exposures?.[key]?.map(row => <div key={row.name} className="flex justify-between gap-2 py-1"><span className="break-words">{row.name}</span><span>{row.percent.toFixed(1)}%</span></div>)}</details>)}</div>}
        {analytics?.exposures && !analytics.quoteCoverage && <p className="text-xs text-amber-800">Exposure percentages cover available quotes only; missing quotes can change the weights.</p>}
        {!!analytics?.classifications?.length && <details className="text-sm border-t pt-3"><summary className="cursor-pointer py-2">Classification sources</summary><div className="space-y-3 mt-2">{analytics.classifications.map(row => <div key={row.symbol} className="text-xs break-words"><strong>{row.symbol} · {row.sector || 'Not classified'}</strong><p>{row.source || 'No verified source'}{row.asOf ? ` · ${row.asOf.slice(0, 10)}` : ''}{row.status === 'stale' ? ' · Previous data' : ''}</p></div>)}</div><p className="text-xs mt-3 text-slate-500">One broad sector per company. Funds require underlying holdings; they are not assigned a company sector.</p></details>}
    </div>;
}
