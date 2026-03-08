'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  exportStudioDocument,
  type StudioExportFormat,
} from '@/lib/studio-export';

const EXPORT_OPTIONS: Array<{ format: StudioExportFormat; label: string }> = [
  { format: 'markdown', label: 'Markdown (.md)' },
  { format: 'txt', label: 'Text (.txt)' },
  { format: 'pdf', label: 'PDF (.pdf)' },
];

export default function ExportMenu({
  title,
  slug,
  markdown,
  className = '',
  buttonLabel = 'Export',
}: {
  title: string;
  slug: string;
  markdown: string;
  className?: string;
  buttonLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [busyFormat, setBusyFormat] = useState<StudioExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && containerRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleExport = useCallback(
    async (format: StudioExportFormat) => {
      setBusyFormat(format);
      setError(null);

      try {
        await exportStudioDocument({
          format,
          markdown,
          title,
          slug,
        });
        setIsOpen(false);
      } catch {
        setError('Export failed');
      } finally {
        setBusyFormat(null);
      }
    },
    [markdown, slug, title],
  );

  return (
    <div className={`studio-export-menu ${className}`.trim()} ref={containerRef}>
      <button
        type="button"
        className="studio-tool studio-tool--ghost studio-tool--label studio-export-toggle"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls="studio-export-menu-popover"
      >
        {buttonLabel}
      </button>

      {isOpen && (
        <div
          id="studio-export-menu-popover"
          className="studio-export-popover"
          role="menu"
          aria-label="Export options"
        >
          {EXPORT_OPTIONS.map((option) => (
            <button
              key={option.format}
              type="button"
              className="studio-export-item"
              onClick={() => void handleExport(option.format)}
              disabled={busyFormat !== null}
              role="menuitem"
            >
              {busyFormat === option.format ? 'Exporting...' : option.label}
            </button>
          ))}

          {error && (
            <p className="studio-export-error" aria-live="polite">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
