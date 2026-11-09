import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { portfolioToolsAPI, portfolioToolError, type ActivityPage } from '@/api/portfolioTools';
import { usePortfolio } from '@/context/PortfolioContext';
import { SimpleDialog } from './SimpleDialog';
const types = ['BUY', 'SELL', 'DIVIDEND', 'FEE', 'OPENING', 'ADJUSTMENT', 'REMOVE', 'RESTORE'];
const money = (value: number | undefined) => value == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
export default function ActivityView() {
    const { fetchPositions } = usePortfolio();
    const [page, setPage] = useState<ActivityPage | null>(null);
    const [type, setType] = useState(''), [error, setError] = useState('');
    const [loading, setLoading] = useState(false), [open, setOpen] = useState(false), [saving, setSaving] = useState(false);
    const [recordType, setRecordType] = useState('SELL');
    const requestVersion = useRef(0);
    const activityRequestId = useRef('');
    const load = useCallback(async (offset = 0) => {
        const version = ++requestVersion.current;
        setLoading(true); setError('');
        try { const next = await portfolioToolsAPI.activity(offset, type); if (version === requestVersion.current) setPage(previous => offset && previous ? { ...next, events: [...previous.events, ...next.events] } : next); }
        catch { if (version === requestVersion.current) setError('Activity could not be loaded. Please retry.'); } finally { if (version === requestVersion.current) setLoading(false); }
    }, [type]);
    useEffect(() => { setPage(null); void load(); }, [load]);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setSaving(true); setError(''); const form = new FormData(event.currentTarget);
        try {
            await portfolioToolsAPI.record(String(form.get('position')), { requestId: activityRequestId.current, type: recordType, quantity: form.get('quantity'), price: form.get('price'), fee: form.get('fee') || 0, amount: form.get('amount'), date: form.get('date') || undefined, note: form.get('note') });
            setOpen(false); await Promise.all([fetchPositions(), load()]);
        } catch (err: unknown) { setError(portfolioToolError(err, 'Recording failed. Please retry.')); } finally { setSaving(false); }
    };
    return <div className="data-panel p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold text-lg">Activity history</h2><button className="data-action min-h-11" onClick={() => { activityRequestId.current = crypto.randomUUID(); setError(''); setOpen(true); }} disabled={saving || !page?.accounts.length}>Record activity</button></div>
        <p className="text-xs text-slate-600">Legacy Opening entries reconstruct remaining lots; earlier sales and payments may be missing. Corrections/removals are not sales. Costs use USD. Income and fees do not change cash balances.</p>
        <div className="flex flex-wrap gap-3 items-center"><label className="text-sm">Activity type <select className="data-input ml-2" value={type} onChange={event => setType(event.target.value)}><option value="">All</option>{types.map(value => <option key={value}>{value}</option>)}</select></label><button className="data-action min-h-11" disabled={loading} onClick={() => void load()}>Refresh activity</button></div>
        {error && !open && <p role="alert" className="text-red-700 text-sm">{error}</p>}{loading && !page && <p role="status">Loading activity…</p>}
        {page && <><p className="text-xs text-slate-500">{page.total} entries · FIFO realized results exclude other fees and taxes. Corrections can change the cost basis.</p>
            {!page.events.length && <p>No recorded activity yet.</p>}
            <div className="space-y-3">{page.events.map(entry => <article key={entry._id} className="rounded-2xl border border-slate-200 p-3 sm:p-4 space-y-2">
                <div className="flex flex-wrap justify-between gap-2"><strong>{entry.symbol} · {entry.type}</strong><time className="text-xs text-slate-500">{new Date(entry.occurredAt).toLocaleString()}</time></div>
                <p className="text-xs text-slate-500">{entry.broker}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    {entry.quantity != null && <span>Shares: {entry.quantity}</span>}{entry.price != null && <span>Unit price: {money(entry.price)}</span>}
                    <span>Amount: {money(entry.amount ?? (entry.type === 'BUY' && entry.quantity != null && entry.price != null ? entry.quantity * entry.price : undefined))}</span>
                    {entry.realizedGain != null && <strong className={entry.realizedGain < 0 ? 'text-red-700' : 'text-emerald-700'}>Realized: {money(entry.realizedGain)}</strong>}
                </div>{entry.before && entry.after && ['ADJUSTMENT', 'RESTORE'].includes(entry.type) && <p className="text-xs text-slate-600">Shares: {entry.before.quantity} → {entry.after.quantity} · Average cost: {money(entry.before.averagePrice)} → {money(entry.after.averagePrice)} · Account: {entry.before.broker} → {entry.after.broker}</p>}
                {entry.note && <p className="text-xs text-slate-600 break-words">{entry.note}</p>}
            </article>)}</div>
            {page.events.length < page.total && <button className="data-action min-h-11" disabled={loading} onClick={() => void load(page.events.length)}>{loading ? 'Loading…' : 'Load more'}</button>}
        </>}
        <SimpleDialog open={open} onClose={() => setOpen(false)} title="Record activity">
            <form onSubmit={submit} className="space-y-4 p-1">
                <label className="block text-sm">Type<select className="data-input w-full mt-1" value={recordType} onChange={event => setRecordType(event.target.value)}><option value="SELL">Sale (FIFO)</option><option value="DIVIDEND">Dividend received</option><option value="FEE">Fee paid</option></select></label>
                <label className="block text-sm">Holding / account<select className="data-input w-full mt-1" name="position" required>{page?.accounts.filter(p => recordType !== 'SELL' || (!p.isDeleted && p.quantity > 0)).map(p => <option key={p._id} value={p._id}>{p.symbol} · {p.broker} · {p.isDeleted ? 'Archived' : `${p.quantity} shares`}</option>)}</select></label>
                {recordType === 'SELL' ? <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><label className="text-sm">Shares sold<input className="data-input w-full" name="quantity" type="number" min="0.00000001" step="any" required /></label><label className="text-sm">Price USD<input className="data-input w-full" name="price" type="number" min="0" step="any" required /></label><label className="text-sm">Sale fee USD<input className="data-input w-full" name="fee" type="number" min="0" step="any" defaultValue="0" /></label></div> : <label className="block text-sm">{recordType === 'DIVIDEND' ? 'Net amount received USD' : 'Fee paid USD'}<input className="data-input w-full" name="amount" type="number" min="0.00000001" step="any" required /></label>}
                <label className="block text-sm">Date<input className="data-input w-full" name="date" type="date" max={new Date().toISOString().slice(0, 10)} /></label>
                <label className="block text-sm">Note<input className="data-input w-full" name="note" maxLength={500} /></label>
                <p className="text-xs text-slate-500">Sale changes remaining shares. Dividend/fee entries record payments only. No cash posting or tax calculation. Leave date blank for the current time.</p>
                {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}<button className="data-action min-h-11 w-full" disabled={saving}>{saving ? 'Saving…' : 'Save activity'}</button>
                <button type="button" className="data-action min-h-11 w-full" onClick={() => setOpen(false)}>Close</button>
            </form>
        </SimpleDialog>
    </div>;
}
