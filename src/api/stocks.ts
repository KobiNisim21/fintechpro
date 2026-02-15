import apiClient from './client';

export const stocksAPI = {
    getQuote: async (symbol: string) => {
        const response = await apiClient.get(`/stocks/${symbol}/quote`);
        return response.data;
    },

    getStockNews: async (symbol: string) => {
        const response = await apiClient.get(`/stocks/${symbol}/news`);
        return response.data;
    },

    getMarketNews: async () => {
        const response = await apiClient.get('/stocks/market/news');
        return response.data;
    },

    getForexRate: async () => {
        const response = await apiClient.get('/stocks/forex/usd-ils');
        return response.data;
    },

    getStockHistory: async (symbol: string, from: number, to: number, resolution: string = 'D') => {
        const response = await apiClient.get(`/stocks/${symbol}/history`, {
            params: { from, to, resolution }
        });
        return response.data;
    },

    getExtendedQuote: async (symbol: string): Promise<ExtendedQuote> => {
        const response = await apiClient.get(`/stocks/${symbol}/extended-quote`);
        return response.data;
    },

    getBatchExtendedQuotes: async (symbols: string[]): Promise<Record<string, ExtendedQuote>> => {
        const response = await apiClient.get('/stocks/batch-extended-quote', {
            params: { symbols: symbols.join(',') }
        });
        return response.data;
    },

    search: async (query: string) => {
        const response = await apiClient.get('/stocks/search', {
            params: { q: query }
        });
        return response.data;
    },

    getAnalystRecommendations: async (symbol: string): Promise<RecommendationTrend[]> => {
        const response = await apiClient.get(`/stocks/${symbol}/recommendation`);
        return response.data;
    },

    getPriceTarget: async (symbol: string): Promise<PriceTarget> => {
        const response = await apiClient.get(`/stocks/${symbol}/price-target`);
        return response.data;
    },

    getCompanyProfile: async (symbol: string): Promise<CompanyProfile> => {
        const response = await apiClient.get(`/stocks/${symbol}/profile`);
        return response.data;
    },

    getBatchInsights: async (symbols: string[]): Promise<BatchInsightsResponse> => {
        const response = await apiClient.get('/stocks/batch-insights', {
            params: { symbols: symbols.join(',') }
        });
        return response.data;
    },
};

export interface StockQuote {
    c: number; // Current price
    d: number; // Change
    dp: number; // Percent change
    h: number; // High price of the day
    l: number; // Low price of the day
    o: number; // Open price of the day
    pc: number; // Previous close price
    t: number; // Timestamp
}

export interface ExtendedQuote {
    symbol: string;
    regularMarketPrice: number;
    regularMarketPreviousClose: number;
    regularMarketChange: number;
    regularMarketChangePercent: number;
    preMarketPrice: number | null;
    preMarketChange: number | null;
    preMarketChangePercent: number | null;
    postMarketPrice: number | null;
    postMarketChange: number | null;
    postMarketChangePercent: number | null;
    marketState: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED' | 'POSTPOST' | 'PREPRE';
    exchangeTimezoneName: string;
}

export interface CandleData {
    c: number[]; // Close prices
    t: number[]; // Timestamps
    s: string; // Status
}

export interface NewsItem {
    category: string;
    datetime: number;
    headline: string;
    id: number;
    image: string;
    related: string;
    source: string;
    summary: string;
    url: string;
}

export interface ForexRate {
    rate: number;
    source: string;
    base?: string;
    target?: string;
    error?: string;
}

export interface RecommendationTrend {
    buy: number;
    hold: number;
    period: string;
    sell: number;
    strongBuy: number;
    strongSell: number;
    symbol: string;
}

export interface PriceTarget {
    lastUpdated: string;
    symbol: string;
    targetHigh: number;
    targetLow: number;
    targetMean: number;
    targetMedian: number;
}

export interface CompanyProfile {
    country: string;
    currency: string;
    exchange: string;
    finnhubIndustry: string;
    ipo: string;
    logo: string;
    marketCapitalization: number;
    name: string;
    phone: string;
    shareOutstanding: number;
    ticker: string;
    weburl: string;
}

export interface BatchInsightsResponse {
    recommendations: Record<string, RecommendationTrend[]>;
    priceTargets: Record<string, PriceTarget>;
    profiles: Record<string, CompanyProfile>;
}
