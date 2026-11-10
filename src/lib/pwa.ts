export interface InstallPrompt extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let installPrompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
export const subscribeInstall = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getInstallPrompt = () => installPrompt;
if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event as InstallPrompt; notify(); });
    window.addEventListener('appinstalled', () => { installPrompt = null; notify(); });
}
export async function installApp() {
    const prompt = installPrompt;
    if (!prompt) return null;
    installPrompt = null; notify();
    await prompt.prompt();
    return (await prompt.userChoice).outcome;
}
export function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
export function isAppleMobile(userAgent: string, platform: string, touchPoints: number) {
    return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1);
}
export function applicationServerKey(value: string): ArrayBuffer {
    const text = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    return bytes.buffer;
}
export async function disableLocalPush() {
    if (!('serviceWorker' in navigator)) return;
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager?.getSubscription();
        if (subscription) await subscription.unsubscribe();
        for (const notification of await registration?.getNotifications() || []) notification.close();
    } catch { /* Signing out must not be blocked by an unavailable browser service. */ }
}
