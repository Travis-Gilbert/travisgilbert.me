'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { computeLensLayout } from './useLensLayout';
import { loadEdgeTypeMeta, type EdgeTypeMeta } from './edgeTypeMeta';
import LensShellRenderer from './LensShellRenderer';
import LensPropertiesStrip from './LensPropertiesStrip';
import LensDossier from './LensDossier';
import LensTimeline from './LensTimeline';
import LensNodeSwitcher from './LensNodeSwitcher';
import {
  lensFocusToLayoutInputs,
  type LensFocusResponse,
} from './lensFocusContract';

/**
 * Tier 2 Lens close-read view (port of references/atlas-lens.jsx).
 *
 * Reads `?node=<id>` from the URL, fetches the lens-focus payload for
 * that node, runs `computeLensLayout` to assign neighbors to the
 * inner / middle / outer shells, and renders the SVG via
 * `LensShellRenderer`.
 *
 * The 4 Tier 3 panel components sit around the SVG canvas:
 *   top-right   : LensNodeSwitcher (derived from lens-focus, no extra fetch)
 *   left strip  : LensPropertiesStrip (from lens-properties/)
 *   right plate : LensDossier (from lens-dossier/)
 *   bottom strip: LensTimeline (from lens-timeline/)
 *
 * Each panel is independently fetched: if one endpoint is slow the
 * rest still render. All fetch helpers share the same cancelled-flag
 * pattern to avoid state updates on unmounted components.
 *
 * The lens-focus endpoint shipped at Index-API commit 9a3e02d with the
 * canonical {focused, neighbors[].edge} shape; the response contract
 * lives in ./lensFocusContract.
 */

// ── Wire types for panel endpoints ──────────────────────────────────────────

// Mirrors apps/notebook/views/_lens_helpers.py:build_properties_payload.
// An earlier version of this type invented `properties: Record<...>`
// and `recent_edits: [...]` fields the backend never emitted, which
// crashed LensPropertiesStrip with `Object.entries(undefined)` on
// every Lens activation.
export interface PropertiesPayload {
  id: number;
  title: string;
  summary: string;
  kind: string;
  source_system: string | null;
  evidence_count: number;
  confidence: number | null;
  kin_count: number;
  anchoring_count: number;
  context_count: number;
  pinned_by: string[];
  last_touched: string | null;
  claims: Array<{ id: number; text: string; confidence: number | null }>;
}

interface DossierPayload {
  title: string;
  summary: string;
  recent_activity: Array<{
    days_ago: number;
    when: string;
    short: string;
    text: string;
    color: string;
  }>;
}

interface TimelinePayload {
  events: Array<{
    days_ago: number;
    when: string;
    short: string;
    text: string;
    color: string;
  }>;
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

// Strip the `object:` namespace prefix the backend's /graph/ endpoint
// ships on every node id. The lens Ninja router lives at
// /api/v2/theseus/lens/{pk}/* (where {pk} is an integer pk), so the
// namespaced form must be stripped to a bare integer string before the
// fetch. The Explorer canvas writes namespaced ids into ?node= via the
// same selectedId / focusedId surface, so this normalization happens
// at the lens fetch boundary rather than at every URL push site.
//
// 2026-04-26: migrated from /api/v1/notebook/objects/{pk}/lens-* DRF
// actions to /api/v2/theseus/lens/{pk}/* Ninja routes per the
// architecture review. Same wire shapes; only the path moved.
function objectPk(nodeId: string): string {
  return nodeId.replace(/^object:/, '');
}

async function fetchLensData(nodeId: string): Promise<LensFocusResponse> {
  const pk = objectPk(nodeId);
  const response = await fetch(`/api/v2/theseus/lens/${pk}/focus/`);
  if (!response.ok) throw new Error(`lens-focus HTTP ${response.status}`);
  return (await response.json()) as LensFocusResponse;
}

async function fetchProperties(nodeId: string): Promise<PropertiesPayload> {
  const pk = objectPk(nodeId);
  const response = await fetch(`/api/v2/theseus/lens/${pk}/properties/`);
  if (!response.ok) throw new Error(`lens-properties HTTP ${response.status}`);
  return (await response.json()) as PropertiesPayload;
}

async function fetchDossier(nodeId: string): Promise<DossierPayload> {
  const pk = objectPk(nodeId);
  const response = await fetch(`/api/v2/theseus/lens/${pk}/dossier/`);
  if (!response.ok) throw new Error(`lens-dossier HTTP ${response.status}`);
  return (await response.json()) as DossierPayload;
}

async function fetchTimeline(nodeId: string): Promise<TimelinePayload> {
  const pk = objectPk(nodeId);
  const response = await fetch(`/api/v2/theseus/lens/${pk}/timeline/`);
  if (!response.ok) throw new Error(`lens-timeline HTTP ${response.status}`);
  return (await response.json()) as TimelinePayload;
}

// ── Outer container layout constants ────────────────────────────────────────

// Grid layout: left strip | SVG canvas | right dossier, timeline below.
// At narrow viewports (<900px) the side panels collapse via CSS media query.
const OUTER_STYLE: React.CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '220px 1fr 340px',
  gridTemplateRows: '1fr auto',
  width: '100%',
  height: '100%',
  minHeight: 0,
};

const SVG_CELL_STYLE: React.CSSProperties = {
  gridColumn: '2',
  gridRow: '1',
  position: 'relative',
  minWidth: 0,
  minHeight: 0,
};

const LEFT_CELL_STYLE: React.CSSProperties = {
  gridColumn: '1',
  gridRow: '1 / span 2',
  overflowY: 'auto',
};

const RIGHT_CELL_STYLE: React.CSSProperties = {
  gridColumn: '3',
  gridRow: '1',
  overflowY: 'auto',
};

const BOTTOM_CELL_STYLE: React.CSSProperties = {
  gridColumn: '2',
  gridRow: '2',
};

const SWITCHER_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  zIndex: 10,
};

export default function LensView() {
  const params = useSearchParams();
  const node = params?.get('node');

  // Celestial chart data (lens-focus)
  const [data, setData] = useState<LensFocusResponse | null>(null);
  const [focusError, setFocusError] = useState<string | null>(null);
  const [edgeTypeMeta, setEdgeTypeMeta] = useState<Map<string, EdgeTypeMeta> | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [shellHover] = useState<'inner' | 'middle' | 'outer' | null>(null);

  // Panel data (independent fetches)
  const [properties, setProperties] = useState<PropertiesPayload | null>(null);
  const [dossier, setDossier] = useState<DossierPayload | null>(null);
  const [timeline, setTimeline] = useState<TimelinePayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEdgeTypeMeta().then((m) => {
      if (!cancelled) setEdgeTypeMeta(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!node) return;
    let cancelled = false;
    setFocusError(null);

    fetchLensData(node)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setFocusError(null);
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setData(null);
        setFocusError(err.message || 'Failed to load Lens data.');
      });

    fetchProperties(node)
      .then((p) => { if (!cancelled) setProperties(p); })
      .catch(() => { if (!cancelled) setProperties(null); });

    fetchDossier(node)
      .then((d) => { if (!cancelled) setDossier(d); })
      .catch(() => { if (!cancelled) setDossier(null); });

    fetchTimeline(node)
      .then((t) => { if (!cancelled) setTimeline(t); })
      .catch(() => { if (!cancelled) setTimeline(null); });

    return () => {
      cancelled = true;
    };
  }, [node]);

  const layout = useMemo(() => {
    if (!data || !edgeTypeMeta) return null;
    const inputs = lensFocusToLayoutInputs(data);
    return computeLensLayout({
      focused: inputs.focused,
      neighbors: inputs.neighbors,
      edgeTypeMeta,
    });
  }, [data, edgeTypeMeta]);

  // Derive the neighbor list for LensNodeSwitcher from the lens-focus payload.
  // No extra fetch needed: the neighbors array already carries id + title + kind + edge.type.
  const switcherRelated = useMemo(() => {
    if (!data) return [];
    return data.neighbors.map((n) => ({
      id: String(n.id),
      title: n.title,
      kind: n.kind,
      edgeType: n.edge.type,
    }));
  }, [data]);

  if (!node) {
    return <div className="lens-empty">Pick a node to focus the Lens.</div>;
  }
  if (focusError) {
    // Honest error state per CLAUDE.md "Empty states are honest, not
    // cosmetic". An earlier version sat in "Loading..." forever when
    // the namespaced `object:415` slug was passed straight into the
    // /api/v1/notebook/objects/<int:pk>/lens-focus/ route. The fix
    // strips the prefix at the fetch boundary; this banner surfaces
    // the next class of failure (missing object, transient network
    // error) rather than masking it.
    return (
      <div className="lens-empty" role="alert">
        <p>Could not load Lens for node {node}.</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, opacity: 0.7 }}>
          {focusError}
        </p>
        <button
          type="button"
          onClick={() => window.history.back()}
          style={{
            marginTop: 12,
            padding: '6px 12px',
            border: '1px solid var(--paper-rule)',
            background: 'var(--paper)',
            color: 'var(--paper-ink)',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>
    );
  }
  if (!data || !edgeTypeMeta || !layout) {
    return <div className="lens-empty">Loading Lens for node {node}.</div>;
  }

  return (
    <div className="lens-root" style={OUTER_STYLE}>
      {/* Left strip: properties, claims, shell counts */}
      <div className="lens-left-panel" style={LEFT_CELL_STYLE}>
        {properties ? (
          <LensPropertiesStrip
            objectId={node}
            title={properties.title}
            kind={properties.kind}
            summary={properties.summary}
            sourceSystem={properties.source_system}
            evidenceCount={properties.evidence_count}
            confidence={properties.confidence}
            kinCount={properties.kin_count}
            anchoringCount={properties.anchoring_count}
            contextCount={properties.context_count}
            pinnedBy={properties.pinned_by}
            lastTouched={properties.last_touched}
            claims={properties.claims}
          />
        ) : (
          <div className="lens-panel-loading" aria-label="Loading properties">
            Loading properties.
          </div>
        )}
      </div>

      {/* Center: celestial chart SVG with back button and node switcher */}
      <div className="lens-canvas" style={SVG_CELL_STYLE}>
        <button
          type="button"
          className="lens-back"
          onClick={() => {
            // window.history.back triggers PanelManager popstate listener
            // and Explorer's ?live_additions= URL hydration on remount.
            window.history.back();
            window.dispatchEvent(
              new CustomEvent('theseus:switch-panel', {
                detail: { panel: 'explorer' },
              }),
            );
          }}
          aria-label="Back to corpus view"
        >
          Back
        </button>

        {/* Node switcher: top-right of the canvas cell (not SVG-internal) */}
        <div style={SWITCHER_STYLE}>
          <LensNodeSwitcher
            current={String(data.focused.id)}
            related={switcherRelated}
            edgeMeta={edgeTypeMeta ?? undefined}
          />
        </div>

        <svg
          viewBox="0 0 1120 680"
          preserveAspectRatio="xMidYMid meet"
          width="100%"
          height="100%"
        >
          <defs>
            <radialGradient id="lens-halo" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="var(--paper-pencil)" stopOpacity={0.6} />
              <stop offset="100%" stopColor="var(--paper-pencil)" stopOpacity={0} />
            </radialGradient>
          </defs>
          <LensShellRenderer
            layout={layout}
            hoverId={hoverId}
            onHoverId={setHoverId}
            showLabels={true}
            shellHover={shellHover}
            focusedTitle={data.focused.title}
            focusedDisplayId={String(data.focused.id)}
          />
        </svg>
      </div>

      {/* Right plate: dossier (summary, recent activity) */}
      <div className="lens-right-panel" style={RIGHT_CELL_STYLE}>
        {dossier ? (
          <LensDossier
            title={dossier.title}
            summary={dossier.summary}
            recentActivity={dossier.recent_activity}
          />
        ) : (
          <div className="lens-panel-loading" aria-label="Loading dossier">
            Loading dossier.
          </div>
        )}
      </div>

      {/* Bottom strip: provenance timeline */}
      <div className="lens-bottom-panel" style={BOTTOM_CELL_STYLE}>
        {timeline ? (
          <LensTimeline events={timeline.events} />
        ) : null}
      </div>
    </div>
  );
}
