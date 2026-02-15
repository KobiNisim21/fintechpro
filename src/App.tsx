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

import { useState } from 'react';
import { LayoutGrid, PieChart } from 'lucide-react';
import { AddPositionDialog } from './components/AddPositionDialog';
import { InsightsView } from './components/InsightsView';

function Dashboard() {
  const [viewMode, setViewMode] = useState<'holdings' | 'insights'>('holdings');

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0f0f12]">
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
            <h2 className="text-xl md:text-2xl font-semibold text-white/90">
              {viewMode === 'holdings' ? 'Portfolio Holdings' : 'Portfolio Insights'}
              <span className="text-xs text-red-500 ml-2">(v2)</span>
            </h2>

            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex p-1 bg-white/5 backdrop-blur-md rounded-lg border border-white/10">
                <button
                  onClick={() => setViewMode('holdings')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'holdings'
                    ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Holdings
                </button>
                <button
                  onClick={() => setViewMode('insights')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'insights'
                    ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <PieChart className="w-4 h-4" />
                  Insights
                </button>
              </div>

              <AddPositionDialog />
            </div>
          </div>

          {viewMode === 'holdings' ? (
            <StockGrid />
          ) : (
            <InsightsView />
          )}
        </section>

        {/* Statistics & Analytics (Always visible or maybe hide in insights mode?) */}
        {/* Keeping it visible as it provides total value history which is distinct from allocation */}
        <section>
          <h2 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6 text-white/90">Performance History</h2>
          <PortfolioChart />
        </section>
      </main>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const currentPath = window.location.pathname;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f12] flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
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
            <div className="min-h-screen bg-[#0f0f12] text-white font-sans">
              <AppContent />
            </div>
          </LiveAlertsProvider>
        </MarketNewsProvider>
      </PortfolioProvider>
    </AuthProvider>
  );
}
