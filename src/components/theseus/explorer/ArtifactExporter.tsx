'use client';

import { useCallback, useState } from 'react';
import type Graph from 'graphology';
import type { TheseusResponse, InvestigationView, ArtifactMeta } from '@/lib/theseus-types';
import { createArtifact } from '@/lib/theseus-api';

type ArtifactType = ArtifactMeta['artifact_type'];

interface ArtifactExporterProps {
  response: TheseusResponse;
  graph: Graph;
  activeView: InvestigationView;
}

const ARTIFACT_DESCRIPTIONS: Record<ArtifactType, string> = {
  evidence_map: 'How Theseus found the answer',
  tension_report: 'Where sources disagree',
  hypothesis_doc: 'What the graph structure suggests',
  knowledge_diff: 'What changed over time',
};

/**
 * ArtifactExporter: button group in the ControlDock area for saving
 * graph+answer snapshots as shareable artifacts.
 */
export default function ArtifactExporter({ response, graph, activeView }: ArtifactExporterProps) {
  const [saving, setSaving] = useState(false);
  const [savedArtifact, setSavedArtifact] = useState<ArtifactMeta | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Determine available artifact types based on response content
  const availableTypes: ArtifactType[] = ['evidence_map'];

  const hasTensions = response.sections.some(
    (s) => s.type === 'tension' || s.type === 'truth_map',
  );
  if (hasTensions) availableTypes.push('tension_report');

  const hasHypotheses = response.sections.some(
    (s) => s.type === 'hypothesis',
  );
  if (hasHypotheses) availableTypes.push('hypothesis_doc');

  const handleSave = useCallback(async (artifactType: ArtifactType) => {
    setSaving(true);
    setDropdownOpen(false);

    // Serialize graph state
    const graphSnapshot: Record<string, unknown> = {
      nodes: graph.mapNodes((node, attrs) => ({
        id: node,
        ...attrs,
        x: attrs.x,
        y: attrs.y,
      })),
      edges: graph.mapEdges((edge, attrs, source, target) => ({
        id: edge,
        source,
        target,
        ...attrs,
      })),
    };

    const result = await createArtifact({
      artifact_type: artifactType,
      title: `${artifactType.replace(/_/g, ' ')}: ${response.query.slice(0, 80)}`,
      query: response.query,
      response_snapshot: response as unknown as Record<string, unknown>,
      graph_snapshot: graphSnapshot,
    });

    if (result.ok) {
      setSavedArtifact(result);
    }
    setSaving(false);
  }, [graph, response]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  // Saved confirmation view
  if (savedArtifact) {
    return (
      <div className="explorer-artifact-confirm" style={confirmStyle}>
        <div style={{ fontSize: 11, fontFamily: 'var(--vie-font-mono)', color: 'var(--vie-ink-2)', marginBottom: 8 }}>
          Artifact saved
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => handleCopy(savedArtifact.share_url)}
            style={actionBtnStyle}
          >
            Copy Link
          </button>
          <button
            type="button"
            onClick={() => handleCopy(savedArtifact.embed_html)}
            style={actionBtnStyle}
          >
            Copy Embed
          </button>
          <button
            type="button"
            onClick={() => setSavedArtifact(null)}
            style={{ ...actionBtnStyle, color: 'var(--vie-ink-3)' }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {availableTypes.length === 1 ? (
        <button
          type="button"
          className="explorer-dock-pill"
          onClick={() => handleSave('evidence_map')}
          disabled={saving}
          style={{ opacity: saving ? 0.5 : 1 }}
        >
          {saving ? 'Saving...' : 'Save Evidence Map'}
        </button>
      ) : (
        <>
          <button
            type="button"
            className="explorer-dock-pill"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Artifact'}
          </button>

          {dropdownOpen && (
            <div style={dropdownStyle}>
              {availableTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSave(type)}
                  style={dropdownItemStyle}
                >
                  <span style={{ fontWeight: 500 }}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--vie-ink-3)', display: 'block', marginTop: 2 }}>
                    {ARTIFACT_DESCRIPTIONS[type]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const confirmStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--vie-panel-bg, #242220)',
  border: '1px solid var(--vie-border)',
  borderRadius: 6,
};

const actionBtnStyle: React.CSSProperties = {
  background: 'var(--vie-teal-ghost, rgba(74, 138, 150, 0.12))',
  color: 'var(--vie-teal-ink, #4A8A96)',
  border: 'none',
  borderRadius: 4,
  padding: '4px 10px',
  fontSize: 11,
  fontFamily: 'var(--vie-font-mono, monospace)',
  cursor: 'pointer',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  right: 0,
  marginBottom: 4,
  background: 'var(--vie-panel-bg, #242220)',
  border: '1px solid var(--vie-border)',
  borderRadius: 6,
  overflow: 'hidden',
  minWidth: 220,
  zIndex: 40,
};

const dropdownItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 14px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 12,
  color: 'var(--vie-ink-1, #F4F3F0)',
  fontFamily: 'var(--vie-font-sans, sans-serif)',
};
