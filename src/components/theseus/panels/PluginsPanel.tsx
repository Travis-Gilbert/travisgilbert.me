'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  disablePlugin,
  enablePlugin,
  fetchPluginsManifest,
  fetchRunnerCapabilities,
  pluginStateLabel,
  PluginsApiError,
  rehabilitatePlugin,
  type PluginCategory,
  type PluginManifestEntry,
  type RunnerCapabilities,
} from '@/lib/theseus-plugins-api';
import { PAPER_TOKENS } from '../atlas/paperTokens';
import { PLUGIN_STATE_ACCENT } from '../atlas/stateAccent';

/**
 * Atlas Plugins panel.
 *
 * Reads the live plugin manifest from the SPEC-C runtime at
 * ``/api/v2/plugins/*`` and renders one card per registered plugin.
 * No fake cards, no decorative CTAs: if the registry is empty the
 * panel renders an honest empty state and points to the SDK docs.
 *
 * Categories match the runtime's taxonomy — connector, scorer, verb,
 * surface, theorem. The filter row lets operators narrow the list;
 * all-on by default.
 */

const SDK_DOCS_PATH = '/theseus/plugins/sdk';

const CATEGORY_LABEL: Record<PluginCategory, string> = {
  connector: 'Connector',
  scorer: 'Scorer',
  verb: 'Verb',
  surface: 'Surface',
  theorem: 'Theorem',
};

// Mobile Shell 2.0 (2026-04-28): the merged Plugins panel exposes three
// tabs at the surface: Connectors, MCP, Skills. They map onto the
// underlying plugin runtime taxonomy as follows. No fake data: a tab
// with zero matches renders an honest empty state and points at the
// SDK docs.
type PluginTab = 'connectors' | 'mcp' | 'skills';

const TAB_LABEL: Record<PluginTab, string> = {
  connectors: 'Connectors',
  mcp: 'MCP',
  skills: 'Skills',
};

const TAB_CATEGORIES: Record<PluginTab, ReadonlySet<PluginCategory>> = {
  connectors: new Set<PluginCategory>(['connector']),
  mcp: new Set<PluginCategory>(['verb', 'scorer']),
  skills: new Set<PluginCategory>(['surface', 'theorem']),
};

interface PluginsPanelProps {
  defaultTab?: PluginTab;
}

export default function PluginsPanel({ defaultTab = 'connectors' }: PluginsPanelProps = {}) {
  const [manifest, setManifest] = useState<PluginManifestEntry[] | null>(null);
  const [capabilities, setCapabilities] = useState<RunnerCapabilities | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PluginTab>(defaultTab);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [m, caps] = await Promise.all([
        fetchPluginsManifest(),
        fetchRunnerCapabilities().catch(() => null),
      ]);
      setManifest(m);
      if (caps) setCapabilities(caps);
    } catch (err) {
      setManifest([]);
      if (err instanceof PluginsApiError) {
        setLoadError(
          err.network
            ? 'Could not reach the plugin runtime.'
            : err.message,
        );
      } else {
        setLoadError('Unexpected error loading plugins.');
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (!manifest) return [] as PluginManifestEntry[];
    const allowed = TAB_CATEGORIES[activeTab];
    return manifest.filter((p) => allowed.has(p.category));
  }, [manifest, activeTab]);

  async function runTransition(
    slug: string,
    label: string,
    action: (slug: string) => Promise<unknown>,
  ) {
    setPending((prev) => ({ ...prev, [slug]: true }));
    try {
      await action(slug);
      toast.success(`${label} ${slug}`);
      await load();
    } catch (err) {
      if (err instanceof PluginsApiError) {
        if (err.status === 409 && err.fromState && err.toState) {
          toast.error(
            `Cannot ${label.toLowerCase()} ${slug}: ${err.fromState} → ${err.toState} is not a legal transition.`,
          );
        } else {
          toast.error(`${label} ${slug} failed: ${err.message}`);
        }
      } else {
        toast.error(`${label} ${slug} failed.`);
      }
    } finally {
      setPending((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
    }
  }

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
          Plugins
          <span className="sep">/</span>
          <span className="active">marketplace</span>
        </div>
        <div className="atlas-tools">
          <a
            className="atlas-tool"
            href={SDK_DOCS_PATH}
            title="Plugin SDK documentation"
          >
            SDK docs
          </a>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          ...PAPER_TOKENS,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '14px 28px',
            borderBottom: '1px solid var(--rule)',
            flexWrap: 'wrap',
          }}
          role="tablist"
          aria-label="Plugin sub-sections"
        >
          {(['connectors', 'mcp', 'skills'] as PluginTab[]).map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                aria-pressed={active}
                role="tab"
                aria-selected={active}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  padding: '8px 14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                  borderBottom: active
                    ? '2px solid var(--brass, #c9a23a)'
                    : '2px solid transparent',
                }}
              >
                {TAB_LABEL[tab]}
              </button>
            );
          })}
          {capabilities && !capabilities.cgroups_available && (
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--ink-3)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
              title="The runner uses subprocess + setrlimit; cgroups are unavailable on this deployment (Railway)."
            >
              isolation · {capabilities.mechanism}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '28px' }}>
          {manifest === null && !loadError && (
            <div className="eyebrow" style={{ color: 'var(--ink-3)' }}>
              Loading plugin manifest…
            </div>
          )}

          {loadError && (
            <div
              role="alert"
              style={{
                padding: '20px 22px',
                border: '1px dashed var(--rule)',
                borderRadius: 4,
                maxWidth: 640,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div className="eyebrow">Plugin runtime unreachable</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)' }}>
                {loadError}
              </div>
              <button
                type="button"
                onClick={() => void load()}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 6,
                  all: 'unset',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  border: '1px solid var(--rule)',
                  borderRadius: 3,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ink)',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {manifest !== null && !loadError && visible.length === 0 && (
            <EmptyState totalKnown={manifest.length} tab={activeTab} />
          )}

          {visible.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 18,
              }}
            >
              {visible.map((entry) => (
                <PluginCard
                  key={entry.slug}
                  entry={entry}
                  pending={Boolean(pending[entry.slug])}
                  onEnable={() =>
                    void runTransition(entry.slug, 'Enabled', enablePlugin)
                  }
                  onDisable={() =>
                    void runTransition(entry.slug, 'Disabled', disablePlugin)
                  }
                  onRehabilitate={() =>
                    void runTransition(entry.slug, 'Rehabilitated', rehabilitatePlugin)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  entry: PluginManifestEntry;
  pending: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onRehabilitate: () => void;
}

function PluginCard({
  entry,
  pending,
  onEnable,
  onDisable,
  onRehabilitate,
}: CardProps) {
  const accent = PLUGIN_STATE_ACCENT[entry.state];
  return (
    <article
      style={{
        padding: '18px 18px 16px',
        border: '1px solid var(--rule)',
        borderRadius: 4,
        background: 'var(--paper-2, rgba(255,255,255,0.4))',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="eyebrow">{CATEGORY_LABEL[entry.category]}</div>
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 500,
            color: 'var(--ink)',
            letterSpacing: '-0.005em',
          }}
        >
          {entry.slug}
        </h3>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
          }}
        >
          v{entry.version}
        </div>
      </header>

      {entry.description && (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--ink-2)',
          }}
        >
          {entry.description}
        </p>
      )}

      {entry.capabilities.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {entry.capabilities.map((cap) => (
            <span
              key={cap}
              style={{
                padding: '2px 6px',
                border: '1px solid var(--rule)',
                borderRadius: 3,
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              {cap}
            </span>
          ))}
        </div>
      )}

      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderTop: '1px solid var(--rule)',
          paddingTop: 10,
          marginTop: 2,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: accent,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
          }}
        >
          {pluginStateLabel(entry.state)}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {entry.state === 'quarantined' && (
            <CardButton disabled={pending} onClick={onRehabilitate}>
              Rehabilitate
            </CardButton>
          )}
          {entry.state !== 'enabled' && entry.state !== 'quarantined' && (
            <CardButton disabled={pending} onClick={onEnable}>
              Enable
            </CardButton>
          )}
          {entry.state === 'enabled' && (
            <CardButton disabled={pending} onClick={onDisable}>
              Disable
            </CardButton>
          )}
        </div>
      </footer>
    </article>
  );
}

function CardButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        all: 'unset',
        cursor: disabled ? 'wait' : 'pointer',
        padding: '4px 10px',
        border: '1px solid var(--rule)',
        borderRadius: 3,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--ink)',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({ totalKnown, tab }: { totalKnown: number; tab: PluginTab }) {
  const headline =
    totalKnown === 0
      ? 'Registry is empty.'
      : `No ${TAB_LABEL[tab].toLowerCase()} plugins yet.`;
  const body =
    totalKnown === 0
      ? 'The SPEC-C plugin runtime is running but no plugins are installed yet. See the SDK docs to build one.'
      : tab === 'mcp'
        ? 'No MCP-style verb or scorer plugins are registered. Connect Theseus MCP to expose tool calls here.'
        : tab === 'skills'
          ? 'No surface or theorem plugins are registered. Skills appear here once they are loaded into the runtime.'
          : 'No connector plugins are registered. Connect a source (GitHub, arXiv, Fastmail, Obsidian) to see it here.';
  return (
    <div
      style={{
        padding: '28px 30px',
        border: '1px dashed var(--rule)',
        borderRadius: 4,
        maxWidth: 640,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div className="eyebrow">Empty state</div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 500,
          color: 'var(--ink)',
          letterSpacing: '-0.005em',
        }}
      >
        {headline}
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--ink-2)',
          lineHeight: 1.55,
        }}
      >
        {body}
      </p>
      {totalKnown === 0 && (
        <a
          href={SDK_DOCS_PATH}
          style={{
            marginTop: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--pencil)',
            textDecoration: 'underline',
          }}
        >
          Open SDK docs →
        </a>
      )}
    </div>
  );
}
