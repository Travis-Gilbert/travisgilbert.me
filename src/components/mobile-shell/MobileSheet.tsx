'use client';

import type { ReactNode } from 'react';

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export default function MobileSheet({
  open,
  onClose,
  title,
  children,
  className,
}: MobileSheetProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="mobile-shell-sheet-backdrop"
        aria-label="Close details"
        onClick={onClose}
      />

      <section className={['mobile-shell-sheet', className].filter(Boolean).join(' ')} aria-label={title}>
        <header className="mobile-shell-sheet-header">
          <h2 className="mobile-shell-sheet-title">{title}</h2>
          <button
            type="button"
            className="mobile-shell-icon-btn"
            onClick={onClose}
            aria-label="Close details"
          >
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <line x1={3} y1={3} x2={13} y2={13} />
              <line x1={13} y1={3} x2={3} y2={13} />
            </svg>
          </button>
        </header>
        <div className="mobile-shell-sheet-body">{children}</div>
      </section>
    </>
  );
}
