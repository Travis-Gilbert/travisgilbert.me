'use client';

import type { CSSProperties, ReactNode } from 'react';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel: string;
  width?: string;
  side?: 'left' | 'right';
  panelClassName?: string;
  backdropClassName?: string;
  panelStyle?: CSSProperties;
}

export default function MobileDrawer({
  open,
  onClose,
  children,
  ariaLabel,
  width = 'min(84vw, 340px)',
  side = 'left',
  panelClassName,
  backdropClassName,
  panelStyle,
}: MobileDrawerProps) {
  const fallbackTransform =
    side === 'left'
      ? open
        ? 'translateX(0)'
        : 'translateX(-102%)'
      : open
        ? 'translateX(0)'
        : 'translateX(102%)';

  return (
    <>
      <button
        type="button"
        className={backdropClassName ?? 'mobile-shell-drawer-backdrop'}
        data-open={open ? 'true' : 'false'}
        aria-label="Close navigation drawer"
        onClick={onClose}
      />

      <aside
        className={panelClassName ?? 'mobile-shell-drawer-panel'}
        data-open={open ? 'true' : 'false'}
        data-side={side}
        aria-hidden={open ? undefined : true}
        aria-label={ariaLabel}
        style={{
          ...(panelClassName
            ? {}
            : {
                width,
                transform: fallbackTransform,
                left: side === 'left' ? 0 : undefined,
                right: side === 'right' ? 0 : undefined,
              }),
          ...panelStyle,
        }}
      >
        {children}
      </aside>
    </>
  );
}
