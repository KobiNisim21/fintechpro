import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Bell, Download, X } from 'lucide-react';
import { t, useLanguage } from '@/i18n';
import { pushAPI } from '@/api/push';
import { applicationServerKey, getInstallPrompt, installApp, isAppleMobile, isStandalone, subscribeInstall } from '@/lib/pwa';
import { SimpleDialog } from './SimpleDialog';

const NotificationSettingsContext = createContext<(() => void) | null>(null);

export function NotificationSettingsButton() {
    useLanguage();
    const openSettings = useContext(NotificationSettingsContext);
    return <button type="button" className="data-action notification-settings-button" onClick={() => openSettings?.()}
        aria-label={t('Push notifications')} title={t('Push notifications')} aria-haspopup="dialog">
        <Bell size={20} aria-hidden="true" />
        <span>{t('Push notifications')}</span>
    </button>;
}

export function PwaNotifications({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const language = useLanguage();
    const prompt = useSyncExternalStore(subscribeInstall, getInstallPrompt, () => null);
    const [installed, setInstalled] = useState(isStandalone);
    const [dismissed, setDismissed] = useState(false), [instructions, setInstructions] = useState(false);
    const [active, setActive] = useState(false), [busy, setBusy] = useState(false);
    const [backgroundAvailable, setBackgroundAvailable] = useState<boolean | null>(null);
    const [error, setError] = useState(''), [message, setMessage] = useState('');
    const [permission, setPermission] = useState<NotificationPermission>(() => typeof Notification === 'undefined' ? 'default' : Notification.permission);
    const [ready, setReady] = useState<{ registration: ServiceWorkerRegistration; publicKey: string } | null>(null);
    const apple = isAppleMobile(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
    const supported = window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const needsInstall = apple && !installed;

    useEffect(() => {
        const media = matchMedia('(display-mode: standalone)');
        const update = () => setInstalled(isStandalone());
        const onInstalled = () => { setInstalled(true); setInstructions(false); };
        media.addEventListener('change', update); window.addEventListener('appinstalled', onInstalled);
        return () => { media.removeEventListener('change', update); window.removeEventListener('appinstalled', onInstalled); };
    }, []);
    useEffect(() => {
        if (!supported || needsInstall) return;
        let mounted = true;
        // Prepare the worker and public key before a tap; permission stays a direct gesture.
        void Promise.all([pushAPI.config(), navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(() => navigator.serviceWorker.ready)])
            .then(async ([config, registration]) => {
                const subscription = await registration.pushManager.getSubscription();
                const status = subscription ? await pushAPI.status(subscription.endpoint) : { subscribed: false };
                if (mounted) { setReady({ registration, publicKey: config.publicKey }); setActive(status.subscribed && Notification.permission === 'granted'); setBackgroundAvailable(config.backgroundChecks); setError(''); }
            }).catch(() => { if (mounted) setError('Push service unavailable. Refresh the page to retry.'); });
        const timer = setInterval(() => {
            void pushAPI.config().then(config => { if (mounted) setBackgroundAvailable(config.backgroundChecks); })
                .catch(() => { if (mounted) setBackgroundAvailable(false); });
        }, 60_000);
        return () => { mounted = false; clearInterval(timer); };
    }, [supported, needsInstall]);
    const enable = async () => {
        if (!ready) return;
        setBusy(true); setError(''); setMessage('');
        try {
            // No asynchronous network operation may precede this permission request on iOS.
            const granted = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
            setPermission(granted);
            if (granted !== 'granted') return;
            let subscription = await ready.registration.pushManager.getSubscription();
            if (!subscription) subscription = await ready.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(ready.publicKey) });
            await pushAPI.subscribe(subscription, language);
            setActive(true); setMessage('Push notifications enabled on this device.');
        } catch { setError('Could not enable push notifications. Please retry.'); }
        finally { setBusy(false); }
    };
    const disable = async () => {
        if (!ready) return;
        setBusy(true); setError(''); setMessage('');
        try {
            const subscription = await ready.registration.pushManager.getSubscription();
            if (subscription) { await pushAPI.unsubscribe(subscription.endpoint); await subscription.unsubscribe(); }
            setActive(false); setMessage('Push notifications disabled on this device.');
        } catch { setError('Could not disable push notifications. Please retry.'); }
        finally { setBusy(false); }
    };
    const test = async () => {
        setBusy(true); setError(''); setMessage('');
        try {
            const subscription = await ready?.registration.pushManager.getSubscription();
            if (!subscription) { setActive(false); throw Error('missing'); }
            await pushAPI.test(subscription.endpoint);
            setMessage('Test notification sent. Check your device.');
        } catch { setError('Could not send the test notification. Wait 30 seconds or enable push again.'); }
        finally { setBusy(false); }
    };
    const install = async () => {
        setError('');
        if (!prompt) { setInstructions(value => !value); return; }
        try { await installApp(); } catch { setInstructions(true); }
    };
    return <NotificationSettingsContext.Provider value={() => setOpen(true)}>
        {children}
        <SimpleDialog open={open} onClose={() => setOpen(false)} title="Push notifications">
        <section className="pwa-notifications space-y-5" aria-label={t('App installation and notifications')}>
        {!installed && !dismissed && <div className="pwa-install-row">
            <Download size={20} className="text-accent shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-1"><h2 className="font-semibold">{t('Install FinTechPro')}</h2><p className="text-sm text-slate-600">{t('Open your portfolio from your Home Screen. No app store download is needed.')}</p></div>
            <button className="data-action" onClick={() => void install()} aria-expanded={instructions}>{t('Install app')}</button>
            <button className="data-action pwa-dismiss" onClick={() => { setDismissed(true); setInstructions(false); }} aria-label={t('Dismiss installation suggestion')}><X size={18} /></button>
        </div>}
        {instructions && <div className="rounded-lg bg-canvas p-3 text-sm" role="status">{t(apple
            ? 'On iPhone or iPad: open this site in Safari, tap Share, choose Add to Home Screen, then Add. Open FinTechPro from the new icon and tap Enable push notifications.'
            : 'Open your browser menu and choose Install app or Add to Home Screen. If that option is unavailable, try Chrome, Edge or Safari on a supported device.')}</div>}
        <div className="pwa-push-row">
            <Bell size={20} className="text-accent shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-1"><h2 className="font-semibold">{t('Push notifications')}</h2><p className="text-sm text-slate-600">{t(active ? 'Enabled on this device. Personal alerts can appear even when the app is closed.' : 'Receive your personal alerts on this device, even when the app is closed.')}</p></div>
            <div className="flex flex-wrap gap-2">
                {needsInstall ? <button className="data-action" onClick={() => { setDismissed(false); setInstructions(true); }}>{t('Install to enable push')}</button>
                    : supported ? active ? <><button className="data-action" disabled={busy} onClick={() => void test()}>{t('Send test notification')}</button><button className="data-action" disabled={busy} onClick={() => void disable()}>{t('Disable on this device')}</button></>
                        : <button className="data-action primary-action" disabled={busy || !ready || permission === 'denied'} onClick={() => void enable()}>{t(busy ? 'Enabling…' : 'Enable push notifications')}</button>
                        : <p className="text-sm text-slate-600">{t('Push is unavailable in this browser. Use a supported browser; iPhone requires iOS 16.4 or later and Home Screen installation.')}</p>}
            </div>
        </div>
        {permission === 'denied' && <p className="text-sm text-amber-800">{t('Notifications are blocked. Allow them in your browser or device notification settings, then reopen the app.')}</p>}
        {active && backgroundAvailable === false && <p className="text-sm text-amber-800" role="status">{t('Background checks are not available yet. Keep your portfolio open for now; push delivery while closed requires background checks to resume.')}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{t(error)}</p>}
        {message && <p role="status" className="text-sm text-emerald-800">{t(message)}</p>}
    </section>
        </SimpleDialog>
    </NotificationSettingsContext.Provider>;
}
