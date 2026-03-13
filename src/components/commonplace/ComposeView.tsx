'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import type { Editor } from '@tiptap/react';
import type { TiptapUpdatePayload } from '@/components/studio/TiptapEditor';
import {
  getObjectTypeIdentity,
  type ApiComposePassState,
  type ApiEngineJobStatus,
  type ComposePassId,
  type ComposeResultSignal,
} from '@/lib/commonplace';
import { captureToApi, type ComposeLiveResult } from '@/lib/commonplace-api';
import { useCommonPlace } from '@/lib/commonplace-context';
import { useEngineJobStatus } from '@/hooks/useEngineJobStatus';
import { useLiveResearch } from '@/hooks/useLiveResearch';
import TerminalBlock from './TerminalBlock';
import ComposeDiscoveryDock from './ComposeDiscoveryDock';
import ObjectRenderer from './objects/ObjectRenderer';
import { renderableFromComposeResult } from './objectRenderables';
import { useRenderableObjectAction } from './useRenderableObjectAction';

const CommonPlaceEditor = dynamic(
  () => import('./CommonPlaceEditor'),
  { ssr: false },
);

const PASS_LABELS: Record<ComposePassId, string> = {
  ner: 'Direct mention',
  shared_entity: 'Shared entity',
  keyword: 'Keyword field',
  tfidf: 'Topic match',
  sbert: 'Semantic match',
  nli: 'Claim check',
  kge: 'Graph deepen',
};

const PASS_SHORT_LABELS: Record<ComposePassId, string> = {
  ner: 'NER',
  shared_entity: 'ENTITY',
  keyword: 'KEYWORD',
  tfidf: 'BM25',
  sbert: 'SBERT',
  nli: 'NLI',
  kge: 'KGE',
};

const TERMINAL_PASS_ORDER: ComposePassId[] = [
  'ner',
  'shared_entity',
  'tfidf',
  'sbert',
  'nli',
  'kge',
];

const PASS_LOG_NAMES: Record<ComposePassId, string> = {
  ner: 'adaptive_ner',
  shared_entity: 'shared_entity',
  keyword: 'keyword_field',
  tfidf: 'bm25_lexical',
  sbert: 'sbert_semantic',
  nli: 'nli_stance',
  kge: 'kge_struct',
};

const TERMINAL_TABS: Array<{
  id: 'passes' | 'tension' | 'gaps' | 'stash';
  label: string;
  icon: string;
}> = [
  { id: 'passes', label: 'Passes', icon: '◉' },
  { id: 'tension', label: 'Tension', icon: '⚡' },
  { id: 'gaps', label: 'Gaps', icon: '◫' },
  { id: 'stash', label: 'Stash', icon: '⌘' },
];

const SIGNAL_LABELS: Record<ComposeResultSignal, string> = {
  ner: 'Direct mention',
  shared_entity: 'Shared entity',
  keyword: 'Keyword field',
  tfidf: 'Topic match',
  sbert: 'Semantic match',
  nli: 'Claim check',
  kge: 'Graph deepen',
  supports: 'Supports',
  contradicts: 'Contradicts',
};

const EMPTY_COMPOSE_PREVIEW: ComposeLiveResult[] = [
  {
    id: 'preview-stigmergy',
    objectId: 2,
    slug: 'stigmergy',
    type: 'concept',
    typeColor: '#7050A0',
    title: 'Stigmergy',
    bodyPreview: 'Indirect coordination through environmental modification.',
    score: 0.82,
    signal: 'tfidf',
    explanation: 'Topic overlap around coordination, emergence, and self-organizing systems.',
    supportingSignals: ['keyword'],
  },
  {
    id: 'preview-shannon',
    objectId: 1,
    slug: 'symbolic-analysis-of-relay-and-switching-circuits',
    type: 'source',
    typeColor: '#1A7A8A',
    title: 'A Symbolic Analysis of Relay and Switching Circuits',
    bodyPreview: "Claude Shannon's foundational work on switching circuits and symbolic logic.",
    score: 0.77,
    signal: 'shared_entity',
    explanation: 'Claude Shannon (3 other objects)',
    supportingSignals: ['ner'],
  },
  {
    id: 'preview-hunch',
    objectId: 3,
    slug: 'connection-engines-are-stigmergic-systems',
    type: 'hunch',
    typeColor: '#C07040',
    title: 'Connection engines are stigmergic systems',
    bodyPreview: 'Each edge modifies the knowledge environment and guides the next action.',
    score: 0.73,
    signal: 'sbert',
    explanation: 'Recent hunches on emergent structure are semantically adjacent to this draft direction.',
    supportingSignals: ['tfidf'],
  },
];

const COMPOSE_DISCOVERY_META: Record<
  string,
  {
    sourceLabel?: string;
    sourceFormat?: string;
    explanation?: string;
  }
> = {
  'symbolic-analysis-of-relay-and-switching-circuits': {
    sourceLabel: 'MIT Archives',
    sourceFormat: 'PDF',
    explanation: 'Claude Shannon (3 other objects)',
  },
};

function formatSummaryKey(key: string): string {
  return key.replace(/_/g, ' ');
}

function formatJobSummary(job: ApiEngineJobStatus | null): Array<{ label: string; value: string }> {
  if (!job?.summary) return [];

  return Object.entries(job.summary)
    .filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'number') return value > 0;
      return Boolean(String(value || '').trim());
    })
    .slice(0, 4)
    .map(([key, value]) => ({
      label: formatSummaryKey(key),
      value: Array.isArray(value) ? value.join(', ') : String(value),
    }));
}

function buildPassStateMap(states: ApiComposePassState[]): Map<ComposePassId, ApiComposePassState> {
  return new Map(states.map((state) => [state.id, state]));
}

function firstNumericSummaryValue(job: ApiEngineJobStatus | null): number | null {
  if (!job?.summary) return null;
  for (const value of Object.values(job.summary)) {
    if (typeof value === 'number' && value > 0) return value;
  }
  return null;
}

export default function ComposeView({
  prefillText,
  prefillType,
  onSaved,
}: {
  prefillText?: string;
  prefillType?: string;
  onSaved?: (objectId: number) => void;
}) {
  const {
    clearStash,
    openContextMenu,
    openDrawer,
    stashedObjects,
    unstashObject,
  } = useCommonPlace();

  const [title, setTitle] = useState('');
  const [objectType] = useState(prefillType ?? 'note');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveText, setLiveText] = useState(prefillText ?? '');
  const [enableNli, setEnableNli] = useState(false);
  const [engineJobId, setEngineJobId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<{
    id: number;
    title: string;
    type: string;
    slug: string;
  } | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(184);
  const [terminalTab, setTerminalTab] = useState<'passes' | 'tension' | 'gaps' | 'stash'>('passes');
  const terminalDragging = useRef<{ startY: number; startHeight: number } | null>(null);

  const editorRef = useRef<Editor | null>(null);
  const bodyRef = useRef<{ html: string; markdown: string }>({
    html: prefillText ?? '',
    markdown: prefillText ?? '',
  });

  const livePasses = useMemo<ComposePassId[]>(
    () => (enableNli
      ? ['ner', 'shared_entity', 'keyword', 'tfidf', 'sbert', 'nli']
      : ['ner', 'shared_entity', 'keyword', 'tfidf', 'sbert']),
    [enableNli],
  );

  const {
    results,
    loading: liveLoading,
    paused: livePaused,
    passStates,
    degraded,
  } = useLiveResearch(liveText, {
    enableNli,
    minScore: 0.25,
    passes: livePasses,
  });

  const { job: engineJob, loading: engineJobLoading } = useEngineJobStatus(engineJobId);

  const passStateMap = useMemo(() => buildPassStateMap(passStates), [passStates]);
  const typeIdentity = getObjectTypeIdentity(objectType);
  const summaryItems = useMemo(() => formatJobSummary(engineJob), [engineJob]);
  const kgeSummaryValue = useMemo(() => firstNumericSummaryValue(engineJob), [engineJob]);
  const liveCharacters = liveText.trim().length;
  const liveWords = useMemo(() => {
    const normalized = liveText.trim();
    if (!normalized) return 0;
    return normalized.split(/\s+/).length;
  }, [liveText]);

  const previewResults = useMemo(
    () => (results.length === 0 && liveCharacters < 20 ? EMPTY_COMPOSE_PREVIEW : []),
    [liveCharacters, results.length],
  );
  const dockResults = useMemo(
    () => (previewResults.length > 0 ? previewResults : results.slice(0, 6)),
    [previewResults, results],
  );
  const dockObjects = useMemo(
    () =>
      dockResults.map((result) =>
        renderableFromComposeResult(result, {
          signalLabel: SIGNAL_LABELS[result.signal],
          supportingSignalLabels: result.supportingSignals.map(
            (signal) => SIGNAL_LABELS[signal] ?? signal,
          ),
          sourceLabel: COMPOSE_DISCOVERY_META[result.slug]?.sourceLabel,
          sourceFormat: COMPOSE_DISCOVERY_META[result.slug]?.sourceFormat,
          explanation: COMPOSE_DISCOVERY_META[result.slug]?.explanation,
        }),
      ),
    [dockResults],
  );
  const handleDockObjectClick = useRenderableObjectAction((obj) => openDrawer(obj.slug));

  const handleEditorUpdate = useCallback((payload: TiptapUpdatePayload) => {
    bodyRef.current = payload;
    const liveSource = (payload.markdown || payload.html || '').trim();
    setLiveText(liveSource);
  }, []);

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const handleSave = useCallback(async () => {
    const bodyText = bodyRef.current.markdown || bodyRef.current.html;
    if (!title.trim() && !bodyText.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const result = await captureToApi({
        content: bodyText,
        title: title.trim() || undefined,
        hint_type: objectType,
      });

      setEngineJobId(result.engine_job_id ?? null);
      setLastSaved({
        id: result.object.id,
        title: result.object.display_title || result.object.title,
        type: result.object.object_type_data?.slug ?? objectType,
        slug: result.object.slug,
      });
      onSaved?.(result.object.id);

      setTitle('');
      setLiveText('');
      bodyRef.current = { html: '', markdown: '' };
      editorRef.current?.commands.clearContent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }, [title, objectType, onSaved]);

  useEffect(() => {
    function handleKeyboardSave(event: KeyboardEvent) {
      if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest('.cp-compose-pane')) return;

      event.preventDefault();
      void handleSave();
    }

    document.addEventListener('keydown', handleKeyboardSave);
    return () => document.removeEventListener('keydown', handleKeyboardSave);
  }, [handleSave]);

  const handleTerminalDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    terminalDragging.current = { startY: e.clientY, startHeight: terminalHeight };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [terminalHeight]);

  const handleTerminalDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!terminalDragging.current) return;
    const delta = terminalDragging.current.startY - e.clientY;
    const next = Math.max(120, Math.min(terminalDragging.current.startHeight + delta, 500));
    setTerminalHeight(next);
  }, []);

  const handleTerminalDragEnd = useCallback(() => {
    terminalDragging.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const terminalPasses = useMemo(() => {
    return TERMINAL_PASS_ORDER.map((passId, index) => {
      const state = passStateMap.get(passId);

      if (passId === 'kge') {
        const status =
          engineJob?.status === 'complete'
            ? 'complete'
            : engineJob?.status === 'failed'
              ? 'degraded'
              : 'disabled';

        return {
          id: passId,
          index,
          status,
          summaryValue:
            status === 'complete'
              ? String(kgeSummaryValue ?? 1)
              : status === 'degraded'
                ? 'off'
                : 'off',
          logValue:
            status === 'complete'
              ? `${kgeSummaryValue ?? 1} edges`
              : status === 'degraded'
                ? 'degraded'
                : 'post-save only',
          meta:
            status === 'complete'
              ? 'engine'
              : status === 'degraded'
                ? 'failed'
                : null,
          longLabel: PASS_LABELS[passId],
          shortLabel: PASS_SHORT_LABELS[passId],
          logLabel: `pass_${index + 1} ${PASS_LOG_NAMES[passId]}`,
        };
      }

      if (passId === 'nli' && !enableNli) {
        return {
          id: passId,
          index,
          status: 'disabled',
          summaryValue: 'off',
          logValue: 'inactive',
          meta: 'click Check Tension',
          longLabel: PASS_LABELS[passId],
          shortLabel: PASS_SHORT_LABELS[passId],
          logLabel: `pass_${index + 1} ${PASS_LOG_NAMES[passId]}`,
        };
      }

      if (liveCharacters < 20) {
        return {
          id: passId,
          index,
          status: 'standby',
          summaryValue: 'wait',
          logValue: 'standby',
          meta: 'waiting for draft',
          longLabel: PASS_LABELS[passId],
          shortLabel: PASS_SHORT_LABELS[passId],
          logLabel: `pass_${index + 1} ${PASS_LOG_NAMES[passId]}`,
        };
      }

      if (state?.status === 'degraded') {
        return {
          id: passId,
          index,
          status: 'degraded',
          summaryValue: 'off',
          logValue: 'degraded',
          meta: state.degraded_reason ?? null,
          longLabel: PASS_LABELS[passId],
          shortLabel: PASS_SHORT_LABELS[passId],
          logLabel: `pass_${index + 1} ${PASS_LOG_NAMES[passId]}`,
        };
      }

      const unit =
        passId === 'ner'
          ? 'entities'
          : passId === 'nli'
            ? 'claims'
            : 'edges';
      const count = state?.match_count ?? 0;

      return {
        id: passId,
        index,
        status: 'complete',
        summaryValue: String(count),
        logValue: `${count} ${unit}`,
        meta: liveLoading ? 'running' : 'live',
        longLabel: PASS_LABELS[passId],
        shortLabel: PASS_SHORT_LABELS[passId],
        logLabel: `pass_${index + 1} ${PASS_LOG_NAMES[passId]}`,
      };
    });
  }, [enableNli, engineJob?.status, kgeSummaryValue, liveCharacters, liveLoading, passStateMap]);

  return (
    <div className="cp-compose-pane">
      <div className="cp-compose-layout">
        <div className="cp-compose-left-stack">
          <div className="cp-compose-editor-shell">
            <div className="cp-compose-writing-scroll">
              <div className="cp-compose-writing-column">
                <div className="cp-compose-editor-topline">
                  <div
                    className="cp-compose-type-badge"
                    style={{ '--compose-type-color': typeIdentity.color } as CSSProperties}
                  >
                    {typeIdentity.label}
                  </div>
                </div>

                <input
                  type="text"
                  className="cp-compose-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={`Untitled ${typeIdentity.label}`}
                />

              <div className="cp-compose-editor-frame">
                <CommonPlaceEditor
                  initialContent={prefillText}
                  initialContentFormat="markdown"
                  onUpdate={handleEditorUpdate}
                  onEditorReady={handleEditorReady}
                  placeholder=""
                />
                {liveCharacters === 0 && (
                  <div className="cp-compose-editor-placeholder" aria-hidden="true">
                    <div className="cp-compose-editor-placeholder-kicker">Keep writing...</div>
                  </div>
                )}
              </div>

                <div className="cp-compose-tension-row">
                  <div className="cp-compose-editor-stats">
                    <span>{liveWords} words</span>
                    <span>{liveCharacters} chars</span>
                    <span>{saving ? 'Saving…' : 'Cmd/Ctrl+Enter saves'}</span>
                    {error && <span className="cp-compose-error-inline">{error}</span>}
                  </div>
                  <button
                    type="button"
                    className="cp-compose-check-tension"
                    onClick={() => {
                      setTerminalOpen(true);
                      setTerminalTab('tension');
                      if (!enableNli) setEnableNli(true);
                    }}
                  >
                    Check Tension
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`cp-compose-terminal${terminalOpen ? ' cp-compose-terminal--open' : ''}`}
            style={{ height: terminalOpen ? terminalHeight : 32 }}
          >
            {terminalOpen && (
              <div
                className="cp-compose-terminal-resize-handle"
                onPointerDown={handleTerminalDragStart}
                onPointerMove={handleTerminalDragMove}
                onPointerUp={handleTerminalDragEnd}
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize terminal"
              />
            )}
            <div
              className="cp-compose-terminal-bar"
              onClick={() => setTerminalOpen((prev) => !prev)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setTerminalOpen((prev) => !prev);
              }}
              aria-expanded={terminalOpen}
            >
              <div className="cp-compose-terminal-openbar">
                <div className="cp-compose-terminal-status">
                  <div className="cp-compose-terminal-dots">
                    {terminalPasses.map((pass) => (
                      <span
                        key={pass.id}
                        className={`cp-compose-terminal-dot cp-compose-terminal-dot--${
                          pass.status === 'disabled' ? 'degraded' : pass.status
                        }`}
                        title={pass.longLabel}
                      />
                    ))}
                  </div>
                  <span className="cp-compose-terminal-label">Engine</span>
                  <span className="cp-compose-terminal-count">
                    {liveCharacters < 20 ? 'standby' : `${results.length} matches`}
                  </span>
                </div>
              </div>
              <span className="cp-compose-terminal-toggle" aria-hidden="true">
                {terminalOpen ? '▾' : '▸'}
              </span>
            </div>

            {terminalOpen && (
              <div className="cp-compose-terminal-content">
                <div className="cp-compose-terminal-tabs-row">
                  {TERMINAL_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`cp-compose-terminal-tab${terminalTab === tab.id ? ' active' : ''}`}
                      onClick={() => setTerminalTab(tab.id)}
                    >
                      <span className="cp-compose-terminal-tab-icon" aria-hidden="true">
                        {tab.icon}
                      </span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
                <div className="cp-compose-terminal-pane">
                {terminalTab === 'passes' && (
                  <div className="cp-compose-terminal-passes">
                    <div className="cp-compose-pass-summary-grid">
                      {terminalPasses.map((pass) => {
                        return (
                          <div
                            key={pass.id}
                            className={`cp-compose-pass-summary cp-compose-pass-summary--${
                              pass.status === 'disabled' ? 'degraded' : pass.status
                            }`}
                          >
                            <span className="cp-compose-pass-summary-label">
                              {pass.shortLabel}
                            </span>
                            <span className="cp-compose-pass-summary-value">
                              {pass.summaryValue}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="cp-compose-pass-log">
                    {terminalPasses.map((pass) => {
                      return (
                        <div
                          key={pass.id}
                          className={`cp-compose-pass-log-line cp-compose-pass-log-line--${
                            pass.status === 'disabled' ? 'degraded' : pass.status
                          }`}
                        >
                          <span className="cp-compose-pass-log-label">{pass.logLabel}</span>{' '}
                          <span className="cp-compose-pass-log-value">{pass.logValue}</span>
                          {pass.meta && (
                            <>
                              {' '}
                              <span className="cp-compose-pass-log-meta">{pass.meta}</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
                {terminalTab === 'tension' && (
                  <div className="cp-compose-terminal-tension">
                    {!enableNli ? (
                      <div className="cp-compose-terminal-empty">
                        NLI pass inactive. Click "Check Tension" below the editor to enable.
                      </div>
                    ) : results.filter((r) => r.signal === 'nli').length === 0 ? (
                      <div className="cp-compose-terminal-empty">
                        {liveLoading ? 'Running NLI pass...' : 'No contradictions detected in current draft.'}
                      </div>
                    ) : (
                      results
                        .filter((r) => r.signal === 'nli')
                        .slice(0, 8)
                        .map((r) => (
                          <div key={r.id} className="cp-compose-tension-row-item">
                            <span className="cp-compose-tension-title">{r.title}</span>
                            <span className="cp-compose-tension-explanation">{r.explanation}</span>
                          </div>
                        ))
                    )}
                  </div>
                )}
                {terminalTab === 'gaps' && (
                  <div className="cp-compose-terminal-empty">
                    {lastSaved
                      ? `Gap analysis for "${lastSaved.title}" runs after the background engine completes.`
                      : 'Save an object to surface research gaps from the engine pass.'}
                  </div>
                )}
                {terminalTab === 'stash' && (
                  <div className="cp-compose-terminal-stash">
                    {stashedObjects.length === 0 ? (
                      <div className="cp-compose-terminal-empty">
                        Right-click any object and choose "Stash for Later" to collect fragments here.
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            marginBottom: 8,
                          }}
                        >
                          <button
                            type="button"
                            onClick={clearStash}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--cp-term-muted)',
                              fontFamily: 'var(--cp-font-mono)',
                              fontSize: 10,
                              cursor: 'pointer',
                            }}
                          >
                            Clear stash
                          </button>
                        </div>
                        {stashedObjects.map((item) => (
                          <div
                            key={`${item.slug}-${item.id}`}
                            className="cp-compose-stash-item"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => openDrawer(item.slug)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--cp-term-text)',
                                fontFamily: 'var(--cp-font-mono)',
                                fontSize: 11,
                                cursor: 'pointer',
                                textAlign: 'left',
                                padding: 0,
                                flex: 1,
                              }}
                            >
                              {item.display_title ?? item.title}
                            </button>
                            <button
                              type="button"
                              onClick={() => unstashObject(item.id)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--cp-term-muted)',
                                fontFamily: 'var(--cp-font-mono)',
                                fontSize: 10,
                                cursor: 'pointer',
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="cp-compose-graph-panel cp-compose-right-dock">
          <div className="cp-compose-dock-header">
            <div>
              <div className="cp-compose-dock-kicker">Discovery dock</div>
              <div className="cp-compose-dock-title">Related objects from live engine passes</div>
            </div>
            <span className="cp-compose-dock-presence" aria-label="Engine status">
              <span className="cp-compose-dock-presence-dot" />
              <span>{livePaused ? 'Paused' : liveLoading ? 'Listening' : 'Live'}</span>
            </span>
          </div>
          <div className="cp-compose-dock-body">
            <section className="cp-compose-dock-section">
              <div className="cp-compose-results-panel">
                {dockObjects.length === 0 ? (
                  <div className="cp-compose-results-empty">
                    {liveCharacters < 20
                      ? 'Keep writing. Live discovery starts after 20 characters.'
                      : 'No related objects cleared the current signal thresholds.'}
                  </div>
                ) : (
                  <ComposeDiscoveryDock
                    objects={dockObjects}
                    onClick={handleDockObjectClick}
                    onContextMenu={(e, obj) => openContextMenu(e.clientX, e.clientY, obj)}
                  />
                )}
              </div>
            </section>

            <section className="cp-compose-dock-section">
              <div className="cp-compose-dock-section-title">Stash</div>
              {stashedObjects.length === 0 ? (
                <div className="cp-compose-results-empty">
                  Right-click selected text and choose "Stash for Later" to save fragments here.
                </div>
              ) : (
                <div className="cp-compose-stash-chip-list">
                  {stashedObjects.map((object) => (
                    <ObjectRenderer
                      key={`${object.slug}-${object.id}`}
                      object={object}
                      compact
                      variant="chip"
                      onClick={handleDockObjectClick}
                      onContextMenu={(e, obj) => openContextMenu(e.clientX, e.clientY, obj)}
                    />
                  ))}
                </div>
              )}
            </section>

            <TerminalBlock
              title="Post-save deepen"
              compact
              className="cp-compose-deepen-panel"
              status={
                engineJob?.status === 'failed'
                  ? 'error'
                  : engineJob?.status === 'complete'
                    ? 'complete'
                    : engineJobId
                      ? 'running'
                      : 'idle'
              }
            >
              <div className="cp-compose-deepen-header">
                <div>
                  <div className="cp-compose-deepen-kicker">Post-save deepen</div>
                  <div className="cp-compose-deepen-title">
                    {lastSaved ? lastSaved.title : 'Save to run pass 7'}
                  </div>
                </div>
                {engineJobId && (
                  <span
                    className={`cp-compose-engine-state cp-compose-engine-state--${
                      engineJob?.status ?? 'queued'
                    }`}
                  >
                    {engineJobLoading && !engineJob ? 'checking' : engineJob?.status ?? 'queued'}
                  </span>
                )}
              </div>

              {!engineJobId ? (
                <div className="cp-compose-deepen-copy">
                  Saving creates the object immediately, then the notebook engine runs the deepen
                  pass in the background.
                </div>
              ) : engineJob?.status === 'failed' ? (
                <div className="cp-compose-deepen-copy">
                  {engineJob.error || 'The deepen run failed before the job summary returned.'}
                </div>
              ) : (
                <>
                  <div className="cp-compose-deepen-copy">
                    {engineJob?.status === 'complete'
                      ? 'Graph deepen finished. Summary reflects the backend engine run.'
                      : 'The background engine is still extending the saved object through the notebook graph.'}
                  </div>
                  {summaryItems.length > 0 && (
                    <div className="cp-compose-summary-grid">
                      {summaryItems.map((item) => (
                        <div key={item.label} className="cp-compose-summary-card">
                          <span className="cp-compose-summary-label">{item.label}</span>
                          <span className="cp-compose-summary-value">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TerminalBlock>

            {degraded.degraded && (
              <div className="cp-compose-degraded">
                Running in degraded mode: {degraded.reasons.join(', ')}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
