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
                        <div className="relative w-40 h-40 transition-transform duration-500 group-hover:scale-110">
                            {/* Soft dark blur localized only behind the text area (bottom 30%) */}
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-28 h-8 bg-slate-500/30 blur-[10px] rounded-[100%]" />
                            <img
                                src="/logo.png"
                                alt="FinTechPro"
                                className="relative w-full h-full object-contain"
                            />
                        </div>
                        <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-[0.2em] -mt-6">
                            Wealth Management
                        </p>
                    </a>
                </div>

                {/* Live Alerts - Real-time from Socket.io */}
                <LiveAlerts />

                {/* Live Market News from Socket.io */}
                <LiveMarketNews />
            </div>
            <div className="mt-auto px-6 py-6 border-t border-slate-200/50 bg-white/40 backdrop-blur-md shrink-0">
                <button
                    onClick={logout}
                    className="flex items-center justify-center gap-3 w-full p-4 rounded-2xl glass-card-solid text-slate-800 font-bold hover-lift transition-all duration-300"
                >
                    <LogOut className="w-5 h-5 text-slate-700" strokeWidth={2.5} />
                    <span className="tracking-wide uppercase text-sm">Log Out</span>
                </button>
            </div>
        </div>
    );
}
