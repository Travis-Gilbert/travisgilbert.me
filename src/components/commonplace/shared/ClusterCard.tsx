'use client';

import { useMemo, useState } from 'react';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { type RenderableObject } from '../objects/ObjectRenderer';
import ClusterGraphWindow from './ClusterGraphWindow';

// ─── Tooltip ────────────────────────────────────────────────────

function NodeTooltip({
  member,
  position,
  edges,
  color,
}: {
  member: RenderableObject;
  position: { x: number; y: number };
  edges: Array<{ from: number; to: number }>;
  color: string;
}) {
  const connectionCount = edges.filter(
    (e) => e.from === member.id || e.to === member.id,
  ).length;
  const identity = getObjectTypeIdentity(member.object_type_slug);

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x + 14,
        top: position.y - 10,
        zIndex: 1000,
        background: 'var(--cp-surface, #2c2c30)',
        border: `1px solid ${color}40`,
        borderRadius: 5,
        padding: '6px 10px',
        pointerEvents: 'none',
        maxWidth: 220,
        boxShadow: 'var(--cp-shadow-lg, 0 4px 20px rgba(0,0,0,0.5))',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--cp-text)',
          lineHeight: 1.2,
          marginBottom: 3,
        }}
      >
        {member.display_title ?? member.title}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          color: 'var(--cp-text-muted)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: identity.color,
            }}
          />
          {identity.label}
        </span>
        <span style={{ color: 'var(--cp-chrome-muted)' }}>|</span>
        <span>
          {connectionCount} connection{connectionCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

// ─── Types ──────────────────────────────────────────────────────

interface ClusterCardProps {
  clusterKey: string;
  label: string;
  color?: string;
  summary?: string;
  memberCount: number;
  members: RenderableObject[];
  edges?: Array<{ from: number; to: number }>;
  selected?: boolean;
  onSelectCluster?: (clusterKey: string) => void;
  onOpenObject?: (obj: RenderableObject) => void;
  onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
}

// ─── ClusterCard ────────────────────────────────────────────────

export default function ClusterCard({
  clusterKey,
  label,
  color,
  summary,
  memberCount,
  members,
  edges = [],
  selected = false,
  onSelectCluster,
  onOpenObject,
  onContextMenu,
}: ClusterCardProps) {
  const borderTone = color ? `${color}1A` : 'rgba(112, 80, 160, 0.14)';
  const accentColor = color ?? 'var(--cp-purple)';

  // Hover state for graph interaction
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    member: RenderableObject;
    position: { x: number; y: number };
  } | null>(null);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  // Compute terminal metadata
  const terminalData = useMemo(() => {
    const edgeCount = edges.length;
    const maxPossible = memberCount * (memberCount - 1) / 2;
    const density = maxPossible > 0 ? (edgeCount / maxPossible).toFixed(2) : '0.00';

    // Type distribution
    const typeCounts = new Map<string, number>();
    for (const m of members) {
      const slug = m.object_type_slug;
      typeCounts.set(slug, (typeCounts.get(slug) ?? 0) + 1);
    }

    // Find hub (highest edge count member)
    const memberEdgeCounts = new Map<number, number>();
    for (const edge of edges) {
      memberEdgeCounts.set(edge.from, (memberEdgeCounts.get(edge.from) ?? 0) + 1);
      memberEdgeCounts.set(edge.to, (memberEdgeCounts.get(edge.to) ?? 0) + 1);
    }

    let hubId: number | null = null;
    let hubDeg = 0;
    for (const [id, deg] of memberEdgeCounts) {
      if (deg > hubDeg) {
        hubDeg = deg;
        hubId = id;
      }
    }
    const hub = hubId != null ? members.find((m) => m.id === hubId) : null;

    // Type breakdown sorted by count
    const typeBreakdown = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([slug, count]) => ({
        slug,
        count,
        identity: getObjectTypeIdentity(slug),
      }));

    return {
      edgeCount,
      density,
      typeBreakdown,
      hub,
      hubDeg,
      memberEdgeCounts,
    };
  }, [members, edges, memberCount]);

  // Gradient intensity scales with member count
  const barOpacity = Math.min(0.5 + memberCount * 0.1, 1);

  return (
    <>
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
          width: '100%',
          background: 'var(--cp-card)',
          border: selected ? `1px solid ${accentColor}` : `1px solid ${borderTone}`,
          borderRadius: 7,
          cursor: 'pointer',
          transition: 'border-color 140ms ease, box-shadow 200ms ease',
          boxShadow: selected
            ? `0 0 0 1px ${accentColor}40, 0 2px 12px ${accentColor}10`
            : 'none',
        }}
      >
        {/* 1. Top gradient accent bar */}
        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}40, transparent)`,
            opacity: barOpacity,
          }}
        />

        {/* 2. Graph window with force-directed layout */}
        <div style={{ padding: '2px 0', background: 'rgba(0,0,0,0.08)' }}>
          <ClusterGraphWindow
            members={members}
            edges={edges}
            color={accentColor}
            width={340}
            height={220}
            hoveredId={hoveredId}
            onHoverNode={(id, e) => {
              setHoveredId(id);
              const member = memberMap.get(id);
              if (member) {
                setTooltip({
                  member,
                  position: { x: e.clientX, y: e.clientY },
                });
              }
            }}
            onClickNode={(id) => {
              const m = memberMap.get(id);
              if (m) onOpenObject?.(m);
            }}
            onLeaveNode={() => {
              setHoveredId(null);
              setTooltip(null);
            }}
          />
        </div>

        {/* 3. Title + description */}
        <div style={{ padding: '8px 10px', flex: 1 }}>
          <div
            style={{
              fontFamily: 'var(--cp-font-title)',
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--cp-text)',
              lineHeight: 1.18,
              fontFeatureSettings: 'var(--cp-kern-title)',
            }}
          >
            {label}
          </div>
          {summary && (
            <div
              style={{
                fontFamily: 'var(--cp-font-body)',
                fontSize: 12,
                color: 'var(--cp-text-muted)',
                lineHeight: 1.5,
                marginTop: 3,
                maxWidth: '38ch',
              }}
            >
              {summary}
            </div>
          )}
        </div>

        {/* 4. Annotation bar (replaces old terminal analysis tab) */}
        <AnnotationBar
          memberCount={memberCount}
          edgeCount={terminalData.edgeCount}
          density={terminalData.density}
          typeBreakdown={terminalData.typeBreakdown}
          hub={terminalData.hub}
          hubDeg={terminalData.hubDeg}
          color={accentColor}
        />

        {/* 5. Terminal with member list */}
        <ClusterTerminal
          memberCount={memberCount}
          terminalData={terminalData}
          members={members}
          hoveredId={hoveredId}
          onHoverMember={setHoveredId}
          onOpenObject={onOpenObject}
          onContextMenu={onContextMenu}
        />
      </div>

      {/* Tooltip portal (rendered outside card's overflow:hidden) */}
      {tooltip && (
        <NodeTooltip
          member={tooltip.member}
          position={tooltip.position}
          edges={edges}
          color={accentColor}
        />
      )}
    </>
  );
}

// ─── Annotation Bar ─────────────────────────────────────────────

function AnnotationBar({
  memberCount,
  edgeCount,
  density,
  typeBreakdown,
  hub,
  hubDeg,
  color,
}: {
  memberCount: number;
  edgeCount: number;
  density: string;
  typeBreakdown: Array<{
    slug: string;
    count: number;
    identity: { label: string; color: string };
  }>;
  hub: RenderableObject | null | undefined;
  hubDeg: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        padding: '6px 10px 8px',
        borderTop: `1px solid ${color}18`,
        background: 'rgba(0,0,0,0.15)',
      }}
    >
      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          color: 'var(--cp-text-muted)',
        }}
      >
        <span>
          <span style={{ color: 'var(--cp-text)', fontWeight: 600 }}>{memberCount}</span>{' '}
          nodes
        </span>
        <span>
          <span style={{ color: 'var(--cp-text)', fontWeight: 600 }}>{edgeCount}</span>{' '}
          edges
        </span>
        <span>
          d:{' '}
          <span style={{ color, fontWeight: 600 }}>{density}</span>
        </span>
      </div>

      {/* Type breakdown pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {typeBreakdown.map(({ slug, count, identity }) => (
          <span
            key={slug}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              color: 'var(--cp-text-muted)',
              background: `${identity.color}15`,
              padding: '1px 5px',
              borderRadius: 3,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: identity.color,
                flexShrink: 0,
              }}
            />
            {identity.label.toLowerCase()} {count}
          </span>
        ))}
      </div>

      {/* Hub indicator */}
      {hub && (
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            color: 'var(--cp-chrome-muted)',
          }}
        >
          hub:{' '}
          <span style={{ color: 'var(--cp-text-muted)' }}>
            {hub.display_title ?? hub.title}
          </span>
          <span style={{ color, marginLeft: 4 }}>({hubDeg})</span>
        </div>
      )}
    </div>
  );
}

// ─── Terminal ───────────────────────────────────────────────────

const TAB_STYLE: React.CSSProperties = {
  fontFamily: 'var(--cp-font-mono)',
  fontSize: 9,
  background: 'transparent',
  border: 'none',
  padding: '3px 6px',
  cursor: 'pointer',
  letterSpacing: '0.02em',
};

function ClusterTerminal({
  memberCount,
  terminalData,
  members,
  hoveredId,
  onHoverMember,
  onOpenObject,
  onContextMenu,
}: {
  memberCount: number;
  terminalData: {
    edgeCount: number;
    density: string;
    typeBreakdown: Array<{
      slug: string;
      count: number;
      identity: { label: string; color: string };
    }>;
    hub: RenderableObject | null | undefined;
    hubDeg: number;
    memberEdgeCounts: Map<number, number>;
  };
  members: RenderableObject[];
  hoveredId: number | null;
  onHoverMember: (id: number | null) => void;
  onOpenObject?: (obj: RenderableObject) => void;
  onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
}) {
  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--cp-term)',
        borderTop: '1px solid var(--cp-term-border)',
        overflow: 'hidden',
        /* Re-establish light text for dark terminal surface */
        ['--cp-text' as string]: '#F4F3F0',
        ['--cp-text-muted' as string]: '#C0BDB5',
        ['--cp-text-faint' as string]: '#8A8478',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '0 10px',
          borderBottom: '1px solid var(--cp-term-border)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--cp-term-green)',
            flexShrink: 0,
            marginRight: 6,
          }}
        />
        <span
          style={{
            ...TAB_STYLE,
            color: 'var(--cp-term-text)',
            borderBottom: '1px solid var(--cp-term-text)',
            marginBottom: -1,
          }}
        >
          members ({memberCount})
        </span>
      </div>

      {/* Member list (height-capped, no scroll) */}
      <div style={{ padding: '6px 10px', maxHeight: 200, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {members.map((member) => {
            const identity = getObjectTypeIdentity(member.object_type_slug);
            const isHovered = hoveredId === member.id;
            return (
              <span
                key={member.slug}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  color: isHovered ? 'var(--cp-text)' : 'var(--cp-text-muted)',
                  background: isHovered ? `${identity.color}25` : 'transparent',
                  padding: '2px 6px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  transition: 'all 100ms',
                }}
                onMouseEnter={() => onHoverMember(member.id)}
                onMouseLeave={() => onHoverMember(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenObject?.(member);
                }}
                onContextMenu={(e) => {
                  e.stopPropagation();
                  onContextMenu?.(e, member);
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: identity.color,
                  }}
                />
                {member.display_title ?? member.title}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
