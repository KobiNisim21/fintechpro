import { t, useLanguage } from '@/i18n';
﻿import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PortfolioProvider } from './context/PortfolioContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MarketNewsProvider } from './context/MarketNewsContext';
import { LiveAlertsProvider } from './context/LiveAlertsContext';
import { LoginForm } from './components/LoginForm';

const Dashboard = lazy(() => import('./components/Dashboard'));

function AppContent() {
    useLanguage();
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-ios-bg-gradient)' }}>
        <div className="text-slate-800 text-xl font-medium">{t("Loading...")}</div>
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
        path="/"
        element={isAuthenticated ? <Suspense fallback={<div role="status" className="min-h-screen flex items-center justify-center">Loading portfolio…</div>}><Dashboard /></Suspense> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function UserDashboard() {
    useLanguage();
  const { user } = useAuth();
  return (
        <PortfolioProvider key={user?._id || 'signed-out'}>
          <MarketNewsProvider>
            <LiveAlertsProvider>
              <div className="min-h-screen text-slate-800" style={{ background: 'var(--color-ios-bg-gradient)' }}>
                <AppContent />
              </div>
            </LiveAlertsProvider>
          </MarketNewsProvider>
        </PortfolioProvider>
  );
}

export default function App() {
    useLanguage();
  return (
    <BrowserRouter>
      <AuthProvider>
        <UserDashboard />
      </AuthProvider>
    </BrowserRouter>
  );
}
