'use client';

import { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { CONTENT_TYPES, normalizeStudioContentType } from '@/lib/studio';
import { createContentItem } from '@/lib/studio-api';

/**
 * Type selector modal for creating new content.
 */
export default function NewContentModal({
  onClose,
  defaultType,
}: {
  onClose: () => void;
  defaultType?: string;
}) {
  const router = useRouter();
  const [creatingType, setCreatingType] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSelect = useCallback(
    async (typeSlug: string) => {
      const normalizedType = normalizeStudioContentType(typeSlug);
      setErrorText(null);
      setCreatingType(normalizedType);

      try {
        const created = await createContentItem(normalizedType, {});
        onClose();
        router.push(`/studio/${created.contentType}/${created.slug}`);
      } catch {
        setErrorText('Could not create content. Check the Studio API connection.');
      } finally {
        setCreatingType(null);
      }
    },
    [onClose, router],
  );

  useEffect(() => {
    if (!defaultType) return;

    const normalizedDefault = normalizeStudioContentType(defaultType);
    const match = CONTENT_TYPES.find(
      (t) =>
        t.slug === normalizedDefault ||
        normalizeStudioContentType(t.route) === normalizedDefault,
    );

    if (match) {
      void handleSelect(match.slug);
    }
  }, [defaultType, handleSelect]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const modalContent = (
    <div className="studio-theme">
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 9998,
        }}
        onClick={onClose}
        role="button"
        tabIndex={-1}
        aria-label="Close modal"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create new content"
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
        <div
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: 'var(--studio-text-3)',
            marginBottom: '16px',
          }}
        >
          Choose content type
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {CONTENT_TYPES.map((ct) => {
            const isBusy = creatingType === ct.slug;
            return (
              <button
                key={ct.slug}
                type="button"
                onClick={() => void handleSelect(ct.slug)}
                disabled={creatingType !== null}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  backgroundColor: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: '6px',
                  cursor: creatingType ? 'default' : 'pointer',
                  textAlign: 'left' as const,
                  transition: 'all 0.1s ease',
                  opacity: creatingType && !isBusy ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (creatingType) return;
                  e.currentTarget.style.backgroundColor =
                    'var(--studio-surface-hover)';
                  e.currentTarget.style.borderColor = 'var(--studio-border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: ct.color,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--studio-font-body)',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--studio-text-bright)',
                      lineHeight: 1.3,
                    }}
                  >
                    {ct.label}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--studio-font-mono)',
                      fontSize: '10px',
                      color: 'var(--studio-text-3)',
                      marginTop: '1px',
                    }}
                  >
                    {isBusy ? 'Creating...' : ct.pluralLabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {errorText && (
          <p
            style={{
              marginTop: '12px',
              marginBottom: 0,
              fontFamily: 'var(--studio-font-body)',
              fontSize: '12px',
              color: '#A44A3A',
            }}
          >
            {errorText}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'block',
            width: '100%',
            marginTop: '16px',
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
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
