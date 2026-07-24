import { getSocket } from './socket';

type PriceUpdateCallback = (symbol: string, price: number) => void;

class PriceStreamService {
  private subscribers: Set<PriceUpdateCallback> = new Set();
  private subscribedSymbols: Set<string> = new Set();
  private initialized = false;

  connect(): void {
    if (this.initialized) return;
    this.initialized = true;

    const socket = getSocket();
    if (!socket) {
      console.warn('Socket not available for price streaming');
      return;
    }

    // Listen for price updates relayed from server
    socket.on('price-update', (data: { symbol: string; price: number; timestamp: number }) => {
      this.subscribers.forEach(callback => {
        callback(data.symbol, data.price);
      });
    });

    // Subscribe to symbols on the server
    if (this.subscribedSymbols.size > 0) {
      socket.emit('subscribe-prices', { symbols: Array.from(this.subscribedSymbols) });
    }
  }

  subscribeToSymbol(symbol: string): void {
    if (this.subscribedSymbols.has(symbol)) return;
    this.subscribedSymbols.add(symbol);

    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('subscribe-prices', { symbols: [symbol] });
    }
  }

  unsubscribeFromSymbol(symbol: string): void {
    this.subscribedSymbols.delete(symbol);
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('unsubscribe-prices', { symbols: [symbol] });
    }
  }

  onPriceUpdate(callback: PriceUpdateCallback): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  disconnect(): void {
    const socket = getSocket();
    if (socket) {
      socket.off('price-update');
      if (this.subscribedSymbols.size > 0) {
        socket.emit('unsubscribe-prices', { symbols: Array.from(this.subscribedSymbols) });
      }
    }
    this.subscribers.clear();
    this.subscribedSymbols.clear();
    this.initialized = false;
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }
}

let service: PriceStreamService | null = null;

// Keep the same export signature so PortfolioContext doesn't need big changes
export const getFinnhubWebSocket = (_apiKey?: string): PriceStreamService => {
  if (!service) {
    service = new PriceStreamService();
  }
  return service;
};

export type { PriceUpdateCallback };
