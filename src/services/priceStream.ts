import type { Socket } from 'socket.io-client';

export type PriceUpdateCallback = (symbol: string, price: number, timestamp: number) => void;

export class PriceStreamService {
  private subscribers: Set<PriceUpdateCallback> = new Set();
  private subscribedSymbols: Set<string> = new Set();
  private socket: Socket | null = null;
  private handleConnect = () => {
    if (this.subscribedSymbols.size > 0) {
      this.socket?.emit('subscribe-prices', { symbols: Array.from(this.subscribedSymbols) });
    }
  };
  private handlePrice = (data: { symbol: string; price: number; timestamp: number }) => {
    if (!Number.isFinite(data.price) || data.price <= 0 || !Number.isFinite(data.timestamp)) return;
    this.subscribers.forEach(callback => callback(data.symbol, data.price, data.timestamp));
  };

  private readonly getSocket: () => Socket | null;
  constructor(getSocket: () => Socket | null) { this.getSocket = getSocket; }

  connect(): void {
    const socket = this.getSocket();
    if (!socket || socket === this.socket) return;
    this.detach();
    this.socket = socket;
    socket.on('price-update', this.handlePrice);
    socket.on('connect', this.handleConnect);
    if (socket.connected) this.handleConnect();
  }

  subscribeToSymbol(symbol: string): void {
    if (this.subscribedSymbols.has(symbol)) return;
    this.subscribedSymbols.add(symbol);

    const socket = this.getSocket();
    if (socket?.connected) {
      socket.emit('subscribe-prices', { symbols: [symbol] });
    }
  }

  unsubscribeFromSymbol(symbol: string): void {
    this.subscribedSymbols.delete(symbol);
    const socket = this.getSocket();
    if (socket?.connected) {
      socket.emit('unsubscribe-prices', { symbols: [symbol] });
    }
  }

  onPriceUpdate(callback: PriceUpdateCallback): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  disconnect(): void {
    const socket = this.socket;
    if (socket) {
      if (this.subscribedSymbols.size > 0) {
        socket.emit('unsubscribe-prices', { symbols: Array.from(this.subscribedSymbols) });
      }
    }
    this.subscribers.clear();
    this.subscribedSymbols.clear();
    this.detach();
  }

  private detach(): void {
    this.socket?.off('price-update', this.handlePrice);
    this.socket?.off('connect', this.handleConnect);
    this.socket = null;
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }
}


