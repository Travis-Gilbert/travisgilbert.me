'use client';

import type { ReactNode } from 'react';

interface MobileTopBarProps {
  title: string;
  onMenu?: () => void;
  menuAriaLabel?: string;
  menuIcon?: ReactNode;
  primaryAction?: ReactNode;
  className?: string;
  titleClassName?: string;
  menuButtonClassName?: string;
}

function DefaultHamburgerIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <line x1={3} y1={5} x2={15} y2={5} />
      <line x1={3} y1={9} x2={15} y2={9} />
      <line x1={3} y1={13} x2={15} y2={13} />
    </svg>
  );
}

export default function MobileTopBar({
  title,
  onMenu,
  menuAriaLabel = 'Open navigation menu',
  menuIcon,
  primaryAction,
  className,
  titleClassName,
  menuButtonClassName,
}: MobileTopBarProps) {
  return (
    <div className={['mobile-shell-top-bar', className].filter(Boolean).join(' ')}>
      {onMenu ? (
        <button
          type="button"
          className={menuButtonClassName ?? 'mobile-shell-icon-btn'}
          onClick={onMenu}
          aria-label={menuAriaLabel}
        >
          {menuIcon ?? <DefaultHamburgerIcon />}
        </button>
      ) : (
        <div className="mobile-shell-side-slot" aria-hidden="true" />
      )}

      <div className={['mobile-shell-title', titleClassName].filter(Boolean).join(' ')} title={title}>
        {title}
      </div>

      {primaryAction ? (
        <div className="mobile-shell-side-slot">{primaryAction}</div>
      ) : (
        <div className="mobile-shell-side-slot" aria-hidden="true" />
      )}
    </div>
  );
}
