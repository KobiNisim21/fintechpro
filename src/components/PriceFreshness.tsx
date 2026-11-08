import type { PriceStatus } from '../lib/priceDetails';

export function PriceFreshness({ source, updatedAt, status }: {
  source?: string;
  updatedAt?: string;
  status?: PriceStatus;
}) {
  const label = status === 'estimated' ? 'Estimated from purchase cost'
    : status === 'stale' ? 'Previous quote · refresh pending'
    : status === 'cached' ? 'Cached quote' : 'Latest received quote';
  const date = updatedAt ? new Date(updatedAt) : null;
  const validDate = date && Number.isFinite(date.getTime());
  return (
    <div className="price-freshness" title={label}>
      <span>{label}</span>
      <span className="price-freshness-details">
        {source || 'Source unavailable'}
        {validDate ? <> · <time dateTime={date.toISOString()}>{date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></> : ' · Update time unavailable'}
      </span>
    </div>
  );
}
