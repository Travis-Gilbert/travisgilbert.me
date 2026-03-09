'use client';

import type { ReactNode } from 'react';
import { Drawer } from 'vaul';

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
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      snapPoints={[0.4, 0.85]}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="studio-vaul-overlay" />
        <Drawer.Content
          className={['studio-vaul-bottom-sheet', className].filter(Boolean).join(' ')}
          aria-label={title}
        >
          <div className="studio-vaul-handle-bar" />
          <header className="studio-vaul-sheet-header">
            <Drawer.Title className="studio-vaul-sheet-title">{title}</Drawer.Title>
          </header>
          <div className="studio-vaul-sheet-body">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
