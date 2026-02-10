import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { initSocket, disconnectSocket } from '@/services/socket';

export interface NewsItem {
    id: string;
    source: string;
    headline?: string;
    summary?: string;
    content: string;
    tickers: string[];
    pubDate: string;
    relativeTime: string;
    link?: string;
    image?: string;
}

interface MarketNewsContextType {
    news: NewsItem[];
    currentPage: number;
    setCurrentPage: (page: number) => void;
    totalPages: number;
    loading: boolean;
    connected: boolean;
    newItemsCount: number;
    clearNewCount: () => void;
}

const MarketNewsContext = createContext<MarketNewsContextType | undefined>(undefined);

const ITEMS_PER_PAGE = 4;

export function MarketNewsProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, token } = useAuth();
    const [news, setNews] = useState<NewsItem[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [newItemsCount, setNewItemsCount] = useState(0);

    const clearNewCount = useCallback(() => setNewItemsCount(0), []);

    useEffect(() => {
        if (!isAuthenticated || !token) {
            disconnectSocket();
            setNews([]);
            setConnected(false);
            return;
        }

        const socket = initSocket(token);

        socket.on('connect', () => {
            setConnected(true);
            setLoading(false);
        });

        socket.on('disconnect', () => {
            setConnected(false);
        });

        socket.on('market-news-update', (data: { items: NewsItem[]; newCount: number }) => {
            console.log('📰 Received market news update:', data.items.length, 'items, new:', data.newCount);
            setNews(data.items);
            // Only set newCount if there are actual new items (not just on reconnect)
            if (data.newCount > 0) {
                setNewItemsCount(data.newCount); // Replace instead of accumulate
            }
            setLoading(false);
        });

        // Timeout for initial load
        const timeout = setTimeout(() => setLoading(false), 5000);

        return () => {
            clearTimeout(timeout);
            socket.off('market-news-update');
        };
    }, [isAuthenticated, token]);

    const totalPages = Math.ceil(news.length / ITEMS_PER_PAGE);

    return (
        <MarketNewsContext.Provider value={{
            news,
            currentPage,
            setCurrentPage,
            totalPages,
            loading,
            connected,
            newItemsCount,
            clearNewCount
        }}>
            {children}
        </MarketNewsContext.Provider>
    );
}

export function useMarketNews() {
    const context = useContext(MarketNewsContext);
    if (context === undefined) {
        throw new Error('useMarketNews must be used within a MarketNewsProvider');
    }
    return context;
}

/**
 * Get paginated news items
 */
export function usePaginatedNews() {
    const { news, currentPage } = useMarketNews();
    const start = currentPage * ITEMS_PER_PAGE;
    return news.slice(start, start + ITEMS_PER_PAGE);
}
