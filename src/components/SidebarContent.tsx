import { LanguageSwitch } from './LanguageSwitch';
import { NotificationSettingsButton } from './PwaNotifications';
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
            <div className="sidebar-footer mt-auto px-6 py-5 border-t border-line bg-surface shrink-0 space-y-3">
                <div className="sidebar-preferences"><LanguageSwitch /><NotificationSettingsButton /></div>
                <McpModal />
                <button
                    onClick={logout}
                    className="sidebar-logout flex items-center justify-center gap-2 w-full min-h-11 py-3 rounded-xl bg-surface border border-line text-ink font-semibold text-caption hover:shadow-button transition-all duration-base"
                >
                    <LogOut className="w-5 h-5 text-slate-700" strokeWidth={2.5} />
                    <span className="text-caption font-semibold">{t("Log Out")}</span>
                </button>
            </div>
        </div>
    );
}
