'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { MockNode } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { useCommonPlace } from '@/lib/commonplace-context';
import CardFooter from './CardFooter';
import TensionBadge from './TensionBadge';

/**
 * ObjectCard: polymorphic card dispatcher for all 11 object types.
 *
 * Replaces the single NodeCard with type-specific visual treatments.
 * Saturation encoding: border/accent opacity encodes richness.
 *   sat = clamp(0.3 + (edgeCount/5)*0.4 + (summary.length/200)*0.3, 0.3, 1.0)
 *
 * Props:
 *   node     - the MockNode from the feed API
 *   onSelect - called with node.id on click (for timeline pane navigation)
 *   allNodes - sibling nodes for connection label lookups
 *   mode     - 'grid' (4-line summary) or 'timeline' (2-line summary)
 */

interface ObjectCardProps {
  node: MockNode;
  onSelect?: (nodeId: string) => void;
  allNodes?: MockNode[];
  mode?: 'grid' | 'timeline';
}

/* ─────────────────────────────────────────────────
   Utility: saturation encoding
   ───────────────────────────────────────────────── */

function computeSaturation(node: MockNode): number {
  const edgeFactor = Math.min(node.edgeCount / 5, 1);
  const bodyFactor = Math.min((node.summary?.length ?? 0) / 200, 1);
  return Math.min(0.3 + edgeFactor * 0.4 + bodyFactor * 0.3, 1.0);
}

/** Convert a 6-digit hex color + alpha float [0..1] to rgba() string */
function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

/* ─────────────────────────────────────────────────
   Shared sub-components
   ───────────────────────────────────────────────── */

function TypeBadge({ label, color, sat }: { label: string; color: string; sat: number }) {
  return (
    <span
      style={{
        fontFamily: 'var(--cp-font-mono)',
        fontSize: 9,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color: hexAlpha(color, sat),
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

/* ─────────────────────────────────────────────────
   Type-specific header components
   ───────────────────────────────────────────────── */

function SourceHeader({ node, color, sat }: { node: MockNode; color: string; sat: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <TypeBadge label="SOURCE" color={color} sat={sat} />
      {/* File badge placeholder */}
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 8,
          color: hexAlpha(color, 0.55),
          border: `1px solid ${hexAlpha(color, 0.25)}`,
          borderRadius: 2,
          padding: '1px 4px',
          letterSpacing: '0.06em',
        }}
      >
        WEB
      </span>
    </div>
  );
}

function HunchHeader({ node, color, sat }: { node: MockNode; color: string; sat: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
      {/* Sparkle icon */}
      <svg width={10} height={10} viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M5 1v8M1 5h8M2 2l6 6M8 2l-6 6" stroke={hexAlpha(color, sat)} strokeWidth={1} strokeLinecap="round" />
      </svg>
      <TypeBadge label="HUNCH" color={color} sat={sat} />
    </div>
  );
}

function PersonHeader({ node, color, sat }: { node: MockNode; color: string; sat: number }) {
  const initial = node.title.charAt(0).toUpperCase();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: `conic-gradient(from 0deg, ${hexAlpha(color, sat * 0.3)}, ${hexAlpha(color, sat * 0.6)}, ${hexAlpha(color, sat * 0.3)})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${hexAlpha(color, 0.1)}, ${hexAlpha(color, 0.22)})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--cp-font-title)',
            fontSize: 18,
            fontWeight: 700,
            color,
          }}
        >
          {initial}
        </div>
        {node.edgeCount > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: color,
              color: '#F5F0E8',
              fontFamily: 'var(--cp-font-code)',
              fontSize: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--cp-card)',
            }}
          >
            {node.edgeCount}
          </div>
        )}
      </div>
      <TypeBadge label="PERSON" color={color} sat={sat} />
    </div>
  );
}

function QuoteHeader({ color, sat }: { color: string; sat: number }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <span
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: 44,
          lineHeight: 0.7,
          color: hexAlpha(color, 0.2 * sat),
          userSelect: 'none',
        }}
        aria-hidden="true"
      >
        &ldquo;
      </span>
    </div>
  );
}

function ConceptHeader({ node, color, sat }: { node: MockNode; color: string; sat: number }) {
  /* Radiating dot cluster scaled to edge count (max 5 visible dots) */
  const dotCount = Math.min(node.edgeCount, 5);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
      <div style={{ position: 'relative', width: 14, height: 14, flexShrink: 0 }}>
        {/* Center dot */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 4,
            height: 4,
            borderRadius: '50%',
            backgroundColor: hexAlpha(color, sat),
          }}
        />
        {/* Radiating dots */}
        {Array.from({ length: dotCount }).map((_, i) => {
          const angle = (i / Math.max(dotCount, 1)) * Math.PI * 2 - Math.PI / 2;
          const cx = 7 + Math.cos(angle) * 5;
          const cy = 7 + Math.sin(angle) * 5;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: cy - 1.5,
                left: cx - 1.5,
                width: 3,
                height: 3,
                borderRadius: '50%',
                backgroundColor: hexAlpha(color, sat * 0.6),
              }}
            />
          );
        })}
      </div>
      <TypeBadge label="CONCEPT" color={color} sat={sat} />
    </div>
  );
}

function PlaceHeader({ color, sat }: { color: string; sat: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      {/* Map pin SVG */}
      <svg width={10} height={13} viewBox="0 0 10 13" fill={hexAlpha(color, sat)} aria-hidden="true">
        <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5zm0 6.75a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5z" />
      </svg>
      <TypeBadge label="PLACE" color={color} sat={sat} />
    </div>
  );
}

function TaskHeader({ color, sat }: { color: string; sat: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      {/* Checkbox outline */}
      <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <rect x={0.75} y={0.75} width={10.5} height={10.5} rx={2} stroke={hexAlpha(color, sat)} strokeWidth={1.2} />
      </svg>
      <TypeBadge label="TASK" color={color} sat={sat} />
    </div>
  );
}

function EventHeader({ color, sat }: { color: string; sat: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      {/* Calendar icon */}
      <svg width={11} height={12} viewBox="0 0 11 12" fill="none" aria-hidden="true">
        <rect x={0.5} y={1.5} width={10} height={10} rx={1.5} stroke={hexAlpha(color, sat)} strokeWidth={1} />
        <path d="M3.5 0v3M7.5 0v3" stroke={hexAlpha(color, sat)} strokeWidth={1} strokeLinecap="round" />
        <line x1={0.5} y1={4.5} x2={10.5} y2={4.5} stroke={hexAlpha(color, sat)} strokeWidth={1} />
      </svg>
      <TypeBadge label="EVENT" color={color} sat={sat} />
    </div>
  );
}

function ScriptHeader({ color, sat }: { color: string; sat: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      {/* Code brackets */}
      <svg width={14} height={10} viewBox="0 0 14 10" fill="none" aria-hidden="true">
        <path d="M4 1L1 5l3 4M10 1l3 4-3 4" stroke={hexAlpha(color, sat)} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <TypeBadge label="SCRIPT" color={color} sat={sat} />
    </div>
  );
}

function DefaultHeader({ color, sat, label }: { color: string; sat: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      {/* Type dot */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: hexAlpha(color, sat),
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
      <TypeBadge label={label.toUpperCase()} color={color} sat={sat} />
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Main ObjectCard component
   ───────────────────────────────────────────────── */

export default function ObjectCard({
  node,
  onSelect,
  mode = 'timeline',
}: ObjectCardProps) {
  const { openDrawer } = useCommonPlace();
  const typeInfo = getObjectTypeIdentity(node.objectType);
  const { color, label } = typeInfo;
  const sat = computeSaturation(node);

  /* Base card styles shared by all types */
  const baseCardStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'var(--cp-card)',
    border: '1px solid var(--cp-border-faint)',
    borderRadius: 10,
    padding: '14px 16px 10px',
    cursor: 'pointer',
    transition: 'box-shadow 200ms ease, transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 1px 3px rgba(42, 36, 32, 0.05)',
    position: 'relative',
    overflow: 'hidden',
  };

  const cardStyle: CSSProperties = {
    ...baseCardStyle,

    // Source: teal top accent
    ...(node.objectType === 'source' && {
      borderTop: `3px solid ${hexAlpha(color, sat)}`,
      borderTopLeftRadius: 2,
      borderTopRightRadius: 2,
    }),

    // Hunch: dashed border + warm gradient
    ...(node.objectType === 'hunch' && {
      border: `1.5px dashed ${hexAlpha(color, sat * 0.5)}`,
      background: 'linear-gradient(140deg, #FFF8F4 0%, #FEF3EC 100%)',
    }),

    // Quote: gold left border + warm gradient
    ...(node.objectType === 'quote' && {
      borderLeft: `4px solid ${hexAlpha(color, sat)}`,
      background: 'linear-gradient(135deg, var(--cp-card) 0%, #FBF8F0 100%)',
      paddingTop: 18,
    }),

    // Place: gold left border + subtle top gradient
    ...(node.objectType === 'place' && {
      borderLeft: `4px solid ${hexAlpha(color, sat)}`,
      background: `linear-gradient(180deg, ${hexAlpha(color, 0.04)} 0%, var(--cp-card) 40%)`,
    }),

    // Person: terracotta bottom border
    ...(node.objectType === 'person' && {
      borderBottom: `3px solid ${hexAlpha(color, sat * 0.7)}`,
    }),

    // Task: orange left border
    ...(node.objectType === 'task' && {
      borderLeft: `3px solid ${hexAlpha(color, sat)}`,
    }),

    // Event: blue top accent + gradient
    ...(node.objectType === 'event' && {
      background: `linear-gradient(160deg, ${hexAlpha(color, 0.06)} 0%, var(--cp-card) 50%)`,
      borderTop: `3px solid ${hexAlpha(color, sat * 0.7)}`,
    }),

    // Script: steel left border
    ...(node.objectType === 'script' && {
      borderLeft: `3px solid ${hexAlpha(color, sat * 0.6)}`,
      background: '#FAFAF8',
    }),

    // Concept: purple border tint
    ...(node.objectType === 'concept' && {
      border: `1.5px solid ${hexAlpha(color, sat * 0.25)}`,
    }),
  };

  /* Title style: italic for hunch/quote, mono for script */
  const titleStyle: CSSProperties = {
    fontFamily:
      node.objectType === 'script'
        ? 'var(--cp-font-code)'
        : 'var(--cp-font-title)',
    fontSize: node.objectType === 'script' ? 13 : 15.5,
    fontWeight: node.objectType === 'concept' ? 700 : 600,
    fontStyle:
      node.objectType === 'hunch' || node.objectType === 'quote'
        ? 'italic'
        : 'normal',
    color: 'var(--cp-text)',
    lineHeight: 1.35,
    marginBottom: node.summary ? 6 : 0,
  };

  /* Summary: clamp to 2 lines (timeline) or 4 lines (grid) */
  const summaryClamp = mode === 'grid' ? 4 : 2;
  const summaryStyle: CSSProperties = {
    fontFamily: 'var(--cp-font-body)',
    fontSize: 13,
    color: 'var(--cp-text-muted)',
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: summaryClamp,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    ...(node.objectType === 'script' && {
      fontFamily: 'var(--cp-font-code)',
      fontSize: 11.5,
      background: 'rgba(107, 122, 138, 0.06)',
      padding: '4px 6px',
      borderRadius: 2,
      color: 'var(--cp-text-muted)',
    }),
  };

  /* Detect tension edges for badge */
  const tensionEdge = node.edges.find(
    (e) =>
      e.edge_type?.toLowerCase().includes('counter') ||
      e.edge_type?.toLowerCase().includes('tension') ||
      e.reason?.toLowerCase().includes('contradict'),
  );

  /* Dispatch the type-specific header */
  let header: ReactNode;
  switch (node.objectType) {
    case 'source':
      header = <SourceHeader node={node} color={color} sat={sat} />;
      break;
    case 'hunch':
      header = <HunchHeader node={node} color={color} sat={sat} />;
      break;
    case 'person':
      header = <PersonHeader node={node} color={color} sat={sat} />;
      break;
    case 'quote':
      header = <QuoteHeader color={color} sat={sat} />;
      break;
    case 'concept':
      header = <ConceptHeader node={node} color={color} sat={sat} />;
      break;
    case 'place':
      header = <PlaceHeader color={color} sat={sat} />;
      break;
    case 'task':
      header = <TaskHeader color={color} sat={sat} />;
      break;
    case 'event':
      header = <EventHeader color={color} sat={sat} />;
      break;
    case 'script':
      header = <ScriptHeader color={color} sat={sat} />;
      break;
    default:
      header = <DefaultHeader color={color} sat={sat} label={label} />;
  }

  return (
    <button
      type="button"
      className={`cp-object-card cp-object-card--${node.objectType} cp-object-card--${mode}`}
      style={cardStyle}
      onClick={() => openDrawer(node.objectSlug)}
    >
      {header}

      <div
        className="cp-object-card-title"
        style={titleStyle}
      >
        {node.title}
      </div>

      {node.summary && (
        <div
          className="cp-object-card-summary"
          style={summaryStyle}
        >
          {node.summary}
        </div>
      )}

      {tensionEdge && (
        <div style={{ marginTop: 6 }}>
          <TensionBadge edgeType={tensionEdge.edge_type} />
        </div>
      )}

      <CardFooter
        capturedAt={node.capturedAt}
        edgeCount={node.edgeCount}
        typeColor={color}
      />
    </button>
  );
}
