/**
 * HierarchyTree — collapsible tree renderer reading
 * `visual.structured.root: { id, label, children?[], linked_evidence? }`.
 *
 * Uses a simple CSS-grid tree layout rather than d3.tree() to stay
 * dependency-free and match the editorial aesthetic. For a richer
 * layout, route through d3-pro in a follow-up batch.
 */

'use client';

import type { FC } from 'react';
import { useMemo } from 'react';
import type { StructuredVisual, StructuredVisualRegion } from '@/lib/theseus-types';

interface HierarchyNode {
  id: string;
  label: string;
  children: HierarchyNode[];
  linked_evidence?: string[];
}

interface HierarchyTreeProps {
  visual: StructuredVisual;
  onRegionHover?: (region: StructuredVisualRegion | null) => void;
  onRegionSelect?: (region: StructuredVisualRegion) => void;
}

function parseNode(raw: unknown, fallbackIdx: number): HierarchyNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const id = typeof rec.id === 'string' ? rec.id : `h-${fallbackIdx}`;
  const label = typeof rec.label === 'string' ? rec.label : '';
  if (label.length === 0) return null;
  const childArray = Array.isArray(rec.children) ? rec.children : [];
  const children: HierarchyNode[] = [];
  for (let i = 0; i < childArray.length; i++) {
    const parsed = parseNode(childArray[i], i);
    if (parsed) children.push(parsed);
  }
  const linked = Array.isArray(rec.linked_evidence) ? rec.linked_evidence.map(String) : undefined;
  return { id, label, children, linked_evidence: linked };
}

function NodeRow({
  node,
  depth,
  onRegionHover,
}: {
  node: HierarchyNode;
  depth: number;
  onRegionHover?: (region: StructuredVisualRegion | null) => void;
}) {
  const hasLinked = node.linked_evidence && node.linked_evidence.length > 0;
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          paddingLeft: depth * 18,
          paddingTop: 4,
          paddingBottom: 4,
          cursor: hasLinked ? 'pointer' : 'default',
          borderLeft: depth > 0 ? '1px solid color-mix(in srgb, var(--color-ink) 15%, transparent)' : 'none',
        }}
        onMouseEnter={() => {
          if (!onRegionHover || !hasLinked) return;
          onRegionHover({
            id: node.id,
            label: node.label,
            x: depth,
            y: 0,
            width: 1,
            height: 1,
            linked_evidence: node.linked_evidence,
          });
        }}
        onMouseLeave={() => onRegionHover?.(null)}
      >
        <span
          aria-hidden
          style={{
            fontFamily: 'var(--font-metadata)',
            color: 'var(--color-ink-muted)',
            fontSize: 10,
            marginRight: 8,
          }}
        >
          {node.children.length > 0 ? '▸' : '·'}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--color-ink)',
          }}
        >
          {node.label}
        </span>
      </div>
      {node.children.map((child) => (
        <NodeRow key={child.id} node={child} depth={depth + 1} onRegionHover={onRegionHover} />
      ))}
    </>
  );
}

const HierarchyTree: FC<HierarchyTreeProps> = ({ visual, onRegionHover }) => {
  const root = useMemo(() => parseNode(visual.structured?.root, 0), [visual.structured]);
  if (!root) return null;

  return (
    <div
      style={{
        background: 'var(--color-paper, #fdfbf6)',
        border: '1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)',
        borderRadius: 6,
        padding: 16,
        boxShadow: 'var(--shadow-warm-sm)',
      }}
    >
      <NodeRow node={root} depth={0} onRegionHover={onRegionHover} />
    </div>
  );
};

export default HierarchyTree;
