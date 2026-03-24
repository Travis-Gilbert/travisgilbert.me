'use client';

import { getObjectTypeIdentity } from '@/lib/commonplace';
import type { RenderableObject } from '../../objects/ObjectRenderer';
import RoughBox from '@/components/rough/RoughBox';
import { timeAgo, countWords, truncate, hexToRgb } from './library-data';

interface ResumeZoneProps {
  lastEdited?: RenderableObject | null;
  recentActivity?: RenderableObject[];
  onOpenObject?: (objectRef: number) => void;
}

export default function ResumeZone({
  lastEdited,
  recentActivity = [],
  onOpenObject,
}: ResumeZoneProps) {
  if (!lastEdited && recentActivity.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <RoughBox
        variant="dark"
        tint="terracotta"
        roughness={1.0}
        strokeWidth={0.8}
        elevated
        hover={false}
        padding={0}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              lastEdited && recentActivity.length > 0
                ? '1fr 260px'
                : '1fr',
            gap: 0,
          }}
        >
          {/* Left panel: last edited object */}
          {lastEdited && (
            <LeftPanel
              object={lastEdited}
              onOpenObject={onOpenObject}
            />
          )}

          {/* Right panel: activity feed */}
          {recentActivity.length > 0 && (
            <RightPanel
              items={recentActivity}
              showDivider={!!lastEdited}
              onOpenObject={onOpenObject}
            />
          )}
        </div>
      </RoughBox>
    </div>
  );
}

/* ── Left panel: pick up where you left off ── */

function LeftPanel({
  object,
  onOpenObject,
}: {
  object: RenderableObject;
  onOpenObject?: (objectRef: number) => void;
}) {
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const wordCount = object.body ? countWords(object.body) : 0;

  return (
    <button
      type="button"
      onClick={() => onOpenObject?.(object.id)}
      className="cp-resume-left-panel"
      style={{
        all: 'unset',
        cursor: 'pointer',
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(180,90,45,0.03)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Section label + type tag row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9.5,
            fontWeight: 600,
            color: '#B45A2D',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Pick up where you left off
        </span>
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 8.5,
            color: identity.color,
            opacity: 0.6,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {identity.label}
        </span>
      </div>

      {/* Title */}
      <h3
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: 18,
          fontWeight: 700,
          color: '#2A2520',
          margin: '0 0 6px',
          lineHeight: 1.25,
        }}
      >
        {object.display_title ?? object.title}
      </h3>

      {/* Body preview */}
      {object.body && (
        <p
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 13,
            fontWeight: 300,
            color: '#5C554D',
            lineHeight: 1.55,
            margin: '0 0 12px',
          }}
        >
          {truncate(object.body, 180)}
        </p>
      )}

      {/* Metadata row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9.5,
          color: '#8A8279',
          marginTop: 'auto',
        }}
      >
        {wordCount > 0 && <span>{wordCount} words</span>}
        {object.captured_at && (
          <>
            {wordCount > 0 && <span className="cp-meta-sep" />}
            <span>{timeAgo(object.captured_at)}</span>
          </>
        )}
        {(object.edge_count ?? 0) > 0 && (
          <>
            <span className="cp-meta-sep" />
            <span>
              {object.edge_count} connection{object.edge_count !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
    </button>
  );
}

/* ── Right panel: while you were away ── */

function RightPanel({
  items,
  showDivider,
  onOpenObject,
}: {
  items: RenderableObject[];
  showDivider: boolean;
  onOpenObject?: (objectRef: number) => void;
}) {
  return (
    <div
      style={{
        padding: '18px 18px',
        borderLeft: showDivider ? '1px solid rgba(0,0,0,0.08)' : undefined,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9.5,
          fontWeight: 600,
          color: '#2D5F6B',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          display: 'block',
          marginBottom: 12,
        }}
      >
        While you were away
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => {
          const identity = getObjectTypeIdentity(item.object_type_slug);
          const rgb = hexToRgb(identity.color);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenObject?.(item.id)}
              style={{
                all: 'unset',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                cursor: 'pointer',
              }}
            >
              {/* Type dot with halo */}
              <div
                className="cp-type-halo"
                style={{
                  width: 16,
                  height: 16,
                  background: `radial-gradient(circle, rgba(${rgb},0.19) 0%, transparent 70%)`,
                  marginTop: 1,
                }}
              >
                <span
                  className="cp-type-halo-dot"
                  style={{ width: 5, height: 5, background: identity.color }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--cp-font-body)',
                    fontSize: 12,
                    fontWeight: 400,
                    color: '#4A4540',
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.display_title ?? item.title}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 9,
                    color: '#8A8279',
                    display: 'flex',
                    gap: 6,
                    marginTop: 1,
                  }}
                >
                  <span style={{ color: '#5D9B78' }}>
                    {(item.edge_count ?? 0) > 0
                      ? `${item.edge_count} connection${item.edge_count !== 1 ? 's' : ''}`
                      : 'Captured'}
                  </span>
                  {item.captured_at && <span>{timeAgo(item.captured_at)}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
