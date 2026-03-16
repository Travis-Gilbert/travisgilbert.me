'use client';

import { useMemo, useState } from 'react';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { type RenderableObject } from './objects/ObjectRenderer';
import ClusterGraphWindow from './ClusterGraphWindow';

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

    // Find dominant type
    let dominantType = '';
    let dominantCount = 0;
    for (const [slug, count] of typeCounts) {
      if (count > dominantCount) {
        dominantType = slug;
        dominantCount = count;
      }
    }

    const typeDistribution = Array.from(typeCounts.entries())
      .map(([slug, count]) => `${count} ${getObjectTypeIdentity(slug).label.toLowerCase()}`)
      .join(', ');

    // Edge count per member for the member list
    const memberEdgeCounts = new Map<number, number>();
    for (const edge of edges) {
      memberEdgeCounts.set(edge.from, (memberEdgeCounts.get(edge.from) ?? 0) + 1);
      memberEdgeCounts.set(edge.to, (memberEdgeCounts.get(edge.to) ?? 0) + 1);
    }

    return {
      edgeCount,
      density,
      dominantType: getObjectTypeIdentity(dominantType).label.toLowerCase(),
      typeDistribution,
      memberEdgeCounts,
    };
  }, [members, edges, memberCount]);

  // Gradient intensity scales with member count
  const barOpacity = Math.min(0.5 + memberCount * 0.1, 1);

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
        width: '100%',
        background: 'var(--cp-card)',
        border: selected ? `1px solid ${accentColor}` : `1px solid ${borderTone}`,
        borderRadius: 7,
        cursor: 'pointer',
        transition: 'border-color 140ms ease',
      }}
    >
      {/* 1. Top gradient accent bar */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, ${accentColor}, ${accentColor}40, transparent)`,
        opacity: barOpacity,
      }} />

      {/* 2. Graph window (fixed height for uniform cards) */}
      <ClusterGraphWindow
        members={members}
        edges={edges}
        color={accentColor}
        height={140}
      />

      {/* 3. Title + description on vellum surface */}
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

      {/* 4. Terminal block with tabbed content */}
      <ClusterTerminal
        memberCount={memberCount}
        terminalData={terminalData}
        members={members}
        onOpenObject={onOpenObject}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}

type TerminalTab = 'analysis' | 'members';

const TAB_STYLE: React.CSSProperties = {
  fontFamily: 'var(--cp-font-mono)',
  fontSize: 9,
  background: 'transparent',
  border: 'none',
  padding: '3px 6px',
  cursor: 'pointer',
  letterSpacing: '0.02em',
};

/** Tabbed terminal: tabs replace the title bar */
function ClusterTerminal({
  memberCount,
  terminalData,
  members,
  onOpenObject,
  onContextMenu,
}: {
  memberCount: number;
  terminalData: {
    edgeCount: number;
    density: string;
    dominantType: string;
    typeDistribution: string;
    memberEdgeCounts: Map<number, number>;
  };
  members: RenderableObject[];
  onOpenObject?: (obj: RenderableObject) => void;
  onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
}) {
  const [tab, setTab] = useState<TerminalTab>('analysis');

  return (
    <div style={{
      position: 'relative',
      background: 'var(--cp-term)',
      borderTop: '1px solid var(--cp-term-border)',
      overflow: 'hidden',
    }}>
      {/* Tab bar (replaces TerminalBlock title) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: '0 10px',
        borderBottom: '1px solid var(--cp-term-border)',
      }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: 'var(--cp-term-green)',
          flexShrink: 0,
          marginRight: 6,
        }} />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setTab('analysis'); }}
          style={{
            ...TAB_STYLE,
            color: tab === 'analysis' ? 'var(--cp-term-text)' : 'var(--cp-term-muted)',
            borderBottom: tab === 'analysis' ? '1px solid var(--cp-term-text)' : '1px solid transparent',
            marginBottom: -1,
          }}
        >
          analysis
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setTab('members'); }}
          style={{
            ...TAB_STYLE,
            color: tab === 'members' ? 'var(--cp-term-text)' : 'var(--cp-term-muted)',
            borderBottom: tab === 'members' ? '1px solid var(--cp-term-text)' : '1px solid transparent',
            marginBottom: -1,
          }}
        >
          members ({memberCount})
        </button>
      </div>

      {/* Tab content */}
      <div style={{ padding: '6px 10px' }}>
        {tab === 'analysis' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TerminalRow label="members" value={String(memberCount)} />
            <TerminalRow label="edges" value={String(terminalData.edgeCount)} />
            <TerminalRow label="density" value={terminalData.density} />
            <TerminalRow label="dominant" value={terminalData.dominantType} />
            <TerminalRow label="types" value={terminalData.typeDistribution} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {members.map((member) => {
              const identity = getObjectTypeIdentity(member.object_type_slug);
              const ec = terminalData.memberEdgeCounts.get(member.id) ?? 0;
              return (
                <button
                  type="button"
                  key={member.slug}
                  onClick={(event) => { event.stopPropagation(); onOpenObject?.(member); }}
                  onContextMenu={(event) => { event.stopPropagation(); onContextMenu?.(event, member); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'transparent',
                    border: 'none',
                    padding: '1px 0',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <span style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: identity.color,
                    flexShrink: 0,
                  }} />
                  <span style={{
                    flex: 1,
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 10,
                    color: 'var(--cp-term-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {member.display_title ?? member.title}
                  </span>
                  {ec > 0 && (
                    <span style={{
                      fontFamily: 'var(--cp-font-mono)',
                      fontSize: 9,
                      color: 'var(--cp-term-muted)',
                      flexShrink: 0,
                    }}>
                      {ec}e
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact inline terminal row: label and value adjacent with fixed-width label */
function TerminalRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: 0,
      lineHeight: 1.5,
    }}>
      <span style={{
        fontFamily: 'var(--cp-font-mono)',
        fontSize: 10,
        color: 'var(--cp-term-muted)',
        width: 64,
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--cp-font-mono)',
        fontSize: 10,
        color: 'var(--cp-term-text)',
      }}>
        {value}
      </span>
    </div>
  );
}
