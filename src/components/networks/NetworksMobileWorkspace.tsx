'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import InboxFeed from './InboxFeed';
import NodeCard from './NodeCard';
import { fetchNodes, type NodeListItem } from '@/lib/networks';
import { useNetworksShell } from './NetworksShellContext';

const LazyGraphView = dynamic(() => import('@/components/research/SourceGraph'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: '20px 18px', color: 'var(--nw-text-faint)', fontFamily: 'var(--nw-font-mono)', fontSize: 12 }}>
      Loading graph view...
    </div>
  ),
});

export default function NetworksMobileWorkspace() {
  const { isMobile, activeTab } = useNetworksShell();

  if (!isMobile) {
    return <InboxFeed />;
  }

  if (activeTab === 'graph') {
    return (
      <div style={{ padding: '14px 12px 6px' }}>
        <LazyGraphView />
      </div>
    );
  }

  if (activeTab === 'search') {
    return <NetworksSearchView />;
  }

  return <InboxFeed compactMobile />;
}

function NetworksSearchView() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<NodeListItem[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(async () => {
      const response = await fetchNodes({ q: trimmed });
      setResults(response.results);
      setLoading(false);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [query]);

  const emptyMessage = useMemo(() => {
    if (query.trim().length < 2) return 'Type at least 2 characters to search.';
    if (loading) return 'Searching...';
    if (results.length === 0) return 'No nodes found.';
    return '';
  }, [loading, query, results.length]);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '18px 14px 28px' }}>
      <label
        htmlFor="networks-search-input"
        style={{
          display: 'block',
          marginBottom: 8,
          fontFamily: 'var(--nw-font-mono)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--nw-text-faint)',
        }}
      >
        Search Nodes
      </label>
      <input
        id="networks-search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search title, source, or note"
        className="nw-capture-input"
        style={{
          borderRadius: 10,
          border: '1px solid var(--nw-border)',
          background: 'var(--nw-surface)',
          minHeight: 46,
          fontSize: 16,
          marginBottom: 14,
        }}
      />

      {emptyMessage && (
        <p
          style={{
            marginTop: 4,
            color: 'var(--nw-text-faint)',
            fontFamily: 'var(--nw-font-body)',
            fontSize: 14,
          }}
        >
          {emptyMessage}
        </p>
      )}

      {results.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {results.map((node) => (
            <NodeCard key={node.id} node={node} />
          ))}
        </div>
      )}
    </div>
  );
}
