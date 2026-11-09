import { t, useLanguage, errorText } from '@/i18n';
import { lazy, Suspense, useEffect, useState } from 'react';
import { History, Bell, Download } from 'lucide-react';
import { portfolioToolsAPI } from '@/api/portfolioTools';
import { getSocket } from '@/services/socket';
const ActivityView = lazy(() => import('./ActivityView'));
const PersonalAlertsView = lazy(() => import('./PersonalAlertsView'));
export default function PortfolioTools() {
    useLanguage();
    const [panel, setPanel] = useState<'activity' | 'alerts' | null>(null);
    const [downloading, setDownloading] = useState(false), [error, setError] = useState('');
    const [triggered, setTriggered] = useState(0);
    useEffect(() => {
        let active = true;
        const reload = () => { void portfolioToolsAPI.alerts().then(rules => { if (active) setTriggered(rules.filter(rule => rule.lastTriggeredAt).length); }).catch(() => {}); };
        reload(); const timer = setInterval(reload, 60_000), socket = getSocket();
        socket?.on('personal-alert', reload); window.addEventListener('portfolio-alerts-updated', reload);
        return () => { active = false; clearInterval(timer); socket?.off('personal-alert', reload); window.removeEventListener('portfolio-alerts-updated', reload); };
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
        {panel && <Suspense fallback={<p role="status">{t("Loading portfolio tools…")}</p>}>{panel === 'activity' ? <ActivityView /> : <PersonalAlertsView />}</Suspense>}
    </section>;
}
