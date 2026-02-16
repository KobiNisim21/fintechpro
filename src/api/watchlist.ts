import api from './client';

export interface WatchlistItem {
    _id: string;
    user: string;
    symbol: string;
    name: string;
    createdAt: string;
}

export const watchlistAPI = {
    getAll: async (): Promise<WatchlistItem[]> => {
        const response = await api.get('/watchlist');
        return response.data;
    },

    add: async (symbol: string, name: string): Promise<WatchlistItem> => {
        const response = await api.post('/watchlist', { symbol, name });
        return response.data;
    },

    remove: async (id: string): Promise<void> => {
        await api.delete(`/watchlist/${id}`);
    },
};
