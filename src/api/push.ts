import api from './client';
export const pushAPI = {
    config: async (): Promise<{ publicKey: string; backgroundChecks: boolean }> => (await api.get('/push/config')).data,
    status: async (endpoint: string): Promise<{ subscribed: boolean }> => (await api.post('/push/status', { endpoint })).data,
    subscribe: async (subscription: PushSubscription, language: string) => (await api.post('/push/subscriptions', { subscription: subscription.toJSON(), language })).data,
    unsubscribe: async (endpoint: string) => (await api.delete('/push/subscriptions', { data: { endpoint } })).data,
    test: async (endpoint: string) => (await api.post('/push/test', { endpoint })).data,
};

export async function disablePushForLogout() {
    const token = localStorage.getItem('token');
    if (!('serviceWorker' in navigator)) return;
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager?.getSubscription();
        if (subscription) {
            try { if (token) await api.delete('/push/subscriptions', { timeout: 3000, headers: { Authorization: `Bearer ${token}` }, data: { endpoint: subscription.endpoint } }); }
            catch { /* Local unsubscribe still prevents delivery after signing out. */ }
            finally { await subscription.unsubscribe(); }
        }
        for (const notification of await registration?.getNotifications() || []) notification.close();
    } catch { /* Never prevent sign-out because a device service is unavailable. */ }
}
