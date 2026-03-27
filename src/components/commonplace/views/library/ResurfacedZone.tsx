'use client';

import type { ApiResurfaceCard } from '@/lib/commonplace';
import { renderableFromResurfaceCard } from '../../objectRenderables';
import ObjectRow from '../../shared/ObjectRow';

interface ResurfacedZoneProps {
  cards?: ApiResurfaceCard[];
  onOpenObject?: (objectRef: number) => void;
}

export default function ResurfacedZone({ cards, onOpenObject }: ResurfacedZoneProps) {
  if (!cards || cards.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.7px',
          textTransform: 'uppercase' as const,
          color: 'rgba(26, 24, 22, 0.28)',
        }}>
          Resurfaced
        </span>
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          fontWeight: 400,
          letterSpacing: '0.7px',
          textTransform: 'uppercase' as const,
          color: 'rgba(26, 24, 22, 0.18)',
        }}>
          Engine chose these for review
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {cards.map((card) => {
          const obj = renderableFromResurfaceCard(card);
          const edgeCount = obj.edge_count ?? 0;
          const statusText = edgeCount > 0
            ? `${edgeCount} connection${edgeCount !== 1 ? 's' : ''} found`
            : 'Waiting for connections';
          return (
            <ObjectRow
              key={card.object.slug}
              object={obj}
              onOpenObject={onOpenObject}
              statusText={statusText}
              statusColor={edgeCount > 0 ? 'rgba(45, 95, 107, 0.5)' : 'rgba(180, 90, 45, 0.5)'}
            />
          );
        })}
      </div>
    </div>
  );
}
