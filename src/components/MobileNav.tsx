import { LanguageSwitch } from './LanguageSwitch';
import { t, useLanguage } from '@/i18n';
import { AddPositionDialog } from './AddPositionDialog';
import { NotificationSettingsButton } from './PwaNotifications';

export function MobileNav() {
    useLanguage();
  return (
    <div className="mobile-header flex items-center justify-between px-4 py-3 bg-surface/95 backdrop-blur-md border-b border-line relative z-50">
      <div className="mobile-header-brand flex items-center gap-2.5">
        <img src="/icon.png" alt={t("Logo")} className="w-7 h-7 object-contain" />
        <h1 className="text-subhead font-semibold text-ink tracking-tight">FinTechPro</h1>
      </div>
      <div className="mobile-header-actions flex items-center gap-2">
        <LanguageSwitch />
        <NotificationSettingsButton />
        <AddPositionDialog compact />
      </div>
    </div>
  );
}
