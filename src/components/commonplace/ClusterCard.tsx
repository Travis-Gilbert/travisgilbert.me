'use client';

import { getObjectTypeIdentity } from '@/lib/commonplace';
import { type RenderableObject } from './objects/ObjectRenderer';

interface ClusterCardProps {
  clusterKey: string;
  label: string;
  color?: string;
  summary?: string;
  memberCount: number;
  members: RenderableObject[];
  selected?: boolean;
  onSelectCluster?: (clusterKey: string) => void;
  onOpenObject?: (obj: RenderableObject) => void;
  onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
}

export default function ClusterCard({
  clusterKey,
  label,
  color,
  summary,
  memberCount,
  members,
  selected = false,
  onSelectCluster,
  onOpenObject,
  onContextMenu,
}: ClusterCardProps) {
  const preview = members.slice(0, 3);
  const surfaceTone = color ? `${color}06` : 'rgba(112, 80, 160, 0.04)';
  const surfaceEnd = color ? `${color}02` : 'rgba(112, 80, 160, 0.01)';
  const borderTone = color ? `${color}1A` : 'rgba(112, 80, 160, 0.14)';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectCluster?.(clusterKey)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectCluster?.(clusterKey);
        }
      }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 208,
        background: `linear-gradient(180deg, ${surfaceTone} 0%, ${surfaceEnd} 80%)`,
        border: selected ? `1px solid ${color ?? 'var(--cp-red-line)'}` : `1px solid ${borderTone}`,
        borderRadius: 7,
        padding: '14px 16px 13px',
        cursor: 'pointer',
        transition: 'border-color 140ms ease, background 140ms ease',
      }}
    >
      {/* Gradient top bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: `linear-gradient(90deg, ${color ?? 'var(--cp-purple)'}, ${color ?? 'var(--cp-purple)'}40, transparent)`,
      }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 7,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 8.5,
            fontWeight: 700,
            color: color ?? 'var(--cp-purple)',
            background: color ? `${color}0C` : 'rgba(112, 80, 160, 0.06)',
            borderRadius: 3,
            padding: '2px 6px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Cluster
        </span>
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 8.5,
            fontWeight: 700,
            color: '#fff',
            background: 'var(--cp-green, #6AAA6A)',
            borderRadius: 3,
            padding: '2px 6px',
            letterSpacing: '0.06em',
          }}
        >
          {memberCount} objects
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--cp-text)',
          lineHeight: 1.18,
          marginBottom: 8,
          fontFeatureSettings: 'var(--cp-kern-title)',
        }}
      >
        {label}
      </div>
      {summary && (
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12.5,
            color: 'var(--cp-text-muted)',
            lineHeight: 1.55,
            marginBottom: 12,
            maxWidth: '38ch',
            flex: 1,
          }}
        >
          {summary}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 'auto' }}>
        {preview.map((obj) => {
          const identity = getObjectTypeIdentity(obj.object_type_slug);
          return (
            <button
              type="button"
              key={obj.slug}
              onClick={(event) => { event.stopPropagation(); onOpenObject?.(obj); }}
              onContextMenu={(event) => { event.stopPropagation(); onContextMenu?.(event, obj); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: 'var(--cp-font-body)',
                fontSize: 11,
                color: 'var(--cp-text)',
                background: `${identity?.color ?? 'var(--cp-text-faint)'}0C`,
                border: `1px solid ${identity?.color ?? 'var(--cp-text-faint)'}18`,
                borderRadius: 100,
                padding: '3px 10px',
                cursor: 'pointer',
              }}
            >
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: identity?.color ?? 'var(--cp-text-faint)',
                flexShrink: 0,
              }} />
              {obj.display_title ?? obj.title}
            </button>
          );
        })}
        {memberCount > 3 && (
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              color: 'var(--cp-text-faint)',
              alignSelf: 'center',
              marginLeft: 2,
            }}
          >
            +{memberCount - 3} more
          </span>
        )}
      </div>
    </div>
  );
}
