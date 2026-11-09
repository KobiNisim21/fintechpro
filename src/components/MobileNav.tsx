import { LanguageSwitch } from './LanguageSwitch';
import { t, useLanguage } from '@/i18n';
import { AddPositionDialog } from './AddPositionDialog';

export function MobileNav() {
    useLanguage();
  return (
    <div className="mobile-header flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] rounded-b-2xl relative z-50">
      <div className="mobile-header-brand flex items-center gap-2.5">
        <img src="/icon.png" alt={t("Logo")} className="w-7 h-7 object-contain" />
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">FinTechPro</h1>
      </div>
      <div className="mobile-header-actions flex items-center gap-2">
        <LanguageSwitch />
        <AddPositionDialog compact />
      </div>
    </div>
  );
}
