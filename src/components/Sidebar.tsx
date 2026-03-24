import { SidebarContent } from './SidebarContent';

export function Sidebar() {
  return (
    <aside className="w-80 h-full border-r border-slate-200/50 backdrop-blur-xl bg-white/50 flex flex-col shrink-0 overflow-hidden z-20" style={{ boxShadow: 'var(--shadow-ios-card)' }}>
      <SidebarContent />
    </aside>
  );
}
