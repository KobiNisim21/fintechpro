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

function Dashboard() {
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
      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 w-full min-w-0 pt-20 md:pt-8">
        {/* Hero Card */}
        <PortfolioHero />

        {/* Stock Portfolio Grid */}
        <section>
          <h2 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6 text-white/90">Portfolio Holdings</h2>
          <StockGrid />
        </section>

        {/* Statistics & Analytics */}
        <section>
          <h2 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6 text-white/90">Statistics & Analytics</h2>
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
