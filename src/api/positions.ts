import api from './client';

export interface Lot {
    quantity: number;
    price: number;
    date: string | Date;
}

export interface Position {
    _id: string;
    user: string;
    symbol: string;
    name: string;
    quantity: number;
    averagePrice: number;
    lots?: Lot[];
    createdAt: string;
    updatedAt: string;
}

export interface CreatePositionData {
    symbol: string;
    name: string;
    quantity: number;
    averagePrice: number;
    date?: string | Date;
}

export interface UpdatePositionData {
    quantity?: number;
    averagePrice?: number;
    lots?: Lot[];
}

export const positionsAPI = {
    // Get all positions
    getAll: async (): Promise<Position[]> => {
        const response = await api.get('/positions');
        return response.data;
    },

    // Add new position
    create: async (data: CreatePositionData): Promise<Position> => {
        const response = await api.post('/positions', data);
        return response.data;
    },

    // Update position
    update: async (id: string, data: UpdatePositionData): Promise<Position> => {
        const response = await api.put(`/positions/${id}`, data);
        return response.data;
    },

    // Delete position
    delete: async (id: string): Promise<void> => {
        await api.delete(`/positions/${id}`);
    },
};
