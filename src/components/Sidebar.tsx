import { SidebarContent } from './SidebarContent';

export function Sidebar() {
  return (
    <aside className="design-sidebar w-[280px] desktop-sidebar h-full bg-surface border-line shadow-sidebar flex flex-col shrink-0 overflow-hidden z-20">
      <SidebarContent />
    </aside>
  );
}
