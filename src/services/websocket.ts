type PriceUpdateCallback = (symbol: string, price: number) => void;

interface TradeMessage {
    type: string;
    data: Array<{
        s: string; // symbol
        p: number; // price
        t: number; // timestamp
        v: number; // volume
    }>;
}

class FinnhubWebSocketService {
    private ws: WebSocket | null = null;
    private apiKey: string;
    private subscribers: Set<PriceUpdateCallback> = new Set();
    private subscribedSymbols: Set<string> = new Set();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 3000;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log('⚠️ WebSocket already connected');
            return;
        }

        console.log('🔌 Connecting to Finnhub WebSocket...');

        this.ws = new WebSocket(`wss://ws.finnhub.io?token=${this.apiKey}`);

        this.ws.onopen = () => {
            console.log('✅ WebSocket connected!');
            this.reconnectAttempts = 0;

            // Resubscribe to all symbols
            this.subscribedSymbols.forEach(symbol => {
                this.subscribeToSymbol(symbol);
            });
        };

        this.ws.onmessage = (event) => {
            try {
                const message: TradeMessage = JSON.parse(event.data);

                if (message.type === 'trade' && message.data) {
                    message.data.forEach(trade => {
                        const symbol = trade.s;
                        const newPrice = trade.p;

                        // Notify all subscribers with just the price
                        // Let them calculate change based on their own previous close data
                        this.subscribers.forEach(callback => {
                            callback(symbol, newPrice);
                        });

                        console.log(`📊 ${symbol}: $${newPrice.toFixed(2)}`);
                    });
                }
            } catch (error) {
                console.error('❌ Error parsing WebSocket message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            this.handleReconnect();
        };
    }

    private handleReconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay);
        } else {
            console.error('❌ Max reconnection attempts reached');
        }
    }

    subscribeToSymbol(symbol: string): void {
        this.subscribedSymbols.add(symbol);

        if (!this.ws) {
            // Not connected at all, will subscribe when connect() is called
            return;
        }

        if (this.ws.readyState === WebSocket.CONNECTING) {
            // Silently queue it. The onopen handler will process the queue.
            return;
        }

        if (this.ws.readyState !== WebSocket.OPEN) {
            console.warn(`⚠️ WebSocket closed. Will subscribe to ${symbol} upon reconnection.`);
            return;
        }

        const message = JSON.stringify({ type: 'subscribe', symbol });
        this.ws.send(message);
        console.log(`📡 Subscribed to ${symbol}`);
    }

    unsubscribeFromSymbol(symbol: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const message = JSON.stringify({ type: 'unsubscribe', symbol });
        this.ws.send(message);
        this.subscribedSymbols.delete(symbol);
        console.log(`📡 Unsubscribed from ${symbol}`);
    }

    onPriceUpdate(callback: PriceUpdateCallback): () => void {
        this.subscribers.add(callback);

        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
        };
    }

    disconnect(): void {
        console.log('🔌 Disconnecting WebSocket...');

        // Unsubscribe from all symbols
        this.subscribedSymbols.forEach(symbol => {
            this.unsubscribeFromSymbol(symbol);
        });

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.subscribers.clear();
        this.subscribedSymbols.clear();
    }

    getSubscribedSymbols(): string[] {
        return Array.from(this.subscribedSymbols);
    }
}

// Singleton instance
let websocketService: FinnhubWebSocketService | null = null;

export const getFinnhubWebSocket = (apiKey?: string): FinnhubWebSocketService => {
    if (!websocketService) {
        if (!apiKey) {
            throw new Error('API key required for first initialization');
        }
        websocketService = new FinnhubWebSocketService(apiKey);
    }
    return websocketService;
};

export type { PriceUpdateCallback };
