import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LiveMarketNews } from './LiveMarketNews';
import { LiveAlerts } from './LiveAlerts';

export function SidebarContent() {
    const { logout } = useAuth();

    return (
        <div className="flex flex-col h-full w-full">
            <div className="p-6 flex-1 overflow-y-auto min-h-0">
                {/* Logo/Header */}

                <div className="mb-8 text-center">
                    <a href="/" className="inline-flex flex-col items-center gap-3 group">
                        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 p-3 shadow-lg group-hover:shadow-emerald-500/20 transition-all duration-500 border border-white/5 backdrop-blur-sm group-hover:scale-105">
                            <img
                                src="/logo.png"
                                alt="Portfolio Pro"
                                className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                            />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
                                Portfolio Pro
                            </h1>
                            <p className="text-xs font-medium text-emerald-400/60 uppercase tracking-widest mt-1">
                                Wealth Management
                            </p>
                        </div>
                    </a>
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
        </div>
    );
}
