import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { initSocket, disconnectSocket } from '../services/socket';

export interface LiveAlert {
    id: string;
    type: 'gain' | 'loss' | 'news';
    ticker: string;
    companyName: string;
    message: string;
    value?: number; // percentage for price alerts
    timestamp: string;
    relativeTime: string;
}

interface LiveAlertsContextType {
    alerts: LiveAlert[];
    loading: boolean;
    connected: boolean;
    hasNewAlerts: boolean;
    clearNewAlerts: () => void;
}

const LiveAlertsContext = createContext<LiveAlertsContextType | undefined>(undefined);

export function LiveAlertsProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, token } = useAuth();
    const [alerts, setAlerts] = useState<LiveAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [hasNewAlerts, setHasNewAlerts] = useState(false);

    const clearNewAlerts = useCallback(() => setHasNewAlerts(false), []);

    useEffect(() => {
        if (!isAuthenticated || !token) {
            console.log('🔔 [ALERTS-FE] Not authenticated, disconnecting socket');
            disconnectSocket();
            setAlerts([]);
            setConnected(false);
            return;
        }

        console.log('🔔 [ALERTS-FE] Initializing socket with token');
        const socket = initSocket(token);

        // If socket is already connected, set state immediately (only once)
        if (socket.connected && !connected) {
            console.log('🔔 [ALERTS-FE] Socket already connected!');
            setConnected(true);
            setLoading(false);
        }

        socket.on('connect', () => {
            console.log('🔔 [ALERTS-FE] Socket connected!');
            setConnected(true);
            setLoading(false);
        });

        socket.on('disconnect', () => {
            console.log('🔔 [ALERTS-FE] Socket disconnected');
            setConnected(false);
        });

        // Initial alerts on connect
        socket.on('live-alerts-init', (data: { alerts: LiveAlert[] }) => {
            console.log('🔔 [ALERTS-FE] Received initial alerts:', data.alerts.length, data.alerts);
            setAlerts(data.alerts);
            setLoading(false);
        });

        // New alert received
        socket.on('live-alert', (data: { alert: LiveAlert; allAlerts: LiveAlert[] }) => {
            console.log('🔔 [ALERTS-FE] 🚨 NEW LIVE ALERT:', data.alert.message);
            console.log('🔔 [ALERTS-FE] All alerts now:', data.allAlerts.length, data.allAlerts);
            setAlerts(data.allAlerts);
            setHasNewAlerts(true);
        });

        // Timeout for initial load
        const timeout = setTimeout(() => {
            console.log('🔔 [ALERTS-FE] Loading timeout reached');
            setLoading(false);
        }, 5000);

        return () => {
            clearTimeout(timeout);
            socket.off('live-alerts-init');
            socket.off('live-alert');
        };
    }, [isAuthenticated, token]);

    return (
        <LiveAlertsContext.Provider
            value={{
                alerts,
                loading,
                connected,
                hasNewAlerts,
                clearNewAlerts
            }}
        >
            {children}
        </LiveAlertsContext.Provider>
    );
}

export function useLiveAlerts() {
    const context = useContext(LiveAlertsContext);
    if (context === undefined) {
        throw new Error('useLiveAlerts must be used within a LiveAlertsProvider');
    }
    return context;
}
