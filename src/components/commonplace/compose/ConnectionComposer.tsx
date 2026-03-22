'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSelection } from '@/lib/providers/selection-provider';

export default function ConnectionComposer() {
  const { cancelConnection, connectionDraft, submitConnection } = useSelection();
  const [edgeType, setEdgeType] = useState('related');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!connectionDraft) return undefined;

    setEdgeType('related');
    setReason('');

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') cancelConnection();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelConnection, connectionDraft]);

  if (!connectionDraft) return null;

  if (!connectionDraft.target) {
    return (
      <div
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 9200,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 12,
          border: '1px solid var(--cp-red-line)',
          background: 'rgba(16, 18, 22, 0.94)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              color: 'var(--cp-red)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Connect mode
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: 'var(--cp-font-body)',
              fontSize: 13,
              color: 'var(--cp-chrome-text)',
            }}
          >
            Select an object to connect to “{connectionDraft.source.display_title ?? connectionDraft.source.title}”.
          </div>
        </div>
        <button
          type="button"
          onClick={cancelConnection}
          style={{
            border: '1px solid var(--cp-chrome-line)',
            background: 'transparent',
            color: 'var(--cp-chrome-muted)',
            borderRadius: 999,
            padding: '6px 10px',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  const sourceTitle = connectionDraft.source.display_title ?? connectionDraft.source.title;
  const targetTitle = connectionDraft.target.display_title ?? connectionDraft.target.title;

  return (
    <div className="cp-palette-overlay" role="dialog" aria-modal="true" onClick={cancelConnection}>
      <div
        className="cp-palette-container"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(520px, calc(100vw - 32px))',
          background: 'var(--cp-card)',
        }}
      >
        <div className="cp-palette-input-wrap" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 10,
                color: 'var(--cp-red)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Add connection
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: 'var(--cp-font-title)',
                fontSize: 22,
                color: 'var(--cp-text)',
                lineHeight: 1.15,
              }}
            >
              {sourceTitle}
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: 'var(--cp-font-body)',
                fontSize: 14,
                color: 'var(--cp-text-muted)',
              }}
            >
              connects to {targetTitle}
            </div>
          </div>
          <button
            type="button"
            onClick={cancelConnection}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--cp-chrome-muted)',
              fontSize: 18,
              cursor: 'pointer',
            }}
            aria-label="Close connection dialog"
          >
            ×
          </button>
        </div>

        <div style={{ padding: '16px' }}>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              color: 'var(--cp-chrome-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Edge type
          </label>
          <input
            type="text"
            value={edgeType}
            onChange={(event) => setEdgeType(event.target.value)}
            style={{
              width: '100%',
              borderRadius: 8,
              border: '1px solid var(--cp-border)',
              background: 'var(--cp-surface)',
              padding: '10px 12px',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 12,
              color: 'var(--cp-text)',
              boxSizing: 'border-box',
            }}
          />

          <label
            style={{
              display: 'block',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              color: 'var(--cp-chrome-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginTop: 14,
              marginBottom: 6,
            }}
          >
            Reason
          </label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder="Optional explanation for why these objects connect."
            style={{
              width: '100%',
              borderRadius: 8,
              border: '1px solid var(--cp-border)',
              background: 'var(--cp-surface)',
              padding: '10px 12px',
              fontFamily: 'var(--cp-font-body)',
              fontSize: 13,
              color: 'var(--cp-text)',
              lineHeight: 1.5,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 16,
            }}
          >
            <button
              type="button"
              onClick={cancelConnection}
              style={{
                borderRadius: 999,
                border: '1px solid var(--cp-border)',
                background: 'transparent',
                padding: '8px 12px',
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 11,
                color: 'var(--cp-text-muted)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !edgeType.trim()}
              onClick={async () => {
                setSaving(true);
                try {
                  await submitConnection({ edgeType: edgeType.trim(), reason: reason.trim() });
                  toast.success(`Connected “${sourceTitle}” to “${targetTitle}”.`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Failed to add connection.');
                } finally {
                  setSaving(false);
                }
              }}
              style={{
                borderRadius: 999,
                border: '1px solid var(--cp-red-line)',
                background: 'var(--cp-red)',
                padding: '8px 12px',
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 11,
                color: '#fff',
                cursor: saving ? 'progress' : 'pointer',
                opacity: saving || !edgeType.trim() ? 0.7 : 1,
              }}
            >
              {saving ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
