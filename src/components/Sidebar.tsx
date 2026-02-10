import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LiveMarketNews } from './LiveMarketNews';
import { LiveAlerts } from './LiveAlerts';

export function Sidebar() {
  const { logout } = useAuth();
  return (
    <aside className="w-80 h-full border-r border-white/10 backdrop-blur-xl bg-gradient-to-b from-[#1a1a1f] to-[#0f0f12] flex flex-col shrink-0 overflow-hidden">
      <div className="p-6 flex-1 overflow-y-auto min-h-0">
        {/* Logo/Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Portfolio Pro
          </h1>
          <p className="text-sm text-white/50 mt-1">Real-time Portfolio Insights</p>
        </div>

        {/* Live Alerts - Real-time from Socket.io */}
        <LiveAlerts />

        {/* Live Market News from Socket.io */}
        <LiveMarketNews />
      </div>
      <div className="mt-auto px-6 py-4 border-t border-white/10 bg-[#0f0f12]/50 backdrop-blur-md shrink-0">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full p-3 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Log Out</span>
        </button>
      </div>
    </aside>
  );
}
