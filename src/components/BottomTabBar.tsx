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
  const tabs = [
    { id: 'holdings', label: 'Holdings', icon: LayoutGrid },
    { id: 'insights', label: 'Insights', icon: PieChart },
    { id: 'watchlist', label: 'Watchlist', icon: Eye },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  ] as const;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-200/50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const isActive = viewMode === tab.id;
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id as ViewMode)}
              className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-all active:scale-[0.92] ${
                isActive ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              <div
                className={`p-1.5 rounded-full transition-colors ${
                  isActive ? 'bg-gradient-to-br from-slate-100 to-slate-200 shadow-sm' : 'bg-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              </div>
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}

        <Sheet>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center w-16 h-full gap-1 text-slate-500 transition-all active:scale-[0.92] relative">
              <div className="p-1.5 rounded-full bg-transparent">
                <MoreHorizontal className="w-5 h-5 stroke-2" />
              </div>
              <span className="text-[10px] font-medium">More</span>
              {alertCount > 0 && (
                <div className="absolute top-2 right-3 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 border-none bg-[var(--color-ios-bg)] w-80 shadow-[var(--shadow-ios-card)]">
            <VisuallyHidden>
              <SheetTitle>Menu</SheetTitle>
            </VisuallyHidden>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
