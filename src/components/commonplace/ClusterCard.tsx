'use client';

import ObjectRenderer, { type RenderableObject } from './objects/ObjectRenderer';

interface ClusterCardProps {
  label: string;
  memberCount: number;
  members: RenderableObject[];
  onOpenObject?: (objectRef: number) => void;
}

export default function ClusterCard({
  label,
  memberCount,
  members,
  onOpenObject,
}: ClusterCardProps) {
  const preview = members.slice(0, 3);

  return (
    <div
      style={{
        background: 'var(--cp-surface)',
        border: '1px solid var(--cp-border)',
        borderTop: '2px solid var(--cp-accent)',
        borderRadius: '0 0 5px 5px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--cp-border)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--cp-text)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            color: 'var(--cp-text-faint)',
            fontFeatureSettings: 'var(--cp-kern-mono)',
          }}
        >
          {memberCount}
        </span>
      </div>
      <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {preview.map((obj) => (
          <ObjectRenderer
            key={obj.id}
            object={obj}
            compact
            onClick={onOpenObject ? (o) => onOpenObject(o.id) : undefined}
          />
        ))}
        {memberCount > 3 && (
          <div
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              color: 'var(--cp-text-faint)',
              textAlign: 'center',
              padding: '3px 0',
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
