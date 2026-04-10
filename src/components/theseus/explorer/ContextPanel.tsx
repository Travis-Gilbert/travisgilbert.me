'use client';

import { useCallback, useEffect, useState } from 'react';
import { getObject, getObjectConnections, getObjectClaims, getObjectTensions } from '@/lib/theseus-api';
import type { TheseusObject, ConnectionResult, ClaimResult, TensionResult } from '@/lib/theseus-types';
import ConnectionList from './ConnectionList';
import TensionCard from './TensionCard';
import ClaimRow from './ClaimRow';
import NeighborhoodSummary from './NeighborhoodSummary';

type ContextTab = 'overview' | 'evidence' | 'tensions' | 'claims';

interface ContextPanelProps {
  nodeId: string | null;
  onClose: () => void;
  onSelectNode?: (nodeId: string) => void;
}

function typeColor(objectType: string): string {
  switch (objectType) {
    case 'source': return 'var(--vie-type-source)';
    case 'concept': return 'var(--vie-type-concept)';
    case 'person': return 'var(--vie-type-person)';
    case 'hunch': return 'var(--vie-type-hunch)';
    default: return 'var(--vie-type-note)';
  }
}

/**
 * ContextPanel: right slide-in panel showing explanation for a selected node.
 *
 * Tabs: Overview, Evidence, Tensions, Claims.
 * Opens automatically when a node is selected, closes on deselect.
 * Wired to real backend data for all tabs.
 */
export default function ContextPanel({ nodeId, onClose, onSelectNode }: ContextPanelProps) {
  const [tab, setTab] = useState<ContextTab>('overview');
  const [object, setObject] = useState<TheseusObject | null>(null);
  const [loading, setLoading] = useState(false);

  // Neighborhood data (fetched lazily per tab, cached per nodeId)
  const [connections, setConnections] = useState<ConnectionResult[]>([]);
  const [claims, setClaims] = useState<ClaimResult[]>([]);
  const [tensions, setTensions] = useState<TensionResult[]>([]);
  const [neighborhoodLoading, setNeighborhoodLoading] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Set<ContextTab>>(new Set());

  const isOpen = nodeId !== null;

  // Fetch object details on node change
  useEffect(() => {
    if (!nodeId) {
      setObject(null);
      setConnections([]);
      setClaims([]);
      setTensions([]);
      setLoadedTabs(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    setTab('overview');
    setLoadedTabs(new Set());

    // Fetch object + neighborhood counts in parallel
    Promise.all([
      getObject(nodeId),
      getObjectConnections(nodeId, 20),
      getObjectClaims(nodeId),
      getObjectTensions(nodeId),
    ]).then(([objResult, connResult, claimResult, tensionResult]) => {
      if (cancelled) return;
      setLoading(false);
      setNeighborhoodLoading(false);

      if (objResult.ok) setObject(objResult);
      if (connResult.ok) {
        setConnections(connResult.connections);
        setLoadedTabs((prev) => new Set([...prev, 'evidence']));
      }
      if (claimResult.ok) {
        setClaims(claimResult.claims);
        setLoadedTabs((prev) => new Set([...prev, 'claims']));
      }
      if (tensionResult.ok) {
        setTensions(tensionResult.tensions);
        setLoadedTabs((prev) => new Set([...prev, 'tensions']));
      }
    });

    setNeighborhoodLoading(true);
    return () => { cancelled = true; };
  }, [nodeId]);

  const handleNavigateTab = useCallback((targetTab: 'evidence' | 'claims' | 'tensions') => {
    setTab(targetTab);
  }, []);

  const handleSelectConnected = useCallback((connectedId: string) => {
    onSelectNode?.(connectedId);
  }, [onSelectNode]);

  const handleAskAbout = useCallback(() => {
    if (!object) return;
    // Navigate to ask view with pre-filled query
    const query = `Tell me about "${object.title}"`;
    window.dispatchEvent(
      new CustomEvent('theseus:navigate-ask', { detail: { query } }),
    );
  }, [object]);

  const activeTensionCount = tensions.filter(
    (t) => t.status === 'active' || t.status === 'open' || t.status === 'investigating',
  ).length;

  return (
    <div className={`explorer-context-panel${isOpen ? ' is-open' : ''}`}>
      {/* Header */}
      <div className="explorer-panel-header">
        <div className="explorer-context-title-row">
          {object && (
            <span
              className="explorer-panel-type-dot"
              style={{ background: typeColor(object.object_type ?? 'note') }}
            />
          )}
          <span className="explorer-panel-title">
            {loading ? 'Loading\u2026' : (object?.title ?? 'Select a node')}
          </span>
        </div>
        <button
          type="button"
          className="explorer-panel-close"
          onClick={onClose}
          aria-label="Close context panel"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="explorer-panel-tabs">
        {(['overview', 'evidence', 'tensions', 'claims'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`explorer-panel-tab${tab === t ? ' is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="explorer-panel-body">
        {tab === 'overview' && object && (
          <div className="explorer-context-overview">
            {/* Type badge + date */}
            <div className="explorer-context-meta">
              <span className="explorer-context-type" style={{ color: typeColor(object.object_type ?? 'note') }}>
                {object.object_type ?? 'note'}
              </span>
              {object.epistemic_role && (
                <span className="explorer-context-role">
                  {object.epistemic_role}
                </span>
              )}
              {object.created_at && (
                <span className="explorer-context-date">
                  {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(object.created_at))}
                </span>
              )}
            </div>

            {/* Summary text */}
            {object.summary && (
              <p className="explorer-context-body">{object.summary}</p>
            )}

            {/* Neighborhood summary (360-degree counts) */}
            <NeighborhoodSummary
              connectionCount={connections.length}
              claimCount={claims.length}
              tensionCount={tensions.length}
              activeTensionCount={activeTensionCount}
              onNavigateTab={handleNavigateTab}
              loading={neighborhoodLoading}
            />

            {/* Ask about this bridge button */}
            <button
              type="button"
              className="explorer-ask-button"
              onClick={handleAskAbout}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 9a3 3 0 115.12 2.12A2 2 0 0012 13v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="12" cy="17" r="1" fill="currentColor" />
              </svg>
              Ask Theseus about this
            </button>
          </div>
        )}

        {tab === 'overview' && !object && !loading && (
          <p className="explorer-panel-empty">Select a node in the graph to inspect it.</p>
        )}

        {tab === 'evidence' && (
          loadedTabs.has('evidence') ? (
            <ConnectionList
              connections={connections}
              onSelectNode={handleSelectConnected}
            />
          ) : (
            <p className="explorer-panel-loading">LOADING CONNECTIONS</p>
          )
        )}

        {tab === 'tensions' && (
          loadedTabs.has('tensions') ? (
            tensions.length > 0 ? (
              <div className="explorer-tension-list">
                {tensions.map((tension) => (
                  <TensionCard key={tension.id} tension={tension} />
                ))}
              </div>
            ) : (
              <p className="explorer-panel-empty">No tensions involving this object.</p>
            )
          ) : (
            <p className="explorer-panel-loading">LOADING TENSIONS</p>
          )
        )}

        {tab === 'claims' && (
          loadedTabs.has('claims') ? (
            claims.length > 0 ? (
              <div className="explorer-claim-list">
                {claims.map((claim) => (
                  <ClaimRow key={claim.id} claim={claim} />
                ))}
              </div>
            ) : (
              <p className="explorer-panel-empty">No claims extracted from this object.</p>
            )
          ) : (
            <p className="explorer-panel-loading">LOADING CLAIMS</p>
          )
        )}
      </div>
    </div>
  );
}
