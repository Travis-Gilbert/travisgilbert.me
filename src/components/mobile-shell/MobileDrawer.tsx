'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Drawer } from 'vaul';

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
  panelStyle,
}: MobileDrawerProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      direction={side}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="studio-vaul-overlay" />
        <Drawer.Content
          className={panelClassName ?? 'studio-vaul-side-drawer'}
          aria-label={ariaLabel}
          style={{
            width,
            ...panelStyle,
          }}
        >
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
