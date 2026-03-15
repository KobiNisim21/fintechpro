import { ReactNode, useEffect } from 'react';

interface SimpleDialogProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
}

export function SimpleDialog({ open, onClose, children }: SimpleDialogProps) {
    // Lock body scroll when dialog is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = '';
            };
        }
    }, [open]);

    // Close on ESC key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && open) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <>
            {/* Overlay */}
            <div
                onClick={onClose}
                className="fixed inset-0 z-[9999] bg-[var(--color-clay-fg)]/20 backdrop-blur-sm transition-opacity"
                style={{
                    animation: 'fadeIn 0.2s ease-out',
                }}
            />

            {/* Content */}
            <div
                onClick={(e) => e.stopPropagation()}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] w-[90%] max-w-[500px] max-h-[90vh] overflow-y-auto bg-[var(--color-clay-canvas)] rounded-[32px] p-6 md:p-8 shadow-clayDeep text-[var(--color-clay-fg)] font-body"
                style={{
                    animation: 'scaleIn 0.2s ease-out',
                }}
            >
                {children}
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { 
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.95);
                    }
                    to { 
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                }
            `}</style>
        </>
    );
}

