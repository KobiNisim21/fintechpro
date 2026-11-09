import { LanguageSwitch } from './LanguageSwitch';
import { t, useLanguage } from '@/i18n';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LiveMarketNews } from './LiveMarketNews';
import { LiveAlerts } from './LiveAlerts';
import { McpModal } from './McpModal';

export function SidebarContent() {
    useLanguage();
    const { logout } = useAuth();

    return (
        <div className="sidebar-content flex flex-col h-full w-full">
            <div className="sidebar-scroll flex-1 overflow-y-auto min-h-0">
                {/* Logo/Header */}

                <a href="/" className="sidebar-brand">
                    <img src="/icon.png" alt="" />
                    <div><strong>FinTechPro</strong><p>{t('Wealth Management')}</p></div>
                </a>

                {/* Live Alerts - Real-time from Socket.io */}
                <LiveAlerts />

                {/* Live Market News from Socket.io */}
                <LiveMarketNews />
            </div>
            <div className="sidebar-footer mt-auto px-6 py-6 border-t border-slate-200/50 bg-white/40 backdrop-blur-md shrink-0 space-y-3">
                <LanguageSwitch />
                <McpModal />
                <button
                    onClick={logout}
                    className="flex items-center justify-center gap-3 w-full p-4 rounded-2xl glass-card-solid text-slate-800 font-bold hover-lift transition-all duration-300"
                >
                    <LogOut className="w-5 h-5 text-slate-700" strokeWidth={2.5} />
                    <span className="tracking-wide uppercase text-sm">{t("Log Out")}</span>
                </button>
            </div>
        </div>
    );
}
