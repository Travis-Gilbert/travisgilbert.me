'use client';

/**
 * ReaderPanelEngine: right sliding panel with Claims, Entities,
 * and Graph tabs.
 *
 * Width: 256px when open, 0 when closed.
 * Data source: ApiObjectDetail's object_claims, components, edges.
 */

import { useMemo, useState } from 'react';
import type { ApiObjectDetail, ApiObjectClaim, ApiEdgeCompact, ApiComponent } from '@/lib/commonplace';
import {
  CLAIM_STATUS_COLORS,
  ENTITY_KIND_COLORS,
  EDGE_TYPE_COLORS,
} from './reader-data';

/* ─────────────────────────────────────────────────
   Props
   ───────────────────────────────────────────────── */

interface ReaderPanelEngineProps {
  open: boolean;
  detail: ApiObjectDetail | null;
  onScrollToParagraph?: (paragraphId: string) => void;
}

/* ─────────────────────────────────────────────────
   Entity extraction from components
   ───────────────────────────────────────────────── */

interface EntityEntry {
  id: number;
  value: string;
  kind: string;
  mentions: number;
}

function extractEntities(components: ApiComponent[]): EntityEntry[] {
  const entityTypes = ['person', 'place', 'org', 'organization', 'entity', 'concept'];
  const entityComponents = components.filter((c) => {
    const name = c.component_type_name.toLowerCase();
    return entityTypes.some((t) => name.includes(t));
  });

  // Group by value to count mentions
  const grouped = new Map<string, EntityEntry>();
  for (const c of entityComponents) {
    const key = c.value.toLowerCase();
    const existing = grouped.get(key);
    if (existing) {
      existing.mentions += 1;
    } else {
      // Derive kind from component type name
      const name = c.component_type_name.toLowerCase();
      let kind = 'entity';
      if (name.includes('person')) kind = 'person';
      else if (name.includes('place')) kind = 'place';
      else if (name.includes('org')) kind = 'org';
      else if (name.includes('concept')) kind = 'concept';

      grouped.set(key, {
        id: c.id,
        value: c.value,
        kind,
        mentions: 1,
      });
    }
  }

  return Array.from(grouped.values());
}

/* ─────────────────────────────────────────────────
   Tab: Claims
   ───────────────────────────────────────────────── */

function ClaimsTab({ claims }: { claims: ApiObjectClaim[] }) {
  if (claims.length === 0) {
    return <EmptyState label="No claims extracted" />;
  }

  return (
    <>
      {claims.map((cl) => {
        const color = CLAIM_STATUS_COLORS[cl.status] || 'var(--r-text-faint)';
        return (
          <div
            key={cl.id}
            className="reader-engine-card"
            style={{ borderLeft: `3px solid ${color}` }}
          >
            <div className="reader-engine-card-status" style={{ color }}>
              {cl.status}
            </div>
            <div className="reader-engine-card-text">{cl.text}</div>
            {cl.confidence > 0 && (
              <div className="reader-engine-card-sub">
                {Math.round(cl.confidence * 100)}% confidence
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ─────────────────────────────────────────────────
   Tab: Entities
   ───────────────────────────────────────────────── */

function EntitiesTab({ entities }: { entities: EntityEntry[] }) {
  if (entities.length === 0) {
    return <EmptyState label="No entities found" />;
  }

  return (
    <>
      {entities.map((en) => {
        const color = ENTITY_KIND_COLORS[en.kind] || 'var(--r-text-faint)';
        return (
          <div key={en.id} className="reader-entity-row">
            <div className="reader-entity-dot" style={{ background: color }} />
            <div style={{ flex: 1 }}>
              <div className="reader-entity-name">{en.value}</div>
              <div className="reader-entity-meta">
                {en.kind} &middot; {en.mentions}x
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ─────────────────────────────────────────────────
   Tab: Graph (connections + tensions)
   ───────────────────────────────────────────────── */

function GraphTab({ edges }: { edges: ApiEdgeCompact[] }) {
  const connections = edges.filter((e) => e.edge_type !== 'contradicts');
  const tensions = edges.filter((e) => e.edge_type === 'contradicts');

  if (connections.length === 0 && tensions.length === 0) {
    return <EmptyState label="No connections found" />;
  }

  return (
    <>
      {connections.map((cn) => {
        const color = EDGE_TYPE_COLORS[cn.edge_type] || 'var(--r-text-faint)';
        return (
          <div key={cn.id} className="reader-entity-row" style={{ cursor: 'pointer' }}>
            <div className="reader-entity-dot" style={{ background: color }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="reader-entity-name"
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {cn.other_title}
              </div>
              <div className="reader-entity-meta">
                {cn.edge_type} &middot; {Math.round(cn.strength * 100)}%
              </div>
            </div>
          </div>
        );
      })}

      {tensions.length > 0 && (
        <>
          <div className="reader-tension-label">Tensions</div>
          {tensions.map((t) => (
            <div
              key={t.id}
              className="reader-engine-card"
              style={{ borderLeft: '3px solid var(--r-red)' }}
            >
              <div className="reader-engine-card-text">{t.reason || t.other_title}</div>
              <div
                className="reader-engine-card-sub"
                style={{ fontStyle: 'italic', marginTop: 3 }}
              >
                vs. {t.other_title}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────
   Empty state
   ───────────────────────────────────────────────── */

function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--r-font-ui)',
        fontSize: 11,
        color: 'var(--r-text-ghost)',
        textAlign: 'center',
        padding: '24px 12px',
      }}
    >
      {label}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────── */

type EngineTab = 'claims' | 'entities' | 'graph';

export default function ReaderPanelEngine({
  open,
  detail,
}: ReaderPanelEngineProps) {
  const [activeTab, setActiveTab] = useState<EngineTab>('claims');

  const claims = useMemo(
    () => detail?.object_claims || [],
    [detail?.object_claims],
  );

  const entities = useMemo(
    () => (detail ? extractEntities(detail.components) : []),
    [detail],
  );

  const edges = useMemo(
    () => detail?.edges || [],
    [detail?.edges],
  );

  const tabs: { id: EngineTab; label: string; count: number }[] = [
    { id: 'claims', label: 'Claims', count: claims.length },
    { id: 'entities', label: 'Entities', count: entities.length },
    { id: 'graph', label: 'Graph', count: edges.length },
  ];

  return (
    <div className={`reader-panel-right${open ? ' open' : ''}`}>
      <div className="reader-panel-right-inner">
        {/* Tabs */}
        <div className="reader-engine-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`reader-engine-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span className="tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="reader-engine-content">
          {activeTab === 'claims' && <ClaimsTab claims={claims} />}
          {activeTab === 'entities' && <EntitiesTab entities={entities} />}
          {activeTab === 'graph' && <GraphTab edges={edges} />}
        </div>
      </div>
    </div>
  );
}
