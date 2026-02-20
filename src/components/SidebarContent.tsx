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

                <div className="mb-10 text-center">
                    <a href="/" className="inline-flex flex-col items-center group">
                        <div className="relative w-40 h-40 transition-transform duration-500 group-hover:scale-105">
                            <img
                                src="/logo.png"
                                alt="FinTechPro"
                                className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                            />
                        </div>
                        <p className="text-xs font-medium text-emerald-400/60 uppercase tracking-widest -mt-6">
                            Wealth Management
                        </p>
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
