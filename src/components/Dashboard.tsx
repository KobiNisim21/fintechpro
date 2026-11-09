import { t, useLanguage } from '@/i18n';
﻿import { lazy, Suspense, useState, startTransition, useCallback } from 'react';
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

const InsightsView = lazy(() => import('./InsightsView').then(m => ({ default: m.InsightsView })));
const WatchlistView = lazy(() => import('./WatchlistView').then(m => ({ default: m.WatchlistView })));
const MarketCalendar = lazy(() => import('./Analytics/MarketCalendar').then(m => ({ default: m.MarketCalendar })));
const PortfolioChart = lazy(() => import('./PortfolioChart').then(m => ({ default: m.PortfolioChart })));

function ViewSkeleton() {
    useLanguage();
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200/50 rounded-xl w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-40 bg-slate-200/30 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}


export default function Dashboard() {
    useLanguage();
  const [viewMode, setViewMode] = useState<'holdings' | 'insights' | 'watchlist' | 'calendar'>('holdings');
  const { fetchPositions } = usePortfolio();

  const handleRefresh = useCallback(async () => {
    await fetchPositions();
  }, [fetchPositions]);

  return (
    <ErrorBoundary>
    <MotionConfig reducedMotion="user">
      <ConnectionStatus />
      <a className="skip-to-content" href="#main-content">{t("Skip to content")}</a>
      <div className="dashboard-shell flex h-screen w-full overflow-hidden text-slate-800 relative z-0" style={{ background: 'var(--color-ios-bg-gradient)' }}>
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
        <main id="main-content" tabIndex={-1} className="flex-1 h-full overflow-y-auto px-4 md:px-6 md:py-6 space-y-6 md:space-y-6 w-full min-w-0 pt-20 md:pt-6 pb-24 md:pb-6">
          <PullToRefresh onRefresh={handleRefresh}>
            {/* Hero Card */}
            <PortfolioHero />
            <PortfolioTools />

            {/* Portfolio Content */}
            <section>
              <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-4">
                <div className="flex items-center justify-between w-full md:w-auto">
                  <h2 className="text-xl md:text-lg font-bold text-slate-800 desktop-section-title">
                    {viewMode === 'holdings' ? t("Portfolio Holdings") : viewMode === 'insights' ? t("Portfolio Insights") : viewMode === 'watchlist' ? t("Watchlist") : t("Market Calendar")}
                  </h2>
                </div>

                <div className="hidden md:flex flex-wrap items-center gap-3 min-w-0">
              {/* View Toggle */}
              <div className="desktop-view-switch flex flex-wrap p-1 bg-slate-200/50 rounded-xl" role="group" aria-label={t("Portfolio views")}>
                <button
                  aria-pressed={viewMode === 'holdings'}
                  onClick={() => startTransition(() => setViewMode('holdings'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${viewMode === 'holdings'
                    ? 'bg-white text-slate-800 font-semibold shadow-sm'
                    : 'text-slate-500 font-medium hover:text-slate-700 hover:bg-white/50'
                    }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("Holdings")}</span>
                </button>
                <button
                  aria-pressed={viewMode === 'insights'}
                  onClick={() => startTransition(() => setViewMode('insights'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${viewMode === 'insights'
                    ? 'bg-white text-slate-800 font-semibold shadow-sm'
                    : 'text-slate-500 font-medium hover:text-slate-700 hover:bg-white/50'
                    }`}
                >
                  <PieChart className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("Insights")}</span>
                </button>
                <button
                  aria-pressed={viewMode === 'watchlist'}
                  onClick={() => startTransition(() => setViewMode('watchlist'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${viewMode === 'watchlist'
                    ? 'bg-white text-slate-800 font-semibold shadow-sm'
                    : 'text-slate-500 font-medium hover:text-slate-700 hover:bg-white/50'
                    }`}
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("Watchlist")}</span>
                </button>
                <button
                  aria-pressed={viewMode === 'calendar'}
                  onClick={() => startTransition(() => setViewMode('calendar'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${viewMode === 'calendar'
                    ? 'bg-white text-slate-800 font-semibold shadow-sm'
                    : 'text-slate-500 font-medium hover:text-slate-700 hover:bg-white/50'
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
              <WatchlistView />
            </Suspense>
          ) : (
            <Suspense fallback={<ViewSkeleton />}>
              <MarketCalendar />
            </Suspense>
          )}
        </section>

        {/* Statistics & Analytics */}
        <section>
            <h2 className="text-xl md:text-lg font-bold mb-4 md:mb-4 text-slate-800 desktop-section-title">{t("Performance History")}</h2>
            <Suspense fallback={<ViewSkeleton />}>
              <PortfolioChart />
            </Suspense>
          </section>
          </PullToRefresh>
        </main>
      </div>

      {/* Bottom Tab Bar - mobile only */}
      <BottomTabBar viewMode={viewMode} onViewChange={(mode) => startTransition(() => setViewMode(mode))} />
    </div>
    </MotionConfig>
    </ErrorBoundary>
  );
}


