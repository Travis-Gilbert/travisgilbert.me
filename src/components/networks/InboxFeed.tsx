'use client';

import { useState, useEffect, useCallback } from 'react';
import CaptureBar from './CaptureBar';
import NodeCard from './NodeCard';
import QuickFilterPills from './QuickFilterPills';
import type { FilterValue } from './QuickFilterPills';
import { fetchNodes } from '@/lib/networks';
import type { NodeListItem } from '@/lib/networks';

/**
 * InboxFeed: the main content area of the Networks home page.
 *
 * Composes: CaptureBar (top), QuickFilterPills (below), and a grid of
 * NodeCards. Fetches nodes client-side with the active filter applied.
 */
export default function InboxFeed() {
  const [nodes, setNodes] = useState<NodeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterValue>('inbox');

  const loadNodes = useCallback(async () => {
    setIsLoading(true);

    const params: {
      status?: string;
      type?: string;
      starred?: boolean;
    } = {};

    if (activeFilter === 'inbox') {
      params.status = 'inbox';
    } else if (activeFilter === 'starred') {
      params.starred = true;
    } else if (typeof activeFilter === 'object') {
      params.type = activeFilter.type;
    }
    // 'all' sends no filters

    const result = await fetchNodes(params);
    setNodes(result.results);
    setIsLoading(false);
  }, [activeFilter]);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  const handleCapture = useCallback(() => {
    // After a successful capture, reload the inbox
    loadNodes();
  }, [loadNodes]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      {/* CaptureBar */}
      <div style={{ marginBottom: 24 }}>
        <CaptureBar onCapture={handleCapture} />
      </div>

      {/* Filter pills */}
      <div style={{ marginBottom: 20 }}>
        <QuickFilterPills
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </div>

      {/* Feed header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--nw-font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--nw-text-faint)',
          }}
        >
          {isLoading
            ? 'Loading...'
            : `${nodes.length} node${nodes.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Node grid */}
      {isLoading ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : nodes.length === 0 ? (
        <EmptyState activeFilter={activeFilter} />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {nodes.map((node) => (
            <NodeCard key={node.id} node={node} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Loading skeleton
   ───────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div
      className="nw-node-card"
      style={{ minHeight: 72, opacity: 0.4 }}
    >
      <div
        style={{
          width: '40%',
          height: 12,
          backgroundColor: 'var(--nw-surface-hover)',
          borderRadius: 4,
          marginBottom: 8,
        }}
      />
      <div
        style={{
          width: '70%',
          height: 10,
          backgroundColor: 'var(--nw-surface-hover)',
          borderRadius: 4,
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Empty state
   ───────────────────────────────────────────────── */

function EmptyState({ activeFilter }: { activeFilter: FilterValue }) {
  let message = 'No nodes yet. Use the capture bar above to add your first thought.';

  if (activeFilter === 'starred') {
    message = 'No starred nodes. Star a node to see it here.';
  } else if (activeFilter === 'inbox') {
    message = 'Inbox is empty. Capture a URL or thought above.';
  } else if (typeof activeFilter === 'object') {
    message = `No ${activeFilter.type} nodes found.`;
  }

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px 24px',
        color: 'var(--nw-text-faint)',
        fontFamily: 'var(--nw-font-body)',
        fontSize: 14,
      }}
    >
      {message}
    </div>
  );
}
