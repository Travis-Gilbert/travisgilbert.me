'use client';

import { useMemo } from 'react';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import type { MockNode, LineageResponse } from '@/lib/commonplace';
import { hexToRgb } from './library-data';

interface ChainNode {
  id: number;
  title: string;
  objectTypeSlug: string;
  date?: string;
  current: boolean;
}

interface ThreadChainProps {
  nodes?: MockNode[];
  lineageData?: LineageResponse | null;
  onOpenObject?: (objectRef: number) => void;
}

export default function ThreadChain({
  nodes,
  lineageData,
  onOpenObject,
}: ThreadChainProps) {
  const chain = useMemo(() => {
    if (!nodes || nodes.length === 0) return [];

    const result: ChainNode[] = [];

    // Current node: the first in feed (most recent capture)
    const current = nodes[0];
    result.push({
      id: current.objectRef,
      title: current.title,
      objectTypeSlug: current.objectType,
      date: formatShortDate(current.capturedAt),
      current: true,
    });

    // Ancestors from lineage data, or fallback to next feed nodes
    if (lineageData?.ancestors?.length) {
      for (const ancestor of lineageData.ancestors.slice(0, 3)) {
        result.push({
          id: ancestor.id,
          title: ancestor.title,
          objectTypeSlug: ancestor.object_type_slug,
          current: false,
        });
      }
    } else {
      for (const node of nodes.slice(1, 4)) {
        result.push({
          id: node.objectRef,
          title: node.title,
          objectTypeSlug: node.objectType,
          date: formatShortDate(node.capturedAt),
          current: false,
        });
      }
    }

    return result.slice(0, 4);
  }, [nodes, lineageData]);

  if (chain.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.7px',
          textTransform: 'uppercase' as const,
          color: 'rgba(26, 24, 22, 0.28)',
        }}>
          Recent Thread
        </span>
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          fontWeight: 400,
          letterSpacing: '0.7px',
          textTransform: 'uppercase' as const,
          color: 'rgba(26, 24, 22, 0.18)',
        }}>
          How recent captures connect
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 2,
          alignItems: 'stretch',
          overflowX: 'auto',
        }}
      >
        {chain.map((node, i) => {
          const identity = getObjectTypeIdentity(node.objectTypeSlug);
          const rgb = hexToRgb(identity.color);
          const isCurrent = node.current;

          return (
            <div
              key={`${node.id}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: isCurrent ? '1.4 1 0' : '1 1 0',
                minWidth: 0,
              }}
            >
              <button
                type="button"
                onClick={() => onOpenObject?.(node.id)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: isCurrent
                    ? `rgba(${rgb},0.05)`
                    : 'transparent',
                  border: `1px solid ${
                    isCurrent
                      ? `rgba(${rgb},0.15)`
                      : 'rgba(0,0,0,0.05)'
                  }`,
                  transition: 'background 150ms ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {/* Type dot row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    marginBottom: 4,
                  }}
                >
                  <div
                    className="cp-type-halo"
                    style={{
                      width: isCurrent ? 16 : 10,
                      height: isCurrent ? 16 : 10,
                      background: isCurrent
                        ? `radial-gradient(circle, rgba(${rgb},0.19) 0%, transparent 70%)`
                        : 'transparent',
                    }}
                  >
                    <span
                      className="cp-type-halo-dot"
                      style={{
                        width: isCurrent ? 6 : 4.5,
                        height: isCurrent ? 6 : 4.5,
                        background: identity.color,
                      }}
                    />
                  </div>
                  {isCurrent && (
                    <span
                      style={{
                        fontFamily: 'var(--cp-font-mono)',
                        fontSize: 8,
                        color: identity.color,
                        opacity: 0.6,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      now
                    </span>
                  )}
                </div>

                {/* Title */}
                <div
                  style={{
                    fontFamily: 'var(--cp-font-body)',
                    fontSize: isCurrent ? 12 : 11,
                    fontWeight: isCurrent ? 500 : 400,
                    color: isCurrent ? '#2A2520' : '#5C554D',
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {node.title}
                </div>

                {/* Date */}
                {node.date && (
                  <div
                    style={{
                      fontFamily: 'var(--cp-font-mono)',
                      fontSize: 9,
                      color: '#8A8279',
                      marginTop: 4,
                    }}
                  >
                    {node.date}
                  </div>
                )}
              </button>

              {/* Thin connector */}
              {i < chain.length - 1 && (
                <div
                  style={{
                    width: 6,
                    minWidth: 6,
                    height: 1,
                    background: 'rgba(0,0,0,0.08)',
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
