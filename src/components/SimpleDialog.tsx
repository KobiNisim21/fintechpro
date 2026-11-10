import { t, useLanguage } from '@/i18n';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { LanguageSwitch } from './LanguageSwitch';

interface SimpleDialogProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    title?: string;
    wide?: boolean;
}

export function SimpleDialog({ open, onClose, children, title = 'Manage holding', wide = false }: SimpleDialogProps) {
    useLanguage();
    const openerRef = useRef<HTMLElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    useLayoutEffect(() => {
        if (!open) return;
        const viewport = window.visualViewport;
        let frame = 0;
        const update = () => {
            const element = viewportRef.current;
            if (!element) return;
            element.style.setProperty('--dialog-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
            element.style.setProperty('--dialog-viewport-top', `${viewport?.offsetTop ?? 0}px`);
            element.style.setProperty('--dialog-viewport-left', `${viewport?.offsetLeft ?? 0}px`);
            element.style.setProperty('--dialog-viewport-width', `${viewport?.width ?? window.innerWidth}px`);
            const body = element.querySelector<HTMLElement>('.holding-dialog-body');
            const focused = document.activeElement;
            if (body && focused instanceof HTMLElement && body.contains(focused)) {
                const field = focused.getBoundingClientRect(), bounds = body.getBoundingClientRect();
                if (field.bottom > bounds.bottom) body.scrollTop += field.bottom - bounds.bottom + 12;
                else if (field.top < bounds.top) body.scrollTop -= bounds.top - field.top + 12;
            }
        };
        const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
        update();
        // Radix may mount the portal after the parent layout effect.
        schedule();
        viewport?.addEventListener('resize', schedule);
        viewport?.addEventListener('scroll', schedule);
        window.addEventListener('resize', schedule);
        return () => { cancelAnimationFrame(frame); viewport?.removeEventListener('resize', schedule); viewport?.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
    }, [open]);
    return (
        <Dialog.Root open={open} onOpenChange={value => { if (!value) onClose(); }}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[10000] bg-black/20 backdrop-blur-sm" />
                <div ref={viewportRef} className="holding-dialog-viewport">
                <Dialog.Content
                    aria-describedby={undefined}
                    onOpenAutoFocus={() => {
                        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                    }}
                    onCloseAutoFocus={event => {
                        event.preventDefault();
                        if (openerRef.current?.isConnected) openerRef.current.focus({ preventScroll: true });
                    }}
                    className={`data-panel holding-dialog design-dialog text-ink${wide ? ' holding-dialog-wide' : ''}`}
                >
                    <header className="holding-dialog-header">
                        <Dialog.Title className="holding-dialog-title">{t(title)}</Dialog.Title>
                        <LanguageSwitch />
                        <Dialog.Close className="data-action holding-dialog-close" aria-label={t("Close dialog")}>
                            <X size={18} aria-hidden="true" />
                        </Dialog.Close>
                    </header>
                    <div className="holding-dialog-body">{children}</div>
                </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

