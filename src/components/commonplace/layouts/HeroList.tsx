'use client';

/**
 * Layout B: Hero + List
 *
 * First object promoted to one density tier above current setting.
 * Remaining objects render as compact inline rows inside a bordered container.
 * Row lead elements match chip-tier visuals per type.
 */

import ObjectRenderer, { type RenderableObject, type ObjectVariant } from '../objects/ObjectRenderer';
import ObjectDensityWrapper from './ObjectDensityWrapper';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString } from '../objects/shared';
import type { Density } from './ObjectList';

interface HeroListProps {
  objects: RenderableObject[];
  density?: Density;
  onClick?: (obj: RenderableObject) => void;
  onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
  onPinCreated?: (parentSlug: string, childSlug: string) => void;
}

const DENSITY_TO_VARIANT: Record<Density, ObjectVariant> = {
  chip: 'chip',
  card: 'default',
  expanded: 'module',
};

/** Promote density one tier up */
function promoteDensity(density: Density): Density {
  if (density === 'chip') return 'card';
  return 'expanded';
}

export default function HeroList({
  objects,
  density = 'card',
  onClick,
  onContextMenu,
  onPinCreated,
}: HeroListProps) {
  if (objects.length === 0) {
    return (
      <div className="cp-empty-state">
        No objects to display.
      </div>
    );
  }

  const [hero, ...rest] = objects;
  const heroDensity = promoteDensity(density);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Hero slot: promoted density */}
      <ObjectDensityWrapper defaultDensity={heroDensity} enabled={false}>
        {(d) => (
          <ObjectRenderer
            object={hero}
            variant={DENSITY_TO_VARIANT[d]}
            onClick={onClick}
            onContextMenu={onContextMenu}
            onPinCreated={onPinCreated}
          />
        )}
      </ObjectDensityWrapper>

      {/* List slot: compact rows */}
      {rest.length > 0 && (
        <div style={{
          borderRadius: 8,
          background: 'var(--cp-card)',
          border: '1px solid var(--cp-border)',
          overflow: 'hidden',
        }}>
          {rest.map((obj, i) => (
            <HeroListRow
              key={`${obj.id}-${obj.slug}`}
              object={obj}
              isLast={i === rest.length - 1}
              onClick={onClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HeroListRow({
  object,
  isLast,
  onClick,
}: {
  object: RenderableObject;
  isLast: boolean;
  onClick?: (obj: RenderableObject) => void;
}) {
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const title = object.display_title ?? object.title;
  const edgeCount = object.edge_count ?? 0;
  const provenance = readString(object.source_label);

  return (
    <button
      type="button"
      onClick={onClick ? () => onClick(object) : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.03)',
        cursor: 'pointer',
        transition: 'background 120ms ease',
      }}
      className="cp-hero-list-row"
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(184,98,61,0.04)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <TypeLeadElement type={object.object_type_slug} object={object} color={identity.color} />
      <span style={{
        flex: 1,
        fontFamily: 'var(--cp-font-body)',
        fontSize: 13,
        color: 'var(--cp-text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>{title}</span>
      <span style={{
        fontFamily: 'var(--cp-font-mono)',
        fontSize: 12,
        color: 'var(--cp-terracotta, #B45A2D)',
      }}>{'\u2192'}</span>
      {edgeCount > 0 && (
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          color: 'var(--cp-text-faint)',
          flexShrink: 0,
        }}>{edgeCount}</span>
      )}
      {provenance && (
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          color: 'var(--cp-text-dim)',
          background: 'rgba(255,255,255,0.04)',
          padding: '1px 5px',
          borderRadius: 3,
          flexShrink: 0,
        }}>{provenance}</span>
      )}
    </button>
  );
}

/**
 * Type-specific lead element for compact list rows.
 * Matches chip-tier visuals per SPEC-F.
 */
function TypeLeadElement({ type, object, color }: { type: string; object: RenderableObject; color: string }) {
  switch (type) {
    case 'person': {
      const initial = (object.display_title ?? object.title).charAt(0).toUpperCase();
      return (
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          background: 'var(--cp-person-color, #B45A2D)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 9, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{initial}</span>
        </div>
      );
    }
    case 'task': {
      const done = object.status === 'done' || object.status === 'complete' || object.status === 'completed';
      const priority = typeof object.priority === 'string' ? object.priority.toLowerCase() : '';
      const pColor = { high: '#D85A30', medium: '#C49A4A', low: '#5A7A4A' }[priority] ?? 'var(--cp-border-faint)';
      return (
        <div style={{
          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
          border: `1.5px solid ${pColor}`,
          background: done ? pColor : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {done && (
            <svg width="8" height="6" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      );
    }
    case 'event': {
      const d = object.captured_at ? new Date(object.captured_at) : null;
      if (!d) return <TypeDot color={color} />;
      const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
      const day = String(d.getDate());
      return (
        <div style={{ width: 26, borderRadius: 4, overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ background: 'var(--cp-event-color, #4A7A9A)', padding: '1px 0', textAlign: 'center', fontFamily: 'var(--cp-font-mono)', fontSize: 7, fontWeight: 700, color: '#fff', textTransform: 'uppercase', lineHeight: 1.4 }}>{month}</div>
          <div style={{ background: 'var(--cp-card)', textAlign: 'center', padding: '1px 0', fontFamily: 'var(--cp-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--cp-text)', lineHeight: 1.2 }}>{day}</div>
        </div>
      );
    }
    case 'email':
      return (
        <div style={{
          width: 16, height: 12, border: '1.5px solid var(--cp-email-color, #4A7A9A)',
          borderRadius: 2, position: 'relative', flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
            borderTop: '5px solid var(--cp-email-color, #4A7A9A)',
          }} />
        </div>
      );
    default:
      return <TypeDot color={color} />;
  }
}

function TypeDot({ color }: { color: string }) {
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />;
}
