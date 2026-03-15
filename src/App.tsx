import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { PortfolioHero } from './components/PortfolioHero';
import { StockGrid } from './components/StockGrid';
import { PortfolioChart } from './components/PortfolioChart';
import { PortfolioProvider } from './context/PortfolioContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MarketNewsProvider } from './context/MarketNewsContext';
import { LiveAlertsProvider } from './context/LiveAlertsContext';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';

import { useState, startTransition } from 'react';
import { LayoutGrid, PieChart, Eye, CalendarDays } from 'lucide-react';
import { AddPositionDialog } from './components/AddPositionDialog';
import { InsightsView } from './components/InsightsView';
import { WatchlistView } from './components/WatchlistView';
import { MarketCalendar } from './components/Analytics/MarketCalendar';

function Dashboard() {
  const [viewMode, setViewMode] = useState<'holdings' | 'insights' | 'watchlist' | 'calendar'>('holdings');

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--color-clay-canvas)] text-[var(--color-clay-fg)] relative z-0">
      {/* Background Blobs Layer */}
      <div className="clay-blob-bg">
        <div className="absolute h-[60vh] w-[60vh] rounded-full blur-3xl bg-violet-400/10 -top-[10%] -left-[10%] animate-clay-float" />
        <div className="absolute h-[60vh] w-[60vh] rounded-full blur-3xl bg-pink-400/10 -top-[10%] -right-[10%] animate-clay-float-delayed animation-delay-2000" />
        <div className="absolute h-[50vh] w-[50vh] rounded-full blur-3xl bg-sky-400/10 top-[30%] -left-[5%] animate-clay-float-slow animation-delay-4000" />
      </div>

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
        <main className="flex-1 h-full overflow-y-auto px-4 pb-4 md:p-8 space-y-6 md:space-y-8 w-full min-w-0 pt-28 md:pt-8 pb-32">
          {/* Hero Card */}
        <PortfolioHero />

        {/* Portfolio Content */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div className="flex items-center justify-between w-full md:w-auto">
              <h2 className="text-xl md:text-2xl font-black font-display text-[var(--color-clay-fg)]">
                {viewMode === 'holdings' ? 'Portfolio Holdings' : viewMode === 'insights' ? 'Portfolio Insights' : viewMode === 'watchlist' ? 'Watchlist' : 'Market Calendar'}
              </h2>
              {/* Mobile Add Button - Visible only on mobile */}
              <div className="md:hidden">
                <AddPositionDialog />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex p-1 bg-[var(--color-clay-input-bg)] shadow-clayInset rounded-[16px]">
                <button
                  onClick={() => startTransition(() => setViewMode('holdings'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-[12px] text-sm transition-all ${viewMode === 'holdings'
                    ? 'bg-violet-100 text-violet-700 font-black shadow-sm ring-1 ring-violet-200'
                    : 'text-[var(--color-clay-muted)] font-bold hover:text-[var(--color-clay-fg)] hover:bg-white/50'
                    }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">Holdings</span>
                </button>
                <button
                  onClick={() => startTransition(() => setViewMode('insights'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-[12px] text-sm transition-all ${viewMode === 'insights'
                    ? 'bg-violet-100 text-violet-700 font-black shadow-sm ring-1 ring-violet-200'
                    : 'text-[var(--color-clay-muted)] font-bold hover:text-[var(--color-clay-fg)] hover:bg-white/50'
                    }`}
                >
                  <PieChart className="w-4 h-4" />
                  <span className="hidden sm:inline">Insights</span>
                </button>
                <button
                  onClick={() => startTransition(() => setViewMode('watchlist'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-[12px] text-sm transition-all ${viewMode === 'watchlist'
                    ? 'bg-violet-100 text-violet-700 font-black shadow-sm ring-1 ring-violet-200'
                    : 'text-[var(--color-clay-muted)] font-bold hover:text-[var(--color-clay-fg)] hover:bg-white/50'
                    }`}
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">Watchlist</span>
                </button>
                <button
                  onClick={() => startTransition(() => setViewMode('calendar'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-[12px] text-sm transition-all ${viewMode === 'calendar'
                    ? 'bg-violet-100 text-violet-700 font-black shadow-sm ring-1 ring-violet-200'
                    : 'text-[var(--color-clay-muted)] font-bold hover:text-[var(--color-clay-fg)] hover:bg-white/50'
                    }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  <span className="hidden sm:inline">Calendar</span>
                </button>
              </div>

              {/* Desktop Add Button - Hidden on mobile */}
              <div className="hidden md:block">
                <AddPositionDialog />
              </div>
            </div>
          </div>

          {viewMode === 'holdings' ? (
            <StockGrid />
          ) : viewMode === 'insights' ? (
            <InsightsView />
          ) : viewMode === 'watchlist' ? (
            <WatchlistView />
          ) : (
            <MarketCalendar />
          )}
        </section>

        {/* Statistics & Analytics (Always visible or maybe hide in insights mode?) */}
        {/* Keeping it visible as it provides total value history which is distinct from allocation */}
        <section>
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[var(--color-clay-fg)] font-display">Performance History</h2>
            <PortfolioChart />
          </section>
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const currentPath = window.location.pathname;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-clay-canvas)] flex items-center justify-center">
        <div className="text-[var(--color-clay-fg)] text-xl font-display font-medium">Loading...</div>
      </div>
    );
  }

  // Route handling
  if (!isAuthenticated) {
    if (currentPath === '/register') {
      return <RegisterForm />;
    }
    return <LoginForm />;
  }

  // Redirect to dashboard if on login/register page but authenticated
  if (currentPath === '/login' || currentPath === '/register') {
    window.history.replaceState(null, '', '/');
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <PortfolioProvider>
        <MarketNewsProvider>
          <LiveAlertsProvider>
            <div className="min-h-screen bg-[var(--color-clay-canvas)] text-[var(--color-clay-fg)] font-body">
              <AppContent />
            </div>
          </LiveAlertsProvider>
        </MarketNewsProvider>
      </PortfolioProvider>
    </AuthProvider>
  );
}
