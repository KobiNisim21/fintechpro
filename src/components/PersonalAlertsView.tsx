import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { portfolioToolsAPI, portfolioToolError, type AlertRule } from '@/api/portfolioTools';
import { usePortfolio } from '@/context/PortfolioContext';
const labels: Record<string, string> = { price_above: 'Price at or above (USD)', price_below: 'Price at or below (USD)', daily_move: 'Absolute daily move (%)', concentration: 'Holding weight at or above (%)' };
export default function PersonalAlertsView() {
    const { positions } = usePortfolio();
    const [rules, setRules] = useState<AlertRule[]>([]), [error, setError] = useState(''), [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
    const load = useCallback(async () => { try { setRules(await portfolioToolsAPI.alerts()); setLoaded(true); } catch { setError('Could not load alerts. Please retry.'); } }, []);
    useEffect(() => { void load(); const timer = setInterval(() => void load(), 60_000); return () => clearInterval(timer); }, [load]);
    const run = async (action: () => Promise<unknown>) => { setBusy(true); setError(''); setStatus(''); try { await action(); await load(); window.dispatchEvent(new Event('portfolio-alerts-updated')); } catch (err: unknown) { setError(portfolioToolError(err, 'Action failed. Please retry.')); } finally { setBusy(false); } };
    const create = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); const form = event.currentTarget, values = new FormData(form);
        void run(async () => { await portfolioToolsAPI.createAlert({ symbol: values.get('symbol'), kind: values.get('kind'), threshold: Number(values.get('threshold')) }); form.reset(); });
    };
    return <div className="data-panel p-4 sm:p-6 space-y-4">
        <h2 className="font-bold text-lg">Personal alerts</h2>
        <p className="text-xs text-slate-600">In-app alerts, checked about once a minute by the running backend and on demand. Quotes may be delayed. Price alerts pause after triggering; percentage rules repeat at most once per 24 hours. No email or Telegram delivery.</p>
        <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <label className="text-sm">Holding<select name="symbol" className="data-input w-full" required>{[...new Set(positions.map(p => p.symbol))].map(symbol => <option key={symbol}>{symbol}</option>)}</select></label>
            <label className="text-sm">Condition<select name="kind" className="data-input w-full" required>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label className="text-sm">Threshold<input name="threshold" className="data-input w-full" type="number" min="0.00000001" step="any" required /></label>
            <button className="data-action min-h-11" disabled={busy || !positions.length}>Create alert</button>
        </form>
        <div className="flex flex-wrap gap-2"><button className="data-action min-h-11" disabled={busy} onClick={() => void run(async () => { const result = await portfolioToolsAPI.checkAlerts(); setStatus(`${result.triggered.length} alert(s) triggered. Missing data does not trigger an alert.`); })}>Check now</button><button className="data-action min-h-11" disabled={busy} onClick={() => void load()}>Refresh alerts</button></div>
        {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}{status && <p role="status" className="text-sm">{status}</p>}
        {!loaded && !error && <p role="status">Loading alerts…</p>}{loaded && !rules.length && <p className="text-sm">No personal alerts yet.</p>}
        {rules.map(rule => <article key={rule._id} className="border border-slate-200 rounded-2xl p-3 space-y-2">
            <p className="font-semibold break-words">{rule.symbol} · {labels[rule.kind]} {rule.threshold}</p><p className="text-xs">{rule.enabled ? 'Active' : 'Paused'}</p>
            {rule.lastTriggeredAt && <p className="text-sm text-amber-800">{rule.message}<br /><time>{new Date(rule.lastTriggeredAt).toLocaleString()}</time></p>}
            <div className="flex flex-wrap gap-2"><button className="data-action min-h-11" disabled={busy} onClick={() => void run(() => portfolioToolsAPI.updateAlert(rule._id, !rule.enabled, !rule.enabled))}>{rule.enabled ? 'Pause' : 'Rearm'}</button><button className="data-action min-h-11" disabled={busy} onClick={() => void run(() => portfolioToolsAPI.deleteAlert(rule._id))}>Delete alert</button></div>
        </article>)}
    </div>;
}
