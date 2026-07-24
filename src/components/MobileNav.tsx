import { AddPositionDialog } from './AddPositionDialog';

export function MobileNav() {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] rounded-b-2xl relative z-50">
      <div className="flex items-center gap-2.5">
        <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">FinTechPro</h1>
      </div>
      <div className="flex items-center gap-2">
        <AddPositionDialog />
      </div>
    </div>
  );
}
