'use client';

/**
 * ResearchSummary: bar charts and content listing for the Paper Trails page.
 *
 * Horizontal bars break down sources by type and by role.
 * Content listing shows essays/field notes sorted by connection count.
 * Data from fetchSourceGraph() (same endpoint as SourceGraph, different view).
 */

import { useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import Link from 'next/link';
import { fetchSourceGraph } from '@/lib/research';
import type { GraphResponse } from '@/lib/research';
import { SOURCE_COLORS, NODE_COLORS, ROLE_COLORS } from '@/lib/graph/colors';

export default function ResearchSummary() {
  const [data, setData] = useState<GraphResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchSourceGraph().then((res) => {
      setData(res);
      setLoaded(true);
    });
  }, []);

  /* ── Aggregate: source counts by type ──────────────── */

  const sourcesByType = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    data.nodes
      .filter((n) => n.type === 'source' && n.sourceType)
      .forEach((n) => {
        const t = n.sourceType!;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      });
    return [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  /* ── Aggregate: edge counts by role ────────────────── */

  const edgesByRole = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    data.edges.forEach((e) => {
      counts.set(e.role, (counts.get(e.role) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  /* ── Content nodes sorted by connection count ──────── */

  const contentNodes = useMemo(() => {
    if (!data) return [];
    const degreeMap = new Map<string, number>();
    data.edges.forEach((e) => {
      degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
      degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
    });
    return data.nodes
      .filter((n) => n.type === 'essay' || n.type === 'field_note')
      .map((n) => ({ ...n, degree: degreeMap.get(n.id) ?? 0 }))
      .sort((a, b) => b.degree - a.degree);
  }, [data]);

  /* ── Loading state ─────────────────────────────────── */

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-ink-light font-mono text-xs uppercase tracking-[0.08em]">
        Loading summary...
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <p className="text-ink-light text-sm font-body-alt">
        No research data available yet.
      </p>
    );
  }

  const maxSourceCount = d3.max(sourcesByType, (d) => d.count) ?? 1;
  const maxRoleCount = d3.max(edgesByRole, (d) => d.count) ?? 1;

  return (
    <div className="grid gap-8">
      {/* Sources by type */}
      <section>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-3">
          Sources by Type
        </h3>
        <div className="grid gap-1.5">
          {sourcesByType.map(({ type, count }) => (
            <BarRow
              key={type}
              label={type}
              count={count}
              maxCount={maxSourceCount}
              color={SOURCE_COLORS[type] ?? '#6A5E52'}
            />
          ))}
        </div>
      </section>

      {/* Edges by role */}
      <section>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-3">
          Connections by Role
        </h3>
        <div className="grid gap-1.5">
          {edgesByRole.map(({ role, count }) => (
            <BarRow
              key={role}
              label={role}
              count={count}
              maxCount={maxRoleCount}
              color={ROLE_COLORS[role] ?? '#6A5E52'}
            />
          ))}
        </div>
      </section>

      {/* Content listing */}
      <section>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-3">
          Content by Connections ({contentNodes.length})
        </h3>
        <div className="grid gap-1">
          {contentNodes.map((n) => {
            const typeLabel = n.type === 'field_note' ? 'field note' : n.type;
            const color = NODE_COLORS[n.type === 'field_note' ? 'field-note' : n.type] ?? '#6A5E52';
            const href =
              n.type === 'essay'
                ? `/on/${n.slug}`
                : n.type === 'field_note'
                  ? `/field-notes/${n.slug}`
                  : '#';

            return (
              <Link
                key={n.id}
                href={href}
                className="group no-underline flex items-center gap-3 rounded px-2 py-1.5 hover:bg-surface-elevated/50 transition-colors"
              >
                <span
                  className="shrink-0 w-2 h-2 rounded-full"
                  style={{ backgroundColor: color, opacity: 0.7 }}
                />
                <span className="font-title text-sm text-ink group-hover:text-ink leading-tight flex-1 min-w-0 truncate">
                  {n.label}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint whitespace-nowrap">
                  {n.degree} · {typeLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ── Bar row sub-component ──────────────────────────────────── */

function BarRow({
  label,
  count,
  maxCount,
  color,
}: {
  label: string;
  count: number;
  maxCount: number;
  color: string;
}) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint w-24 text-right shrink-0">
        {label}
      </span>
      <div className="flex-1 h-4 rounded overflow-hidden bg-surface-elevated/30">
        <div
          className="h-full rounded transition-[width] duration-300 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            opacity: 0.55,
          }}
        />
      </div>
      <span className="font-mono text-[10px] text-ink-faint w-8 text-right shrink-0">
        {count}
      </span>
    </div>
  );
}
