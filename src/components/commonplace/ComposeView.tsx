'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import type { Editor } from '@tiptap/react';
import type { TiptapUpdatePayload } from '@/components/studio/TiptapEditor';
import {
  OBJECT_TYPES,
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
import LiveResearchGraph from './LiveResearchGraph';

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

interface ComposeEntityChip {
  id: string;
  label: string;
  slug: string;
  type: string;
}

function toEntityChip(result: ComposeLiveResult): ComposeEntityChip | null {
  const carriesNer = result.signal === 'ner' || result.supportingSignals.includes('ner');
  if (!carriesNer) return null;

  const loweredType = result.type.toLowerCase();
  if (!['person', 'place', 'organization', 'concept'].includes(loweredType)) return null;

  return {
    id: `${result.id}:${loweredType}`,
    label: result.title,
    slug: result.slug,
    type: loweredType,
  };
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
  const { openDrawer } = useCommonPlace();

  const [title, setTitle] = useState('');
  const [objectType, setObjectType] = useState(prefillType ?? 'note');
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
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [terminalTab, setTerminalTab] = useState<'passes' | 'tension' | 'gaps' | 'stash'>('passes');
  const [stashItems] = useState<string[]>([]);
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
    togglePause: toggleLivePause,
    activeSignals,
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
  const liveCharacters = liveText.trim().length;
  const liveWords = useMemo(() => {
    const normalized = liveText.trim();
    if (!normalized) return 0;
    return normalized.split(/\s+/).length;
  }, [liveText]);

  const entityChips = useMemo(() => {
    const byKey = new Map<string, ComposeEntityChip>();
    for (const result of results) {
      const chip = toEntityChip(result);
      if (!chip) continue;
      if (!byKey.has(chip.id)) byKey.set(chip.id, chip);
    }
    return Array.from(byKey.values()).slice(0, 8);
  }, [results]);

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

  return (
    <div className="cp-compose-pane">
      <div className="cp-compose-instrument-bar">
        <div className="cp-compose-instrument-copy">
          <span className="cp-compose-instrument-label">Compose instrument</span>
          <span className="cp-compose-instrument-meta">
            {typeIdentity.label} surface · {liveWords} words · {liveCharacters} chars
          </span>
        </div>
        <div className="cp-compose-instrument-copy cp-compose-instrument-copy--right">
          <span className="cp-compose-instrument-label">Live engine</span>
          <span className="cp-compose-instrument-meta">
            {livePaused ? 'paused' : 'listening'} · {results.length} surfaced
          </span>
        </div>
      </div>

      <div className="cp-compose-type-bar">
        {OBJECT_TYPES.map((item) => (
          <button
            key={item.slug}
            type="button"
            className={`cp-compose-type-pill${objectType === item.slug ? ' active' : ''}`}
            style={{ '--pill-color': item.color } as CSSProperties}
            onClick={() => setObjectType(item.slug)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="cp-compose-entity-bar">
        {entityChips.length > 0 ? (
          entityChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`cp-compose-entity-chip cp-compose-entity-chip--${chip.type}`}
              onClick={() => openDrawer(chip.slug)}
              title={`Open ${chip.label}`}
            >
              {chip.label}
            </button>
          ))
        ) : (
          <div className="cp-compose-entity-placeholder">
            Named entities and object matches appear here while you write.
          </div>
        )}
      </div>

      <div className="cp-compose-layout">
        <div className="cp-compose-editor-shell">
          <div className="cp-compose-editor-topline">
            <span
              className="cp-compose-editor-type"
              style={{ '--compose-type-color': typeIdentity.color } as CSSProperties}
            >
              {typeIdentity.label}
            </span>
            <span className="cp-compose-editor-prompt">
              Six live passes run while typing. Graph deepen runs after save.
            </span>
          </div>

          <input
            type="text"
            className="cp-compose-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={`Untitled ${typeIdentity.label}`}
          />

          <div className="cp-compose-editor-area">
            <CommonPlaceEditor
              initialContent={prefillText}
              initialContentFormat="markdown"
              onUpdate={handleEditorUpdate}
              onEditorReady={handleEditorReady}
              placeholder="Write into the graph. Direct mentions, shared entities, keyword fields, topic similarity, semantic neighbors, and claim tension surface here as you draft."
            />
          </div>

          <div className="cp-compose-tension-row">
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
            <span className="cp-compose-tension-hint">
              NLI contradiction analysis on current draft.
            </span>
          </div>
        </div>

        <aside className="cp-compose-graph-panel">
          <div className="cp-compose-dock-header">
            <div>
              <div className="cp-compose-dock-kicker">Discovery dock</div>
              <div className="cp-compose-dock-title">Related objects and pass activity</div>
            </div>
            <button
              type="button"
              className={`cp-compose-nli-pill${enableNli ? ' cp-compose-nli-pill--active' : ''}`}
              onClick={() => setEnableNli((prev) => !prev)}
            >
              NLI {enableNli ? 'on' : 'off'}
            </button>
          </div>

          <LiveResearchGraph
            results={results}
            loading={liveLoading}
            paused={livePaused}
            activeSignals={activeSignals}
            enableNli={enableNli}
            onTogglePause={toggleLivePause}
            onToggleNli={() => setEnableNli((prev) => !prev)}
            onOpenObject={(slug) => openDrawer(slug)}
          />

          <div className="cp-compose-results-panel">
            {results.length === 0 ? (
              <div className="cp-compose-results-empty">
                {liveCharacters < 20
                  ? 'Keep writing. Live discovery starts after 20 characters.'
                  : 'No related objects cleared the current signal thresholds.'}
              </div>
            ) : (
              results.slice(0, 6).map((result) => {
                const resultType = getObjectTypeIdentity(result.type);
                return (
                  <button
                    key={result.id}
                    type="button"
                    className="cp-compose-result-card"
                    onClick={() => openDrawer(result.slug)}
                  >
                    <div className="cp-compose-result-meta">
                      <span
                        className="cp-compose-result-type"
                        style={{ '--result-type-color': resultType.color } as CSSProperties}
                      >
                        {resultType.label}
                      </span>
                      <span className="cp-compose-result-score">
                        {Math.round(result.score * 100)}%
                      </span>
                    </div>
                    <div className="cp-compose-result-title">{result.title}</div>
                    <div className="cp-compose-result-signal">
                      {SIGNAL_LABELS[result.signal]}
                    </div>
                    <div className="cp-compose-result-explanation">{result.explanation}</div>
                    {result.supportingSignals.length > 0 && (
                      <div className="cp-compose-result-support">
                        {result.supportingSignals.map((signal) => (
                          <span key={`${result.id}-${signal}`} className="cp-compose-support-chip">
                            {SIGNAL_LABELS[signal]}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="cp-compose-deepen-panel">
            <div className="cp-compose-deepen-header">
              <div>
                <div className="cp-compose-deepen-kicker">Post-save deepen</div>
                <div className="cp-compose-deepen-title">
                  {lastSaved ? lastSaved.title : 'Save to run pass 7'}
                </div>
              </div>
              {engineJobId && (
                <span className={`cp-compose-engine-state cp-compose-engine-state--${engineJob?.status ?? 'queued'}`}>
                  {engineJobLoading && !engineJob ? 'checking' : engineJob?.status ?? 'queued'}
                </span>
              )}
            </div>

            {!engineJobId ? (
              <div className="cp-compose-deepen-copy">
                Saving creates the object immediately, then the notebook engine runs the deepen pass in the background.
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
                {lastSaved && (
                  <button
                    type="button"
                    className="cp-compose-open-saved"
                    onClick={() => openDrawer(lastSaved.slug)}
                  >
                    Open saved object
                  </button>
                )}
              </>
            )}
          </div>

          {degraded.degraded && (
            <div className="cp-compose-degraded">
              Running in degraded mode: {degraded.reasons.join(', ')}
            </div>
          )}
        </aside>
      </div>

      {/* Bottom engine terminal */}
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
          {terminalOpen ? (
            <div className="cp-compose-terminal-tabs-row">
              {(['passes', 'tension', 'gaps', 'stash'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`cp-compose-terminal-tab${terminalTab === tab ? ' active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTerminalTab(tab);
                  }}
                >
                  {tab === 'passes' ? 'Passes' : tab === 'tension' ? 'Tension' : tab === 'gaps' ? 'Gaps' : 'Stash'}
                </button>
              ))}
            </div>
          ) : (
            <div className="cp-compose-terminal-status">
              <span className="cp-compose-terminal-label">ENGINE</span>
              <div className="cp-compose-terminal-dots">
                {livePasses.map((passId) => {
                  const state = passStateMap.get(passId);
                  const dotStatus =
                    liveCharacters < 20
                      ? 'standby'
                      : state?.status === 'degraded'
                        ? 'degraded'
                        : 'complete';
                  return (
                    <span
                      key={passId}
                      className={`cp-compose-terminal-dot cp-compose-terminal-dot--${dotStatus}`}
                      title={PASS_LABELS[passId]}
                    />
                  );
                })}
              </div>
            </div>
          )}
          <span className="cp-compose-terminal-toggle" aria-hidden="true">
            {terminalOpen ? '▾' : '▸'}
          </span>
        </div>

        {terminalOpen && (
          <div className="cp-compose-terminal-content">
            {terminalTab === 'passes' && (
              <div className="cp-compose-terminal-passes">
                {livePasses.map((passId) => {
                  const state = passStateMap.get(passId);
                  const status =
                    liveCharacters < 20
                      ? 'standby'
                      : state?.status === 'degraded'
                        ? 'degraded'
                        : 'complete';
                  return (
                    <div key={passId} className={`cp-compose-pass-row cp-compose-pass-row--${status}`}>
                      <span className={`cp-compose-terminal-dot cp-compose-terminal-dot--${status}`} />
                      <span className="cp-compose-pass-name">{PASS_LABELS[passId]}</span>
                      <span className="cp-compose-pass-count">
                        {liveCharacters < 20 ? 'standby' : `${state?.match_count ?? 0} hits`}
                      </span>
                      {state?.degraded_reason && (
                        <span className="cp-compose-pass-reason">{state.degraded_reason}</span>
                      )}
                    </div>
                  );
                })}
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
                {stashItems.length === 0 ? (
                  <div className="cp-compose-terminal-empty">
                    Right-click any object and choose "Stash for Later" to collect fragments here.
                  </div>
                ) : (
                  stashItems.map((item, i) => (
                    <div key={i} className="cp-compose-stash-item">
                      {item}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="cp-compose-save-bar">
        <div className="cp-compose-save-context">
          <span className="cp-compose-save-label">Capture / manipulate / discover</span>
          <span className="cp-compose-save-hint">Save commits this draft to the notebook engine.</span>
        </div>
        {error && <span className="cp-compose-error">{error}</span>}
        <button
          type="button"
          className="cp-compose-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save object'}
        </button>
      </div>
    </div>
  );
}
