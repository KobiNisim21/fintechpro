import api from './client';
import { isAxiosError } from 'axios';
export const portfolioToolError = (error: unknown, fallback: string) => isAxiosError(error) && typeof error.response?.data?.message === 'string' ? error.response.data.message : fallback;
export interface PortfolioEvent {
    _id: string; positionId: string; symbol: string; broker: string; type: string; occurredAt: string;
    quantity?: number; price?: number; amount?: number; realizedGain?: number; note?: string;
    before?: { quantity: number; averagePrice: number; broker: string };
    after?: { quantity: number; averagePrice: number; broker: string };
}
export interface ActivityAccount { _id: string; symbol: string; broker: string; quantity: number; isDeleted: boolean }
export interface ActivityPage { events: PortfolioEvent[]; total: number; accounts: ActivityAccount[] }
export interface AlertRule { _id: string; symbol: string; kind: string; threshold: number; enabled: boolean; lastTriggeredAt?: string; message?: string }
export const portfolioToolsAPI = {
    activity: async (offset = 0, type = ''): Promise<ActivityPage> => (await api.get('/activity', { params: { offset, type } })).data,
    record: async (id: string, data: Record<string, unknown>) => (await api.post(`/activity/${id}`, data)).data,
    alerts: async (): Promise<AlertRule[]> => (await api.get('/alerts')).data,
    createAlert: async (data: Record<string, unknown>) => (await api.post('/alerts', data)).data,
    updateAlert: async (id: string, enabled: boolean, rearm = false) => (await api.put(`/alerts/${id}`, { enabled, rearm })).data,
    deleteAlert: async (id: string) => { await api.delete(`/alerts/${id}`); },
    checkAlerts: async () => (await api.post('/alerts/check')).data,
    download: async () => {
        const response = await api.get('/activity/export', { responseType: 'blob' });
        const url = URL.createObjectURL(response.data), anchor = document.createElement('a');
        anchor.href = url; anchor.download = `FinTechPro-${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
};
