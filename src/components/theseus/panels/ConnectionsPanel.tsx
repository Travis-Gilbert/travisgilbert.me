'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { ATLAS_SOURCES, type AtlasSource } from '../atlas/sources';
import { PAPER_TOKENS } from '../atlas/paperTokens';
import { PLUGIN_STATE_ACCENT } from '../atlas/stateAccent';
import {
  fetchPluginsManifest,
  pluginStateLabel,
  PluginsApiError,
  type PluginManifestEntry,
} from '@/lib/theseus-plugins-api';

/**
 * Atlas Connections panel.
 *
 * Shows the live plugin registry's connector plugins at the top, then
 * the roadmap source list (ATLAS_SOURCES) below. When zero connectors
 * are installed — the current prod reality until SPEC-C Batches 6-9
 * ship the four connector repos — the installed section collapses
 * entirely so the roadmap stays the primary content. Nothing here
 * fakes live data.
 */

type Selection =
  | { kind: 'installed'; plugin: PluginManifestEntry }
  | { kind: 'roadmap'; source: AtlasSource };

const SDK_DOCS_PATH = '/theseus/plugins/sdk';

export default function ConnectionsPanel() {
  const [installed, setInstalled] = useState<PluginManifestEntry[]>([]);
  const [manifestLoaded, setManifestLoaded] = useState(false);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(() => ({
    kind: 'roadmap',
    source: ATLAS_SOURCES[0],
  }));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const manifest = await fetchPluginsManifest();
        if (cancelled) return;
        const connectors = manifest.filter((p) => p.category === 'connector');
        setInstalled(connectors);
        // Auto-select the first installed connector if any, otherwise
        // keep the existing roadmap selection.
        if (connectors.length > 0) {
          setSelection({ kind: 'installed', plugin: connectors[0] });
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof PluginsApiError) {
          setManifestError(
            err.network
              ? 'Could not reach the plugin runtime.'
              : err.message,
          );
        } else {
          setManifestError('Unexpected error loading installed connectors.');
        }
      } finally {
        if (!cancelled) setManifestLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasInstalled = installed.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--app-base)',
      }}
    >
      <div className="atlas-topbar">
        <div className="atlas-crumbs">
          Connections
          <span className="sep">/</span>
          <span className="active">sources</span>
        </div>
        <div className="atlas-tools">
          <a
            className="atlas-tool"
            href={SDK_DOCS_PATH}
            title="Build a source connector — SDK docs"
          >
            SDK docs
          </a>
          <button
            type="button"
            className="atlas-tool"
            disabled
            aria-disabled="true"
            title="Source registry install flow (SPEC-C Batch 3) not yet shipped"
            style={{ opacity: 0.45, cursor: 'not-allowed' }}
          >
            + Add source
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          ...PAPER_TOKENS,
        }}
      >
        {/* Source list */}
        <div
          style={{
            borderRight: '1px solid var(--rule)',
            padding: '28px 22px',
            overflowY: 'auto',
          }}
        >
          {hasInstalled && (
            <>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                Installed · {installed.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 22 }}>
                {installed.map((p) => {
                  const isActive =
                    selection.kind === 'installed' && selection.plugin.slug === p.slug;
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setSelection({ kind: 'installed', plugin: p })}
                      style={rowStyle(isActive)}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: PLUGIN_STATE_ACCENT[p.state],
                          marginTop: 8,
                        }}
                      />
                      <div>
                        <div style={rowTitle(isActive)}>{p.slug}</div>
                        <div style={rowKind}>
                          {pluginStateLabel(p.state)} · v{p.version}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="eyebrow" style={{ marginBottom: 14 }}>
            On the roadmap · {ATLAS_SOURCES.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ATLAS_SOURCES.map((s) => {
              const isActive =
                selection.kind === 'roadmap' && selection.source.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelection({ kind: 'roadmap', source: s })}
                  style={rowStyle(isActive)}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: s.color,
                      marginTop: 8,
                    }}
                  />
                  <div>
                    <div style={rowTitle(isActive)}>{s.name}</div>
                    <div style={rowKind}>{s.kind}</div>
                  </div>
                </button>
              );
            })}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '14px 1fr',
                gap: 10,
                padding: '12px 8px',
                marginTop: 8,
                borderTop: '1px dashed var(--rule)',
                color: 'var(--ink-3)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  paddingTop: 2,
                }}
              >
                +
              </span>
              <div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 17, fontWeight: 400 }}>
                  Add source
                </div>
                <div className="eyebrow" style={{ marginTop: 4 }}>
                  backend not connected yet
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detail */}
        <div
          style={{
            overflowY: 'auto',
            padding: '36px 36px 48px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {selection.kind === 'installed' ? (
            <InstalledDetail plugin={selection.plugin} />
          ) : (
            <RoadmapDetail source={selection.source} manifestError={manifestError} manifestLoaded={manifestLoaded} />
          )}
        </div>
      </div>
    </div>
  );
}

function InstalledDetail({ plugin }: { plugin: PluginManifestEntry }) {
  return (
    <>
      <div>
        <div className="eyebrow">
          Connector · installed · {pluginStateLabel(plugin.state)}
        </div>
        <h2
          style={{
            margin: '6px 0 0',
            fontFamily: 'var(--font-display)',
            fontSize: 36,
            fontWeight: 500,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
          }}
        >
          {plugin.slug}
        </h2>
      </div>
      {plugin.description && (
        <p style={detailBody}>{plugin.description}</p>
      )}
      <div style={capabilitiesRow}>
        {plugin.capabilities.map((cap) => (
          <span key={cap} style={capabilityChip}>
            {cap}
          </span>
        ))}
      </div>
      <div style={dashedBox}>
        <div className="eyebrow">Runtime</div>
        <div style={dashedBoxLine}>Version v{plugin.version}</div>
        <div style={dashedBoxDim}>
          Sync status, item counts, and last-sync timestamps light up when the
          connector starts emitting IngestionEvents.
        </div>
      </div>
    </>
  );
}

function RoadmapDetail({
  source,
  manifestError,
  manifestLoaded,
}: {
  source: AtlasSource;
  manifestError: string | null;
  manifestLoaded: boolean;
}) {
  return (
    <>
      <div>
        <div className="eyebrow">{source.kind}</div>
        <h2
          style={{
            margin: '6px 0 0',
            fontFamily: 'var(--font-display)',
            fontSize: 36,
            fontWeight: 500,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
          }}
        >
          {source.name}
        </h2>
      </div>
      <p style={detailBody}>{source.detail}</p>
      <div style={dashedBox}>
        <div className="eyebrow">Status</div>
        <div style={dashedBoxLine}>Not connected</div>
        <div style={dashedBoxDim}>
          This source will sync into Theseus once its connector plugin ships
          (SPEC-C Batches 6-9). Until then, captured items still flow through
          the drop-anywhere file ingest.
        </div>
        {manifestLoaded && manifestError && (
          <div style={{ ...dashedBoxDim, marginTop: 8 }}>
            Runtime check: <span style={{ color: 'var(--vie-error, #c65c3a)' }}>{manifestError}</span>
          </div>
        )}
      </div>
    </>
  );
}

function rowStyle(isActive: boolean): CSSProperties {
  return {
    all: 'unset',
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: '14px 1fr',
    gap: 10,
    padding: '12px 8px',
    borderLeft: isActive ? '2px solid var(--pencil)' : '2px solid transparent',
    background: isActive ? 'var(--paper-2)' : 'transparent',
  };
}

function rowTitle(isActive: boolean): CSSProperties {
  return {
    fontFamily: 'var(--font-body)',
    fontSize: 17,
    fontWeight: 500,
    color: isActive ? 'var(--ink)' : 'var(--ink-2)',
  };
}

const rowKind: CSSProperties = {
  font: '500 10px/1.4 var(--font-mono)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
  marginTop: 4,
};

const detailBody: CSSProperties = {
  margin: 0,
  maxWidth: 640,
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  lineHeight: 1.55,
  color: 'var(--ink-2)',
};

const dashedBox: CSSProperties = {
  marginTop: 14,
  padding: '16px 18px',
  border: '1px dashed var(--rule)',
  borderRadius: 4,
  maxWidth: 640,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const dashedBoxLine: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  color: 'var(--ink)',
};

const dashedBoxDim: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--ink-3)',
};

const capabilitiesRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
};

const capabilityChip: CSSProperties = {
  padding: '2px 6px',
  border: '1px solid var(--rule)',
  borderRadius: 3,
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
};

