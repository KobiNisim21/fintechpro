import { getSocket } from './socket';
import { PriceStreamService } from './priceStream';

let service: PriceStreamService | null = null;
export const getFinnhubWebSocket = (_apiKey?: string): PriceStreamService => {
  service ??= new PriceStreamService(getSocket);
  return service;
};
export type { PriceUpdateCallback } from './priceStream';
