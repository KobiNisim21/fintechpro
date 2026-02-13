import { SidebarContent } from './SidebarContent';

export function Sidebar() {
  return (
    <aside className="w-80 h-full border-r border-white/10 backdrop-blur-xl bg-gradient-to-b from-[#1a1a1f] to-[#0f0f12] flex flex-col shrink-0 overflow-hidden">
      <SidebarContent />
    </aside>
  );
}
