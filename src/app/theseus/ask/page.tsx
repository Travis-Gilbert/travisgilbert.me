'use client';

/**
 * Theseus ask page.
 *
 * Split layout: text answer (left), 3D evidence scene (right).
 * Click nodes in the scene for detail. Type follow-ups in the
 * search bar. Results build on previous context.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  askTheseus,
  extractNarrative,
  extractEvidencePath,
  extractObjects,
  extractTensionItems,
  fetchObjectDetail,
  buildFollowUpQuery,
  type AskResponse,
  type EvidenceNode,
  type ObjectDetail,
  type ObjectItem,
} from '@/lib/theseus-api';

// Dynamic import: R3F needs client-side only
const SceneRenderer = dynamic(
  () => import('@/components/theseus/SceneRenderer'),
  { ssr: false, loading: () => <ScenePlaceholder /> },
);

const T = {
  bg: '#0f1012',
  card: '#1a1b1f',
  text: '#e8e5e0',
  textMuted: '#9a958d',
  textDim: '#5c5851',
  teal: '#2D5F6B',
  tealLight: '#4A8A96',
  amber: '#C49A4A',
  terra: '#C4503C',
  purple: '#7B5EA7',
  border: 'rgba(255,255,255,0.06)',
  mono: "'Courier Prime', monospace",
  body: "'IBM Plex Sans', sans-serif",
  title: "'Vollkorn', serif",
} as const;

function ScenePlaceholder() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: T.bg,
        fontFamily: T.mono,
        fontSize: 12,
        color: T.textDim,
      }}
    >
      Loading 3D scene...
    </div>
  );
}

/* ── Confidence bar ── */

function DualBar({ evidence, tension }: { evidence: number; tension: number }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontFamily: T.mono, fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: T.textDim }}>evidence</span>
        <div style={{ width: 60, height: 4, background: '#1a1b1f', borderRadius: 2 }}>
          <div
            style={{
              width: `${evidence}%`,
              height: '100%',
              background: T.tealLight,
              borderRadius: 2,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
        <span style={{ color: T.tealLight }}>{evidence}%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: T.textDim }}>tension</span>
        <div style={{ width: 60, height: 4, background: '#1a1b1f', borderRadius: 2 }}>
          <div
            style={{
              width: `${tension}%`,
              height: '100%',
              background: tension > 50 ? T.terra : T.amber,
              borderRadius: 2,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
        <span style={{ color: tension > 50 ? T.terra : T.amber }}>{tension}%</span>
      </div>
    </div>
  );
}

/* ── Node detail panel ── */

function NodeDetailPanel({
  node,
  detail,
  loading,
  onFollowUp,
  onClose,
}: {
  node: EvidenceNode;
  detail: ObjectDetail | null;
  loading: boolean;
  onFollowUp: (query: string) => void;
  onClose: () => void;
}) {
  const typeColor =
    node.type === 'source'
      ? T.teal
      : node.type === 'concept'
        ? T.purple
        : node.type === 'person'
          ? T.terra
          : node.type === 'hunch'
            ? T.amber
            : T.textMuted;

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 320,
        background: T.card,
        borderLeft: `1px solid ${T.border}`,
        padding: 20,
        overflowY: 'auto',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              color: typeColor,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 4,
            }}
          >
            {node.type} / {node.role}
          </div>
          <h3 style={{ fontFamily: T.title, fontSize: 16, fontWeight: 600, margin: 0 }}>
            {node.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: T.textDim,
            cursor: 'pointer',
            fontSize: 18,
            padding: 4,
          }}
        >
          x
        </button>
      </div>

      {loading && (
        <p style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim }}>
          Loading detail...
        </p>
      )}

      {detail && (
        <>
          {detail.body && (
            <div
              style={{
                fontFamily: T.body,
                fontSize: 13,
                color: T.textMuted,
                lineHeight: 1.6,
                maxHeight: 200,
                overflow: 'hidden',
              }}
            >
              {detail.body.slice(0, 500)}
              {detail.body.length > 500 && '...'}
            </div>
          )}

          {detail.connections.length > 0 && (
            <div>
              <h4
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  color: T.textDim,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                }}
              >
                Connections ({detail.connections.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {detail.connections.slice(0, 8).map((c) => (
                  <div
                    key={c.edge_id}
                    style={{
                      fontFamily: T.body,
                      fontSize: 12,
                      color: T.textMuted,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{c.connected_object.title.slice(0, 30)}</span>
                    <span style={{ color: T.textDim, fontFamily: T.mono, fontSize: 10 }}>
                      {Math.round(c.strength * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Follow-up button */}
      <button
        onClick={() =>
          onFollowUp(buildFollowUpQuery('', { title: node.title, object_type: node.type }))
        }
        style={{
          marginTop: 'auto',
          padding: '10px 16px',
          background: T.teal,
          border: 'none',
          borderRadius: 8,
          color: T.text,
          fontFamily: T.mono,
          fontSize: 12,
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        Ask about "{node.title.slice(0, 25)}..."
      </button>
    </div>
  );
}

/* ── Objects list (below text answer) ── */

function ObjectsList({ objects }: { objects: ObjectItem[] }) {
  if (objects.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <h4
        style={{
          fontFamily: T.mono,
          fontSize: 11,
          color: T.textDim,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Sources ({objects.length})
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {objects.slice(0, 8).map((obj) => {
          const typeColor =
            obj.object_type === 'source'
              ? T.teal
              : obj.object_type === 'concept'
                ? T.purple
                : obj.object_type === 'person'
                  ? T.terra
                  : T.textMuted;
          return (
            <div
              key={obj.id}
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 6,
                border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: typeColor,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontFamily: T.body, fontSize: 13, color: T.text }}>
                  {obj.title.slice(0, 60)}
                </span>
                <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 10, color: T.textDim }}>
                  {Math.round(obj.score * 100)}%
                </span>
              </div>
              {obj.snippet && (
                <p style={{ fontFamily: T.body, fontSize: 12, color: T.textMuted, margin: 0 }}>
                  {obj.snippet.slice(0, 120)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main page ── */

export default function TheseusAskPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [currentQuery, setCurrentQuery] = useState(initialQuery);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Node selection
  const [selectedNode, setSelectedNode] = useState<EvidenceNode | null>(null);
  const [nodeDetail, setNodeDetail] = useState<ObjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const runQuery = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedNode(null);
    setNodeDetail(null);
    setCurrentQuery(q);

    try {
      const result = await askTheseus(q);
      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  // Run initial query
  useEffect(() => {
    if (initialQuery) runQuery(initialQuery);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load node detail on selection
  useEffect(() => {
    if (!selectedNode) {
      setNodeDetail(null);
      return;
    }
    setDetailLoading(true);
    fetchObjectDetail(selectedNode.object_id)
      .then(setNodeDetail)
      .catch(() => setNodeDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedNode]);

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.replace(`/theseus/ask?q=${encodeURIComponent(trimmed)}`, { scroll: false });
    runQuery(trimmed);
  };

  const handleFollowUp = (followUpQuery: string) => {
    setQuery(followUpQuery);
    router.replace(`/theseus/ask?q=${encodeURIComponent(followUpQuery)}`, { scroll: false });
    runQuery(followUpQuery);
  };

  const narrative = response ? extractNarrative(response) : null;
  const evidencePath = response ? extractEvidencePath(response) : null;
  const objects = response ? extractObjects(response) : [];
  const tensions = response ? extractTensionItems(response) : [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Query bar */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Ask a follow-up..."
          style={{
            flex: 1,
            padding: '10px 14px',
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            color: T.text,
            fontFamily: T.body,
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !query.trim()}
          style={{
            padding: '10px 20px',
            background: T.teal,
            border: 'none',
            borderRadius: 8,
            color: T.text,
            fontFamily: T.mono,
            fontSize: 12,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: '12px 24px',
            background: 'rgba(196,80,60,0.1)',
            borderBottom: `1px solid ${T.border}`,
            fontFamily: T.mono,
            fontSize: 12,
            color: T.terra,
          }}
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: `2px solid ${T.border}`,
              borderTopColor: T.teal,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim }}>
            Searching {currentQuery ? `"${currentQuery.slice(0, 40)}"` : ''}...
          </p>
        </div>
      )}

      {/* Results: split layout */}
      {response && !loading && (
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: evidencePath ? '1fr 1fr' : '1fr',
            minHeight: 0,
          }}
        >
          {/* Left: text answer */}
          <div
            style={{
              padding: 24,
              overflowY: 'auto',
              borderRight: evidencePath ? `1px solid ${T.border}` : 'none',
            }}
          >
            {/* Confidence */}
            <div style={{ marginBottom: 16 }}>
              <DualBar
                evidence={response.confidence.evidence}
                tension={response.confidence.tension}
              />
            </div>

            {/* Traversal info */}
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 10,
                color: T.textDim,
                marginBottom: 16,
                display: 'flex',
                gap: 12,
              }}
            >
              <span>searched {response.traversal.objects_searched} objects</span>
              <span>{response.traversal.clusters_touched} clusters</span>
              <span>{response.traversal.time_ms}ms</span>
              <span>signals: {response.traversal.signals_used.join(', ')}</span>
            </div>

            {/* Narrative answer */}
            {narrative && (
              <div
                style={{
                  fontFamily: T.body,
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: T.text,
                  marginBottom: 24,
                }}
              >
                {narrative}
              </div>
            )}

            {/* Tensions */}
            {tensions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    color: T.terra,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Tensions ({tensions.length})
                </h4>
                {tensions.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(196,80,60,0.05)',
                      borderRadius: 6,
                      border: `1px solid rgba(196,80,60,0.15)`,
                      marginBottom: 6,
                      fontSize: 12,
                      color: T.textMuted,
                    }}
                  >
                    <span style={{ color: T.terra, fontWeight: 500 }}>
                      {t.nli_label}
                    </span>
                    : {t.claim_a.text.slice(0, 80)} vs. {t.claim_b.text.slice(0, 80)}
                  </div>
                ))}
              </div>
            )}

            {/* Objects list */}
            <ObjectsList objects={objects} />

            {/* Follow-up suggestions */}
            {response.follow_ups.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    color: T.textDim,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Follow up
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {response.follow_ups.map((fu, i) => (
                    <button
                      key={i}
                      onClick={() => handleFollowUp(fu.query)}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        fontFamily: T.body,
                        fontSize: 12,
                        color: T.textMuted,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {fu.query}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: 3D scene */}
          {evidencePath && (
            <div style={{ position: 'relative', minHeight: 400 }}>
              <Suspense fallback={<ScenePlaceholder />}>
                <SceneRenderer
                  evidence={evidencePath}
                  onSelectNode={(node) => setSelectedNode(node)}
                  selectedNodeId={selectedNode?.object_id ?? null}
                />
              </Suspense>

              {/* Node detail panel (overlays scene) */}
              {selectedNode && (
                <NodeDetailPanel
                  node={selectedNode}
                  detail={nodeDetail}
                  loading={detailLoading}
                  onFollowUp={handleFollowUp}
                  onClose={() => setSelectedNode(null)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
