import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { BottomTabBar } from './components/BottomTabBar';
import { PullToRefresh } from './components/PullToRefresh';
import { PortfolioHero } from './components/PortfolioHero';
import { StockGrid } from './components/StockGrid';
import { PortfolioProvider, usePortfolio } from './context/PortfolioContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MarketNewsProvider } from './context/MarketNewsContext';
import { LiveAlertsProvider } from './context/LiveAlertsContext';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConnectionStatus } from './components/ConnectionStatus';
import { lazy, Suspense, useState, startTransition, useCallback } from 'react';
import { LayoutGrid, PieChart, Eye, CalendarDays } from 'lucide-react';
import { AddPositionDialog } from './components/AddPositionDialog';

// Lazy load heavy views
const InsightsView = lazy(() => import('./components/InsightsView').then(m => ({ default: m.InsightsView })));
const WatchlistView = lazy(() => import('./components/WatchlistView').then(m => ({ default: m.WatchlistView })));
const MarketCalendar = lazy(() => import('./components/Analytics/MarketCalendar').then(m => ({ default: m.MarketCalendar })));
const PortfolioChart = lazy(() => import('./components/PortfolioChart').then(m => ({ default: m.PortfolioChart })));

function ViewSkeleton() {
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


function Dashboard() {
  const [viewMode, setViewMode] = useState<'holdings' | 'insights' | 'watchlist' | 'calendar'>('holdings');
  const { fetchPositions } = usePortfolio();

  const handleRefresh = useCallback(async () => {
    await fetchPositions();
  }, [fetchPositions]);

  return (
    <ErrorBoundary>
      <ConnectionStatus />
      <div className="flex h-screen w-full overflow-hidden text-slate-800 relative z-0" style={{ background: 'var(--color-ios-bg-gradient)' }}>
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
        <main className="flex-1 h-full overflow-y-auto px-4 md:px-6 md:py-6 space-y-6 md:space-y-6 w-full min-w-0 pt-20 md:pt-6 pb-24 md:pb-6">
          <PullToRefresh onRefresh={handleRefresh}>
            {/* Hero Card */}
            <PortfolioHero />

            {/* Portfolio Content */}
            <section>
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div className="flex items-center justify-between w-full md:w-auto">
                  <h2 className="text-xl md:text-lg font-bold text-slate-800 desktop-section-title">
                    {viewMode === 'holdings' ? 'Portfolio Holdings' : viewMode === 'insights' ? 'Portfolio Insights' : viewMode === 'watchlist' ? 'Watchlist' : 'Market Calendar'}
                  </h2>
                </div>

                <div className="hidden md:flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex p-1 bg-slate-200/50 rounded-xl">
                <button
                  onClick={() => startTransition(() => setViewMode('holdings'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${viewMode === 'holdings'
                    ? 'bg-white text-slate-800 font-semibold shadow-sm'
                    : 'text-slate-500 font-medium hover:text-slate-700 hover:bg-white/50'
                    }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">Holdings</span>
                </button>
                <button
                  onClick={() => startTransition(() => setViewMode('insights'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${viewMode === 'insights'
                    ? 'bg-white text-slate-800 font-semibold shadow-sm'
                    : 'text-slate-500 font-medium hover:text-slate-700 hover:bg-white/50'
                    }`}
                >
                  <PieChart className="w-4 h-4" />
                  <span className="hidden sm:inline">Insights</span>
                </button>
                <button
                  onClick={() => startTransition(() => setViewMode('watchlist'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${viewMode === 'watchlist'
                    ? 'bg-white text-slate-800 font-semibold shadow-sm'
                    : 'text-slate-500 font-medium hover:text-slate-700 hover:bg-white/50'
                    }`}
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">Watchlist</span>
                </button>
                <button
                  onClick={() => startTransition(() => setViewMode('calendar'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${viewMode === 'calendar'
                    ? 'bg-white text-slate-800 font-semibold shadow-sm'
                    : 'text-slate-500 font-medium hover:text-slate-700 hover:bg-white/50'
                    }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  <span className="hidden sm:inline">Calendar</span>
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
            <h2 className="text-xl md:text-lg font-bold mb-4 md:mb-4 text-slate-800 desktop-section-title">Performance History</h2>
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
    </ErrorBoundary>
  );
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-ios-bg-gradient)' }}>
        <div className="text-slate-800 text-xl font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginForm />} 
      />
      <Route 
        path="/register" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterForm />} 
      />
      <Route 
        path="/" 
        element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PortfolioProvider>
          <MarketNewsProvider>
            <LiveAlertsProvider>
              <div className="min-h-screen text-slate-800" style={{ background: 'var(--color-ios-bg-gradient)' }}>
                <AppContent />
              </div>
            </LiveAlertsProvider>
          </MarketNewsProvider>
        </PortfolioProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
