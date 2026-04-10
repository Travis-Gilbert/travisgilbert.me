'use client';

import type { ConnectionResult } from '@/lib/theseus-types';

const SIGNAL_LABELS: Record<string, string> = {
  bm25: 'BM25',
  sbert: 'SBERT',
  entity: 'ENTITY',
  nli: 'NLI',
  kge: 'KGE',
  gnn: 'GNN',
  analogy: 'ANALOGY',
};

function typeColor(objectType: string): string {
  switch (objectType) {
    case 'source': return 'var(--vie-type-source)';
    case 'concept': return 'var(--vie-type-concept)';
    case 'person': return 'var(--vie-type-person)';
    case 'hunch': return 'var(--vie-type-hunch)';
    default: return 'var(--vie-type-note)';
  }
}

interface ConnectionListProps {
  connections: ConnectionResult[];
  onSelectNode: (nodeId: string) => void;
}

export default function ConnectionList({ connections, onSelectNode }: ConnectionListProps) {
  if (connections.length === 0) {
    return <p className="explorer-panel-empty">No connections found for this object.</p>;
  }

  return (
    <div className="explorer-connection-list">
      {connections.map((conn) => (
        <button
          key={conn.edge_id}
          type="button"
          className="explorer-connection-row"
          onClick={() => onSelectNode(conn.connected_object.id)}
        >
          {/* Type dot */}
          <span
            className="explorer-connection-dot"
            style={{ background: typeColor(conn.connected_object.object_type) }}
          />

          {/* Title */}
          <span className="explorer-connection-title">
            {conn.connected_object.title}
          </span>

          {/* Signal + strength */}
          <span className="explorer-connection-meta">
            <span className="explorer-connection-signal">
              {SIGNAL_LABELS[conn.signal_type] ?? conn.signal_type.toUpperCase()}
            </span>
            <span className="explorer-connection-bar">
              <span
                className="explorer-connection-bar-fill"
                style={{ width: `${Math.round(conn.strength * 100)}%` }}
              />
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
