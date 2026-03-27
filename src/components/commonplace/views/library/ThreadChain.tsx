'use client';

import { useMemo } from 'react';
import type { MockNode, LineageResponse } from '@/lib/commonplace';
import type { RenderableObject } from '../../objects/ObjectRenderer';
import ObjectRow from '../../shared/ObjectRow';

interface ThreadChainProps {
  nodes?: MockNode[];
  lineageData?: LineageResponse | null;
  onOpenObject?: (objectRef: number) => void;
}

export default function ThreadChain({
  nodes,
  lineageData,
  onOpenObject,
}: ThreadChainProps) {
  const chain = useMemo<RenderableObject[]>(() => {
    if (!nodes || nodes.length === 0) return [];

    const result: RenderableObject[] = [];

    // Current node: the first in feed (most recent capture)
    const current = nodes[0];
    result.push({
      id: current.objectRef,
      slug: current.objectSlug || String(current.objectRef),
      title: current.title,
      display_title: current.title,
      object_type_slug: current.objectType,
      captured_at: current.capturedAt || undefined,
      edge_count: current.edgeCount,
    });

    // Ancestors from lineage data, or fallback to next feed nodes
    if (lineageData?.ancestors?.length) {
      for (const ancestor of lineageData.ancestors.slice(0, 3)) {
        result.push({
          id: ancestor.id,
          slug: ancestor.slug || String(ancestor.id),
          title: ancestor.title,
          display_title: ancestor.title,
          object_type_slug: ancestor.object_type_slug,
        });
      }
    } else {
      for (const node of nodes.slice(1, 4)) {
        result.push({
          id: node.objectRef,
          slug: node.objectSlug || String(node.objectRef),
          title: node.title,
          display_title: node.title,
          object_type_slug: node.objectType,
          captured_at: node.capturedAt || undefined,
          edge_count: node.edgeCount,
        });
      }
    }

    return result.slice(0, 4);
  }, [nodes, lineageData]);

  if (chain.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.7px',
          textTransform: 'uppercase' as const,
          color: 'rgba(26, 24, 22, 0.28)',
        }}>
          Recent Thread
        </span>
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          fontWeight: 400,
          letterSpacing: '0.7px',
          textTransform: 'uppercase' as const,
          color: 'rgba(26, 24, 22, 0.18)',
        }}>
          How recent captures connect
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {chain.map((obj, i) => (
          <ObjectRow
            key={`${obj.id}-${i}`}
            object={obj}
            onOpenObject={onOpenObject}
          />
        ))}
      </div>
    </div>
  );
}
