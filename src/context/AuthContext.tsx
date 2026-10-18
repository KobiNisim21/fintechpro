import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { authAPI, AuthResponse } from '../api/auth';

interface User {
    _id: string;
    name: string;
    email: string;
    picture?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    loginWithGoogle: (credential: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Load user from localStorage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const loginWithGoogle = useCallback(async (credential: string) => {
        try {
            const response: AuthResponse = await authAPI.googleAuth(credential);
            const { token: newToken, ...userData } = response;

            setToken(newToken);
            setUser(userData);

            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(userData));
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Google authentication failed';
            throw new Error(msg);
        }
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                loading,
                loginWithGoogle,
                logout,
                isAuthenticated: !!token && !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
