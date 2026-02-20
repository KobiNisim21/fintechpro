import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { SidebarContent } from './SidebarContent';
import { Button } from '@/components/ui/button';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export function MobileNav() {
    return (
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0f0f12]">
            <div className="flex items-center gap-3">
                <a href="/" className="flex items-center gap-3">
                    <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                    <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        FinTechPro
                    </h1>
                </a>
            </div>

            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Open menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 border-r-white/10 bg-[#0f0f12] w-80">
                    <VisuallyHidden>
                        <SheetTitle>Menu</SheetTitle>
                    </VisuallyHidden>
                    <SidebarContent />
                </SheetContent>
            </Sheet>
        </div>
    );
}
