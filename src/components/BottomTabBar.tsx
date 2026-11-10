import { t, useLanguage } from '@/i18n';
import { LayoutGrid, PieChart, Eye, CalendarDays, MoreHorizontal } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { SidebarContent } from './SidebarContent';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

type ViewMode = 'holdings' | 'insights' | 'watchlist' | 'calendar';

interface BottomTabBarProps {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  alertCount?: number;
}

export function BottomTabBar({ viewMode, onViewChange, alertCount = 0 }: BottomTabBarProps) {
    const language = useLanguage();
  const tabs = [
    { id: 'holdings', label: 'Holdings', icon: LayoutGrid },
    { id: 'insights', label: 'Insights', icon: PieChart },
    { id: 'watchlist', label: 'Watchlist', icon: Eye },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  ] as const;

  return (
    <nav aria-label={t("Main navigation")} className="portfolio-tab-bar md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-md border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const isActive = viewMode === tab.id;
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onViewChange(tab.id as ViewMode)}
              className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors duration-fast ${
                isActive ? 'text-accent' : 'text-secondary'
              }`}
            >
              <div
                className={`p-1.5 rounded-full transition-colors ${
                  isActive ? 'bg-accent-soft' : 'bg-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              </div>
              <span className={`text-caption ${isActive ? 'font-bold' : 'font-medium'}`}>
                {t(tab.label)}
              </span>
            </button>
          );
        })}

        <Sheet>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center w-16 h-full gap-1 text-secondary transition-colors duration-fast relative">
              <div className="p-1.5 rounded-full bg-transparent">
                <MoreHorizontal className="w-5 h-5 stroke-2" />
              </div>
              <span className="text-caption font-medium">{t("More")}</span>
              {alertCount > 0 && (
                <div className="absolute top-2 end-3 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          </SheetTrigger>
          <SheetContent side={language === "he" ? "left" : "right"} aria-describedby={undefined} className="design-menu-sheet p-0 border-none bg-surface w-80 shadow-modal">
            <VisuallyHidden>
              <SheetTitle>{t("Menu")}</SheetTitle>
            </VisuallyHidden>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
