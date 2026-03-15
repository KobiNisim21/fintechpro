import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { SidebarContent } from './SidebarContent';
import { Button } from '@/components/ui/button';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export function MobileNav() {
    return (
        <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-xl shadow-clayDeep rounded-b-[32px] border-none x-4 relative z-50">
            <div className="flex items-center gap-3">
                <a href="/" className="flex items-center gap-3">
                    <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain drop-shadow-md" />
                    <h1 className="text-xl font-black font-display text-[var(--color-clay-fg)] tracking-tight">
                        FinTechPro
                    </h1>
                </a>
            </div>

            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-12 h-12 rounded-[20px] bg-[var(--color-clay-input-bg)] shadow-clayInset text-[var(--color-clay-fg)] hover:bg-white hover:shadow-clayOrb active:scale-[0.92] transition-all">
                        <Menu className="h-6 w-6" strokeWidth={2.5} />
                        <span className="sr-only">Open menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 border-none bg-[var(--color-clay-canvas)] w-80 shadow-clayDeep">
                    <VisuallyHidden>
                        <SheetTitle>Menu</SheetTitle>
                    </VisuallyHidden>
                    <SidebarContent />
                </SheetContent>
            </Sheet>
        </div>
    );
}
