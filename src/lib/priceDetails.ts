export type PriceStatus = 'available' | 'cached' | 'stale' | 'estimated';

export interface PriceDetails {
  price: number;
  priceSource: string;
  priceUpdatedAt?: string;
  priceStatus: PriceStatus;
}

interface QuoteDetails {
  regularMarketPrice?: number;
  regularMarketTime?: string | number;
  source?: string;
  fromCache?: boolean;
  stale?: boolean;
}

export function resolvePriceDetails(
  quote: QuoteDetails | undefined,
  previous: Partial<PriceDetails> | undefined,
  averagePrice: number,
): PriceDetails {
  const price = quote?.regularMarketPrice;
  if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
    const rawTime = quote?.regularMarketTime;
    const time = rawTime == null ? undefined : new Date(typeof rawTime === 'number' ? rawTime * 1000 : rawTime);
    return {
      price,
      priceSource: quote?.source || 'Market data',
      priceUpdatedAt: time && Number.isFinite(time.getTime()) ? time.toISOString() : undefined,
      priceStatus: quote?.stale ? 'stale' : quote?.fromCache ? 'cached' : 'available',
    };
  }
  if (previous?.price && previous.price > 0 && previous.priceStatus !== 'estimated') {
    return {
      price: previous.price,
      priceSource: previous.priceSource || 'Previous quote',
      priceUpdatedAt: previous.priceUpdatedAt,
      priceStatus: 'stale',
    };
  }
  return { price: averagePrice, priceSource: 'Purchase cost', priceStatus: 'estimated' };
}
