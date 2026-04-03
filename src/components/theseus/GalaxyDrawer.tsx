'use client';

import { useCallback, useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { getObject, whatIfRemove } from '@/lib/theseus-api';
import type { TheseusObject, WhatIfResult } from '@/lib/theseus-types';
import { TYPE_COLORS } from './renderers/rendering';

interface GalaxyDrawerProps {
  objectId: string | null;
  onClose: () => void;
  onWhatIfRemove?: (objectId: string, result: WhatIfResult) => void;
}

export default function GalaxyDrawer({
  objectId,
  onClose,
  onWhatIfRemove,
}: GalaxyDrawerProps) {
  const [object, setObject] = useState<TheseusObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResult | null>(null);

  useEffect(() => {
    if (!objectId) {
      setObject(null);
      setWhatIfResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getObject(objectId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setObject(result);
      }
    });

    return () => { cancelled = true; };
  }, [objectId]);

  const handleWhatIf = useCallback(async () => {
    if (!objectId) return;
    setWhatIfLoading(true);
    const result = await whatIfRemove(objectId);
    setWhatIfLoading(false);
    if (result.ok) {
      setWhatIfResult(result);
      onWhatIfRemove?.(objectId, result);
    }
  }, [objectId, onWhatIfRemove]);

  const typeColor = object ? (TYPE_COLORS[object.object_type] ?? '#9A958D') : '#9A958D';

  return (
    <Drawer.Root open={!!objectId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Drawer.Portal>
        <Drawer.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 30,
          }}
        />
        <Drawer.Content
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: '60vh',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            background: 'rgba(15,16,18,0.92)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderBottom: 'none',
            padding: '16px 20px 24px',
            zIndex: 31,
            overflowY: 'auto',
          }}
        >
          {/* Drag handle */}
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.12)',
              margin: '0 auto 16px',
            }}
          />

          {loading ? (
            <div
              style={{
                color: 'var(--vie-text-dim)',
                fontFamily: 'var(--vie-font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '20px 0',
                textAlign: 'center',
              }}
            >
              loading
            </div>
          ) : object ? (
            <div style={{ display: 'grid', gap: 14 }}>
              {/* Type badge and title */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: `${typeColor}20`,
                      color: typeColor,
                      fontFamily: 'var(--vie-font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {object.object_type}
                  </span>
                  {object.score !== undefined && (
                    <span
                      style={{
                        fontFamily: 'var(--vie-font-mono)',
                        fontSize: 10,
                        color: 'var(--vie-text-dim)',
                      }}
                    >
                      {Math.round(object.score * 100)}%
                    </span>
                  )}
                </div>

                <Drawer.Title
                  style={{
                    margin: 0,
                    color: 'var(--vie-text)',
                    fontFamily: 'var(--vie-font-title)',
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    lineHeight: 1.3,
                  }}
                >
                  {object.title}
                </Drawer.Title>
              </div>

              {/* Summary */}
              {object.summary && (
                <p
                  style={{
                    margin: 0,
                    color: 'var(--vie-text-muted)',
                    fontFamily: 'var(--vie-font-body)',
                    fontSize: 14,
                    lineHeight: 1.65,
                  }}
                >
                  {object.summary}
                </p>
              )}

              {/* What-if removal button */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleWhatIf}
                  disabled={whatIfLoading}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    background: 'rgba(196,80,60,0.1)',
                    border: '1px solid rgba(196,80,60,0.2)',
                    color: 'var(--vie-terra-light)',
                    fontFamily: 'var(--vie-font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    cursor: whatIfLoading ? 'wait' : 'pointer',
                    opacity: whatIfLoading ? 0.5 : 1,
                  }}
                >
                  {whatIfLoading ? 'simulating...' : 'what if removed?'}
                </button>
              </div>

              {/* What-if result */}
              {whatIfResult && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(196,80,60,0.06)',
                    border: '1px solid rgba(196,80,60,0.12)',
                    display: 'grid',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      color: 'var(--vie-terra-light)',
                      fontFamily: 'var(--vie-font-mono)',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    impact analysis
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      fontFamily: 'var(--vie-font-mono)',
                      fontSize: 11,
                      color: 'var(--vie-text-dim)',
                    }}
                  >
                    <span>{whatIfResult.affected_edges} edges</span>
                    <span>{whatIfResult.affected_clusters} clusters</span>
                    <span>{whatIfResult.orphaned_objects.length} orphaned</span>
                  </div>
                  {whatIfResult.narrative && (
                    <p
                      style={{
                        margin: 0,
                        color: 'var(--vie-text-muted)',
                        fontFamily: 'var(--vie-font-body)',
                        fontSize: 13,
                        lineHeight: 1.55,
                      }}
                    >
                      {whatIfResult.narrative}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                color: 'var(--vie-text-dim)',
                fontFamily: 'var(--vie-font-body)',
                fontSize: 13,
                padding: '20px 0',
                textAlign: 'center',
              }}
            >
              Object not found.
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
