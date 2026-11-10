import { t, useLanguage } from '@/i18n';
import { usePortfolio } from '@/context/PortfolioContext';
import { StockCard } from './StockCard';
import { RefreshCw } from 'lucide-react';
import { AddPositionDialog } from './AddPositionDialog';


export function StockGrid() {
    useLanguage();
  const { positions, loading, positionsReady, error, fetchPositions, refreshing } = usePortfolio();

  return (
    <div aria-busy={loading || refreshing}>
      <div className="data-toolbar">
        <p role="status">{refreshing ? t("Updating market data…") : t("Prices show the latest received quote; fund NAVs update daily.")}</p>
        <button type="button" className="data-action" onClick={() => void fetchPositions()} disabled={refreshing}>
          <RefreshCw aria-hidden="true" size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? t("Refreshing…") : t("Refresh")}
        </button>
      </div>
      {error && <div role="alert" className="data-panel mb-6">
        <p>{t("Could not refresh your portfolio. ")}{positions.length > 0 ? t("Previously received data remains visible.") : t("Check your connection and try again.")}</p>
        <button type="button" className="data-action" disabled={refreshing} onClick={() => void fetchPositions()}>{t("Try again")}</button>
      </div>}
      {(loading || (!positionsReady && !error)) && positions.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" role="status" aria-label={t("Loading portfolio")}>
          {[0, 1, 2, 3].map(i => <div key={i} className="data-panel h-48 animate-pulse" />)}
          <span className="sr-only">{t("Loading your portfolio…")}</span>
        </div>
      ) : positionsReady && positions.length === 0 ? (
        <div className="data-panel text-center space-y-4">
          <h3 style={{ fontFamily: 'var(--app-font)' }} className="text-xl font-bold">{t("Start your portfolio")}</h3>
          <p>{t("Add your first holding to see its value, performance and market data.")}</p>
          <AddPositionDialog />
        </div>
      ) : null}
    <div className="grid grid-cols-1 desktop-stock-grid gap-gap pb-4">
      {positions.map((stock) => (
        <StockCard key={stock._id} stock={stock} className="w-full" />
      ))}
    </div>
    </div>
  );
}
