'use client';

import { useRouter } from 'next/navigation';
import { CONTENT_TYPES } from '@/lib/studio';

/**
 * Type selector modal for creating new content.
 *
 * Shows all content types with their colored dots and labels.
 * Selecting a type navigates to the editor with a placeholder slug.
 * Backdrop click or Escape closes the modal.
 */
export default function NewContentModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const router = useRouter();

  const handleSelect = (typeSlug: string) => {
    /* Generate a temp slug for new content. In production this
       will POST to Django and get a real slug back. */
    const tempSlug = `new-${Date.now().toString(36)}`;
    onClose();
    router.push(`/studio/${typeSlug}/${tempSlug}`);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 200,
        }}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        role="button"
        tabIndex={-1}
        aria-label="Close"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-label="Create new content"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 201,
          backgroundColor: 'var(--studio-surface)',
          border: '1px solid var(--studio-border)',
          borderRadius: '8px',
          padding: '24px',
          width: '320px',
          maxWidth: '90vw',
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
          {CONTENT_TYPES.map((ct) => (
            <button
              key={ct.slug}
              type="button"
              onClick={() => handleSelect(ct.slug)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: '1px solid transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left' as const,
                transition: 'all 0.1s ease',
              }}
              onMouseEnter={(e) => {
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
                  {ct.pluralLabel}
                </div>
              </div>
            </button>
          ))}
        </div>

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
    </>
  );
}
