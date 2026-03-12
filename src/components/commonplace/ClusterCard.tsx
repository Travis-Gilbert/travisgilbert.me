'use client';

import ObjectRenderer, { type RenderableObject } from './objects/ObjectRenderer';

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
  const surfaceTone = color ? `${color}08` : 'rgba(112, 80, 160, 0.06)';
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
        display: 'flex',
        flexDirection: 'column',
        minHeight: 208,
        background: `linear-gradient(180deg, ${surfaceTone}, rgba(255,255,255,0.62) 34%)`,
        border: selected ? `1px solid ${color ?? 'var(--cp-red-line)'}` : `1px solid ${borderTone}`,
        borderRadius: 6,
        padding: '14px 16px 13px',
        boxShadow: 'none',
        cursor: 'pointer',
        transition: 'border-color 140ms ease, background 140ms ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
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
            fontSize: 9,
            color: color ? `${color}` : 'var(--cp-green)',
            fontFeatureSettings: 'var(--cp-kern-mono)',
            letterSpacing: '0.03em',
          }}
        >
          {memberCount} objects
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: 15,
          fontWeight: 600,
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
        {preview.map((obj) => (
          <div
            key={obj.slug}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <ObjectRenderer
              object={obj}
              compact
              variant="chip"
              onClick={onOpenObject}
              onContextMenu={onContextMenu}
            />
          </div>
        ))}
        {memberCount > 3 && (
          <div
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              color: 'var(--cp-text-faint)',
              alignSelf: 'center',
              marginLeft: 2,
              fontFeatureSettings: 'var(--cp-kern-mono)',
            }}
          >
            +{memberCount - 3} more
          </div>
        )}
      </div>
    </div>
  );
}
