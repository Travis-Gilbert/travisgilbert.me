'use client';

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Styled confirmation modal matching Studio's design language.
 * Renders as a portal on document.body with backdrop overlay.
 * Wraps content in .studio-theme for CSS token resolution.
 */
export default function DeleteConfirmModal({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  }, [onCancel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return createPortal(
    <div className="studio-theme">
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 9998,
        }}
        onClick={onCancel}
        role="button"
        tabIndex={-1}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm deletion"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          backgroundColor: 'var(--studio-surface)',
          border: '1px solid var(--studio-border)',
          borderRadius: '8px',
          padding: '24px',
          width: '320px',
          maxWidth: '90vw',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#C04020',
          marginBottom: '12px',
        }}>
          Delete content
        </div>

        <p style={{
          fontFamily: 'var(--studio-font-body)',
          fontSize: '14px',
          color: 'var(--studio-text-1)',
          lineHeight: 1.5,
          marginBottom: '20px',
        }}>
          Are you sure you want to delete &ldquo;{title}&rdquo;? This cannot be undone.
        </p>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: 'transparent',
              border: '1px solid var(--studio-border)',
              borderRadius: '4px',
              color: 'var(--studio-text-3)',
              fontFamily: 'var(--studio-font-body)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: 'rgba(192, 64, 32, 0.15)',
              border: '1px solid rgba(192, 64, 32, 0.3)',
              borderRadius: '4px',
              color: '#E06040',
              fontFamily: 'var(--studio-font-body)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
