import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface SimpleDialogProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
}

export function SimpleDialog({ open, onClose, children }: SimpleDialogProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);
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

    if (!open || !mounted) return null;

    return createPortal(
        <>
            {/* Overlay & Scroll Container */}
            <div
                className="fixed inset-0 z-[10000] overflow-y-auto custom-scrollbar bg-[var(--color-ios-fg)]/20 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                style={{
                    animation: 'fadeIn 0.2s ease-out',
                }}
            >
                <div className="flex min-h-full items-end justify-center sm:items-center p-4 pt-20">
                    {/* Content */}
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-[500px] bg-[var(--color-ios-bg)] rounded-[32px] p-6 md:p-8 shadow-[var(--shadow-ios-card)] text-[var(--color-ios-fg)] mb-safe"
                        style={{
                            animation: 'scaleIn 0.2s ease-out',
                        }}
                    >
                        {children}
                    </div>
                </div>
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
                        transform: scale(0.95);
                    }
                    to { 
                        opacity: 1;
                        transform: scale(1);
                    }
                }
            `}</style>
        </>,
        document.body
    );
}

