'use client';

import type { MockNode } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import ConnectionLabel from './ConnectionLabel';

/**
 * NodeCard: individual timeline entry for an object.
 *
 * Visual language:
 *   - Type-colored 3px left border
 *   - Type icon (16px SVG from SplitPaneContainer's ViewTypeIcon pattern)
 *   - Title in Vollkorn body font
 *   - Summary in body font, muted
 *   - Timestamp in Courier Prime 10px
 *   - Edge count badge
 *   - ConnectionLabels for first 2 edges
 *
 * Click dispatches onSelect to open object-detail in adjacent pane.
 */

interface NodeCardProps {
  node: MockNode;
  onSelect?: (nodeId: string) => void;
  /** All nodes in the timeline, for connection label lookups */
  allNodes?: MockNode[];
}

export default function NodeCard({ node, onSelect, allNodes }: NodeCardProps) {
  const typeInfo = getObjectTypeIdentity(node.objectType);

  return (
    <button
      type="button"
      className="cp-node-card"
      onClick={() => onSelect?.(node.id)}
      style={{
        borderLeftColor: typeInfo.color,
      }}
    >
      {/* Header: icon + title + time */}
      <div
        className="cp-node-card-header"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        {/* Type dot */}
        <span
          className="cp-node-type-dot"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: typeInfo.color,
            flexShrink: 0,
            marginTop: 5,
            boxShadow: `0 0 6px ${typeInfo.color}30`,
          }}
        />

        <div className="cp-node-main" style={{ flex: 1, minWidth: 0 }}>
          {/* Type label + time */}
          <div
            className="cp-node-meta"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 2,
            }}
          >
            <span
              className="cp-node-type-label"
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: typeInfo.color,
                opacity: 0.85,
              }}
            >
              {typeInfo.label}
            </span>
            <span
              className="cp-node-time"
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                color: 'var(--cp-text-faint)',
                letterSpacing: '0.02em',
                marginLeft: 'auto',
                flexShrink: 0,
              }}
            >
              {formatTime(node.capturedAt)}
            </span>
          </div>

          {/* Title */}
          <div
            className="cp-node-title"
            style={{
              fontFamily: 'var(--cp-font-title)',
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--cp-text)',
              lineHeight: 1.35,
              marginBottom: node.summary ? 4 : 0,
            }}
          >
            {node.title}
          </div>

          {/* Summary */}
          {node.summary && (
            <div
              className="cp-node-summary"
              style={{
                fontFamily: 'var(--cp-font-body)',
                fontSize: 12.5,
                color: 'var(--cp-text-muted)',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {node.summary}
            </div>
          )}
        </div>
      </div>

      {/* Footer: connections */}
      {node.edgeCount > 0 && (
        <div
          className="cp-node-footer"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            marginTop: 8,
            paddingLeft: 16,
          }}
        >
          {node.edges.slice(0, 2).map((edge) => {
            const connectedId =
              edge.sourceId === node.id ? edge.targetId : edge.sourceId;
            const connectedNode = allNodes?.find((n) => n.id === connectedId);
            return (
              <ConnectionLabel
                key={edge.id}
                targetTitle={connectedNode?.title ?? connectedId}
                targetType={connectedNode?.objectType ?? 'note'}
                reason={edge.reason}
              />
            );
          })}
          {node.edgeCount > 2 && (
            <span
              className="cp-node-more"
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                color: 'var(--cp-text-faint)',
                padding: '2px 6px',
                alignSelf: 'center',
              }}
            >
              +{node.edgeCount - 2} more
            </span>
          )}
        </div>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────
   Time formatting for card timestamp
   ───────────────────────────────────────────────── */

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
