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

function ChainArrow() {
  return (
    <svg
      width={24}
      height={12}
      viewBox="0 0 24 12"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, marginInline: 2 }}
    >
      <line x1={0} y1={6} x2={16} y2={6} stroke="var(--cp-border)" strokeWidth={1} />
      <polyline
        points="12,2 17,6 12,10"
        stroke="var(--cp-chrome-dim)"
        strokeWidth={1}
        fill="none"
      />
    </svg>
  );
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
      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            overflowX: 'auto',
            paddingBottom: 4,
            paddingRight: 56,
            scrollbarWidth: 'none',
          }}
        >
          {chain.map((node, i) => {
            const clusterColor = clusterColorMap?.get(node.id);
            return (
              <div
                key={`${node.slug}-${node.id}`}
                style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                <div style={{ position: 'relative' }}>
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
                {i < chain.length - 1 && <ChainArrow />}
              </div>
            );
          })}
        </div>
        {/* Right fade overlay */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 56, zIndex: 2,
          background: 'linear-gradient(270deg, var(--cp-bg), transparent)',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}
