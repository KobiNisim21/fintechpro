import { t, useLanguage } from '@/i18n';
﻿import { lazy, Suspense, useState, startTransition, useCallback, useRef } from 'react';
import type { WatchlistHandle } from './WatchlistView';
import { LayoutGrid, PieChart, Eye, CalendarDays } from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { BottomTabBar } from './BottomTabBar';
import { PullToRefresh } from './PullToRefresh';
import { PortfolioHero } from './PortfolioHero';
import { StockGrid } from './StockGrid';
import { usePortfolio } from '../context/PortfolioContext';
import { ErrorBoundary } from './ErrorBoundary';
import { ConnectionStatus } from './ConnectionStatus';
import { AddPositionDialog } from './AddPositionDialog';
import PortfolioTools from './PortfolioTools';
import { PwaNotifications } from './PwaNotifications';

const InsightsView = lazy(() => import('./InsightsView').then(m => ({ default: m.InsightsView })));
const WatchlistView = lazy(() => import('./WatchlistView').then(m => ({ default: m.WatchlistView })));
const MarketCalendar = lazy(() => import('./Analytics/MarketCalendar').then(m => ({ default: m.MarketCalendar })));
const PortfolioChart = lazy(() => import('./PortfolioChart').then(m => ({ default: m.PortfolioChart })));

function ViewSkeleton() {
    useLanguage();
  return (
    <div className="space-y-5 motion-safe:animate-pulse">
      <div className="h-8 bg-canvas rounded-lg w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gap">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-40 bg-surface rounded-xl shadow-card p-card border border-line/50" />
        ))}
      </div>
    </div>
  );
}


export default function Dashboard() {
    useLanguage();
  const [viewMode, setViewMode] = useState<'holdings' | 'insights' | 'watchlist' | 'calendar'>('holdings');
  const { fetchPositions } = usePortfolio();
  const watchlistRef = useRef<WatchlistHandle>(null);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchPositions(), watchlistRef.current?.refresh()]);
  }, [fetchPositions]);

  return (
    <ErrorBoundary>
    <MotionConfig reducedMotion="user">
      <PwaNotifications>
      <ConnectionStatus />
      <a className="skip-to-content" href="#main-content">{t("Skip to content")}</a>
      <div className="dashboard-shell flex h-screen w-full bg-canvas overflow-hidden font-sans text-ink relative z-0">
      {/* Main UI Container */}
      <div className="flex h-full w-full relative z-10">
        {/* Mobile Navigation - Fixed at top for mobile only */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50">
        <MobileNav />
      </div>

      {/* Fixed Sidebar - Hidden on mobile, Flex on desktop */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar />
      </div>

        {/* Main Content */}
        <main id="main-content" tabIndex={-1} className="flex-1 h-full overflow-y-auto px-6 md:py-6 space-y-6 bg-canvas w-full min-w-0 pt-20 md:pt-6 pb-24 md:pb-6">
          <PullToRefresh onRefresh={handleRefresh}>
            <div className="w-full max-w-[1400px] mx-auto space-y-6">
            {/* Hero Card */}
            <PortfolioHero />
            <PortfolioTools />

            {/* Portfolio Content */}
            <section>
              <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-5">
                <div className="flex items-center justify-between w-full md:w-auto">
                  <h2 className="text-heading text-ink font-semibold">
                    {viewMode === 'holdings' ? t("Portfolio Holdings") : viewMode === 'insights' ? t("Portfolio Insights") : viewMode === 'watchlist' ? t("Watchlist") : t("Market Calendar")}
                  </h2>
                </div>

                <div className="hidden md:flex flex-wrap items-center gap-3 min-w-0">
              {/* View Toggle */}
              <div className="flex flex-wrap bg-canvas rounded-xl p-1 border border-line/50" role="group" aria-label={t("Portfolio views")}>
                <button
                  aria-pressed={viewMode === 'holdings'}
                  onClick={() => startTransition(() => setViewMode('holdings'))}
                  className={`flex items-center gap-2 min-h-11 min-w-11 px-4 py-2 rounded-lg text-caption transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${viewMode === 'holdings'
                    ? 'bg-surface shadow-badge text-ink font-semibold'
                    : 'text-secondary font-medium hover:text-ink hover:bg-surface-alt'
                    }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("Holdings")}</span>
                </button>
                <button
                  aria-pressed={viewMode === 'insights'}
                  onClick={() => startTransition(() => setViewMode('insights'))}
                  className={`flex items-center gap-2 min-h-11 min-w-11 px-4 py-2 rounded-lg text-caption transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${viewMode === 'insights'
                    ? 'bg-surface shadow-badge text-ink font-semibold'
                    : 'text-secondary font-medium hover:text-ink hover:bg-surface-alt'
                    }`}
                >
                  <PieChart className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("Insights")}</span>
                </button>
                <button
                  aria-pressed={viewMode === 'watchlist'}
                  onClick={() => startTransition(() => setViewMode('watchlist'))}
                  className={`flex items-center gap-2 min-h-11 min-w-11 px-4 py-2 rounded-lg text-caption transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${viewMode === 'watchlist'
                    ? 'bg-surface shadow-badge text-ink font-semibold'
                    : 'text-secondary font-medium hover:text-ink hover:bg-surface-alt'
                    }`}
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("Watchlist")}</span>
                </button>
                <button
                  aria-pressed={viewMode === 'calendar'}
                  onClick={() => startTransition(() => setViewMode('calendar'))}
                  className={`flex items-center gap-2 min-h-11 min-w-11 px-4 py-2 rounded-lg text-caption transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${viewMode === 'calendar'
                    ? 'bg-surface shadow-badge text-ink font-semibold'
                    : 'text-secondary font-medium hover:text-ink hover:bg-surface-alt'
                    }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("Calendar")}</span>
                </button>
              </div>

              {/* Desktop Add Button */}
              <AddPositionDialog />
            </div>
          </div>

          {viewMode === 'holdings' ? (
            <StockGrid />
          ) : viewMode === 'insights' ? (
            <Suspense fallback={<ViewSkeleton />}>
              <InsightsView />
            </Suspense>
          ) : viewMode === 'watchlist' ? (
            <Suspense fallback={<ViewSkeleton />}>
              <WatchlistView ref={watchlistRef} />
            </Suspense>
          ) : (
            <Suspense fallback={<ViewSkeleton />}>
              <MarketCalendar />
            </Suspense>
          )}
        </section>

        {/* Statistics & Analytics */}
        {viewMode === 'holdings' && <section>
            <h2 className="text-heading text-ink font-semibold mb-4">{t("Performance History")}</h2>
            <Suspense fallback={<ViewSkeleton />}>
              <PortfolioChart />
            </Suspense>
          </section>}
            </div>
          </PullToRefresh>
        </main>
      </div>

      {/* Bottom Tab Bar - mobile only */}
      <BottomTabBar viewMode={viewMode} onViewChange={(mode) => startTransition(() => setViewMode(mode))} />
    </div>
      </PwaNotifications>
    </MotionConfig>
    </ErrorBoundary>
  );
}


