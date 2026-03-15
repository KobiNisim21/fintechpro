import { SidebarContent } from './SidebarContent';

export function Sidebar() {
  return (
    <aside className="w-80 h-full border-r border-white/40 backdrop-blur-[40px] bg-white/40 flex flex-col shrink-0 overflow-hidden shadow-[20px_0_40px_rgba(160,150,180,0.1)] z-20">
      <SidebarContent />
    </aside>
  );
}
