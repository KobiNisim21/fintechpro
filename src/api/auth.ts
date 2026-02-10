import api from './client';

export interface AuthResponse {
    _id: string;
    name: string;
    email: string;
    token: string;
}

export interface LoginData {
    email: string;
    password: string;
}

export interface RegisterData {
    name: string;
    email: string;
    password: string;
}

export const authAPI = {
    // Register new user
    register: async (data: RegisterData): Promise<AuthResponse> => {
        const response = await api.post('/auth/register', data);
        return response.data;
    },

    // Login user
    login: async (data: LoginData): Promise<AuthResponse> => {
        const response = await api.post('/auth/login', data);
        return response.data;
    },

    // Get current user
    getMe: async (): Promise<Omit<AuthResponse, 'token'>> => {
        const response = await api.get('/auth/me');
        return response.data;
    },
};
