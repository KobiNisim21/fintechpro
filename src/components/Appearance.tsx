import { useEffect, type ReactNode } from 'react';
import { ThemeProvider, useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { t, useLanguage } from '@/i18n';

function ThemeColor() {
    const { resolvedTheme } = useTheme();
    useEffect(() => {
        const meta = document.querySelector('meta[name="theme-color"]');
        const previous = meta?.getAttribute('content');
        meta?.setAttribute('content', resolvedTheme === 'dark' ? '#11131b' : '#f5f5f7');
        return () => { if (previous) meta?.setAttribute('content', previous); };
    }, [resolvedTheme]);
    return null;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
    return <ThemeProvider attribute="data-theme" storageKey="fintechpro.theme.v1" defaultTheme="system" enableSystem disableTransitionOnChange>
        <ThemeColor />
        {children}
    </ThemeProvider>;
}

export function AppearanceSwitch() {
    useLanguage();
    const { resolvedTheme, setTheme } = useTheme();
    const dark = resolvedTheme === 'dark';
    const label = t(dark ? 'Switch to light mode' : 'Switch to dark mode');
    const Icon = dark ? Sun : Moon;
    return <button type="button" className="data-action appearance-switch" aria-label={label} title={label}
        aria-pressed={dark} onClick={() => setTheme(dark ? 'light' : 'dark')}>
        <Icon size={20} aria-hidden="true" />
    </button>;
}
