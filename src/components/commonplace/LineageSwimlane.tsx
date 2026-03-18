'use client';

import type { MockNode, LineageResponse } from '@/lib/commonplace';
import ObjectRenderer, { type RenderableObject } from './objects/ObjectRenderer';
import { renderableFromMockNode } from './objectRenderables';

interface LineageSwimlaneProps {
  nodes: MockNode[];
  lineageData?: LineageResponse | null;
  clusterColorMap?: Map<number, string>;
  onOpenObject?: (objectRef: number) => void;
  onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
}

export default function LineageSwimlane({
  nodes,
  lineageData,
  clusterColorMap,
  onOpenObject,
  onContextMenu,
}: LineageSwimlaneProps) {
  const chain: RenderableObject[] =
    lineageData
      ? [
          ...lineageData.ancestors.slice(0, 3).map((n) => ({
            id: n.id,
            slug: n.slug,
            title: n.title,
            display_title: n.title,
            object_type_slug: n.object_type_slug,
          })),
          {
            id: lineageData.object.id,
            slug: lineageData.object.slug,
            title: lineageData.object.title,
            display_title: lineageData.object.title,
            object_type_slug: lineageData.object.object_type_slug,
          },
          ...lineageData.descendants.slice(0, 3).map((n) => ({
            id: n.id,
            slug: n.slug,
            title: n.title,
            display_title: n.title,
            object_type_slug: n.object_type_slug,
          })),
        ]
      : nodes.slice(0, 7).map(renderableFromMockNode);

  if (chain.length === 0) return null;

  return (
    <div style={{ padding: '10px 0 4px', marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 8.5,
            fontWeight: 700,
            color: 'var(--cp-red)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Influence Chain
        </span>
        <span
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 11,
            color: 'var(--cp-text-faint)',
          }}
        >
          How recent captures are cohering into a thread
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 10,
          paddingBottom: 4,
        }}
      >
        {chain.map((node, i) => {
          const clusterColor = clusterColorMap?.get(node.id);
          return (
            <div
              key={`${node.slug}-${node.id}`}
              style={{ display: 'flex', alignItems: 'center', flex: '1 1 0', minWidth: 0 }}
            >
              <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
                <ObjectRenderer
                  object={node}
                  compact
                  variant="chain"
                  onClick={(obj) => onOpenObject?.(obj.id)}
                  onContextMenu={onContextMenu}
                />
                {clusterColor && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 4, right: 4, height: 2,
                    borderRadius: 1, background: clusterColor, opacity: 0.3,
                  }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
