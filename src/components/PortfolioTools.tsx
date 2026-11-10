import { t, useLanguage, errorText } from '@/i18n';
import { lazy, Suspense, useEffect, useState } from 'react';
import { History, Bell, Download } from 'lucide-react';
import { portfolioToolsAPI } from '@/api/portfolioTools';
import { getSocket } from '@/services/socket';
const ActivityView = lazy(() => import('./ActivityView'));
const PersonalAlertsView = lazy(() => import('./PersonalAlertsView'));
export default function PortfolioTools() {
    useLanguage();
    const [panel, setPanel] = useState<'activity' | 'alerts' | null>(() => new URLSearchParams(window.location.search).get('panel') === 'alerts' ? 'alerts' : null);
    const [downloading, setDownloading] = useState(false), [error, setError] = useState('');
    const [triggered, setTriggered] = useState(0);
    const [alertError, setAlertError] = useState('');
    const [latestAlert, setLatestAlert] = useState<Awaited<ReturnType<typeof portfolioToolsAPI.alerts>>[number] | null>(null);
    useEffect(() => {
        let active = true, checking = false;
        const startedAt = Date.now();
        const reload = () => { void portfolioToolsAPI.alerts().then(rules => {
            if (!active) return;
            setTriggered(rules.filter(rule => rule.lastTriggeredAt).length);
            const latest = rules.filter(rule => rule.lastTriggeredAt && Date.parse(rule.lastTriggeredAt) >= startedAt)
                .sort((a, b) => Date.parse(b.lastTriggeredAt!) - Date.parse(a.lastTriggeredAt!))[0];
            if (latest) setLatestAlert(latest);
        }).catch(() => {}); };
        const check = async () => {
            if (checking || document.visibilityState === 'hidden') return;
            checking = true;
            try {
                const result = await portfolioToolsAPI.checkAlerts();
                if (active) {
                    setAlertError('');
                    if (result.triggered.length) setLatestAlert(result.triggered[0]);
                    window.dispatchEvent(new CustomEvent('portfolio-alert-check-completed', { detail: result }));
                    reload();
                }
            } catch { if (active) setAlertError('Automatic alert check failed. Use Check now to retry.'); }
            finally { checking = false; }
        };
        const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
        reload(); void check(); const timer = setInterval(() => void check(), 60_000), socket = getSocket();
        socket?.on('personal-alert', reload); window.addEventListener('portfolio-alerts-updated', reload);
        document.addEventListener('visibilitychange', onVisible);
        return () => { active = false; clearInterval(timer); socket?.off('personal-alert', reload); window.removeEventListener('portfolio-alerts-updated', reload); document.removeEventListener('visibilitychange', onVisible); };
    }, []);
    const download = async () => {
        setDownloading(true); setError('');
        try { await portfolioToolsAPI.download(); } catch { setError('Export failed. Please try again.'); } finally { setDownloading(false); }
    };
    return <section className="space-y-4" aria-label={t("Portfolio tools")}>
        <div className="flex flex-wrap gap-2">
            <button className="data-action min-h-11" aria-expanded={panel === 'activity'} onClick={() => setPanel(panel === 'activity' ? null : 'activity')}><History size={17} /> {t(" Activity")}</button>
            <button className="data-action min-h-11" aria-expanded={panel === 'alerts'} onClick={() => setPanel(panel === 'alerts' ? null : 'alerts')}><Bell size={17} /> {t(" Personal alerts")}{triggered > 0 && <span className="rounded-full bg-amber-100 px-2 text-xs">{triggered} {t(" triggered")}</span>}</button>
            <button className="data-action min-h-11" disabled={downloading} onClick={download}><Download size={17} />{downloading ? t("Exporting…") : t("Export Excel")}</button>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{errorText(error)}</p>}
        {alertError && <p role="alert" className="text-sm text-red-700">{t(alertError)}</p>}
        {latestAlert && <p role="status" className="data-panel p-3 text-sm">{t("Personal alert triggered: {0}. Observed value: {1}", [latestAlert.symbol, latestAlert.lastValue])} <button className="data-action" onClick={() => setPanel('alerts')}>{t("Personal alerts")}</button></p>}
        {panel && <Suspense fallback={<p role="status">{t("Loading portfolio tools…")}</p>}>{panel === 'activity' ? <ActivityView /> : <PersonalAlertsView />}</Suspense>}
    </section>;
}
