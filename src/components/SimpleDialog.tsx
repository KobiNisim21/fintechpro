import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface SimpleDialogProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    title?: string;
}

export function SimpleDialog({ open, onClose, children, title = 'Manage holding' }: SimpleDialogProps) {
    return (
        <Dialog.Root open={open} onOpenChange={value => { if (!value) onClose(); }}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[10000] bg-black/20 backdrop-blur-sm" />
                <Dialog.Content aria-describedby={undefined} className="data-panel holding-dialog fixed z-[10001] text-[var(--color-ios-fg)]">
                    <Dialog.Title className="sr-only">{title}</Dialog.Title>
                    <Dialog.Close className="data-action absolute right-3 top-3 !p-2" aria-label="Close dialog">
                        <X size={18} aria-hidden="true" />
                    </Dialog.Close>
                    {children}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

