import api from './client';

export interface AuthResponse {
    _id: string;
    name: string;
    email: string;
    picture?: string;
    token: string;
}

export const authAPI = {
    // Authenticate with Google
    googleAuth: async (credential: string): Promise<AuthResponse> => {
        const response = await api.post('/auth/google', { credential });
        return response.data;
    },

    // Get current user
    getMe: async (): Promise<Omit<AuthResponse, 'token'>> => {
        const response = await api.get('/auth/me');
        return response.data;
    },
};
