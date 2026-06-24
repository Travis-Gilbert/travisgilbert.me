'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { getObjectTypeIdentity, OBJECT_TYPES } from '@/lib/commonplace';
import type { CapturedObject } from '@/lib/commonplace';
import {
  searchObjects,
  fetchInquiryPlan,
  startInquiry,
  fetchInquiryProgress,
  fetchInquiryResult,
  type ObjectSearchResult,
  type InquiryPlanResult,
  type InquiryProgress,
  type InquiryResultData,
} from '@/lib/commonplace-api';
import {
  createCapturedObject,
  isUrl,
  syncCapture,
} from '@/lib/commonplace-capture';
import { useCapture } from '@/lib/providers/capture-provider';
import { useLayout } from '@/lib/providers/layout-provider';
import { useWorkspace } from '@/lib/providers/workspace-provider';
import { toast } from 'sonner';
import type { RenderableObject } from '../objects/ObjectRenderer';
import TerminalBlock from '../engine/TerminalBlock';

/* ─────────────────────────────────────────────────
   Slash commands
   ───────────────────────────────────────────────── */

const ORGANIZE_COMMANDS = [
  { id: 'file',     label: 'file',     description: 'Add to a collection',       tag: 'Organize' },
  { id: 'delegate', label: 'delegate', description: 'Send to agent for action',   tag: 'Agent'    },
  { id: 'draft',    label: 'draft',    description: 'Draft a response from this', tag: 'Compose'  },
  { id: 'develop',  label: 'develop',  description: 'Develop this idea further',  tag: 'Compose'  },
] as const;

const TYPE_COMMANDS = OBJECT_TYPES.slice(0, 6).map((t) => ({
  id: `type-${t.slug}` as string,
  label: t.slug,
  description: `Capture as ${t.label}`,
  tag: t.label,
  color: t.color as string | undefined,
}));

const ALL_COMMANDS = [...ORGANIZE_COMMANDS, ...TYPE_COMMANDS];
type CommandEntry = (typeof ALL_COMMANDS)[number];
type OrganizeCommandId = (typeof ORGANIZE_COMMANDS)[number]['id'];

/* ─────────────────────────────────────────────────
   Inquiry phases (preserved from InquiryBar)
   ───────────────────────────────────────────────── */

type InquiryPhase =
  | 'internal_retrieval'
  | 'planning'
  | 'external_search'
  | 'fetch_capture'
  | 'extraction'
  | 'linking'
  | 'synthesis';

const INQUIRY_PHASES: InquiryPhase[] = [
  'internal_retrieval',
  'planning',
  'external_search',
  'fetch_capture',
  'extraction',
  'linking',
  'synthesis',
];

function resultToRenderable(result: ObjectSearchResult): RenderableObject {
  const identity =
    OBJECT_TYPES.find((type) => (
      type.slug === result.object_type_name ||
      type.label.toLowerCase() === result.object_type_name.toLowerCase()
    )) ?? getObjectTypeIdentity(result.object_type_name);
  return {
    id: result.id,
    slug: result.slug,
    title: result.title,
    display_title: result.display_title || result.title,
    object_type_slug: identity.slug,
    captured_at: result.captured_at,
    status: result.status,
  };
}

function commandText(command: OrganizeCommandId, target: ObjectSearchResult | null, fallback: string): string {
  const title = target?.display_title || target?.title || fallback || 'the selected object';
  switch (command) {
    case 'delegate':
      return `Plan the next concrete action for ${title}.`;
    case 'draft':
      return `Draft from this CommonPlace object:\n\n${title}`;
    case 'develop':
      return `Develop this into a fuller note:\n\n${title}`;
    case 'file':
    default:
      return title;
  }
}

/* ─────────────────────────────────────────────────
   Props
   ───────────────────────────────────────────────── */

interface CommandBarProps {
  gapCount?: number;
  onOpenObject?: (objectRef: number) => void;
  onInquiryComplete?: (result: InquiryResultData) => void;
  /** Pre-fills the input and focuses. Parent should clear via onExternalQueryConsumed. */
  externalQuery?: string;
  onExternalQueryConsumed?: () => void;
  /**
   * When provided, called after local object creation (parent handles sync + UI update).
   * When absent, the bar syncs internally and bumps captureVersion via notifyCaptured.
   */
  onCapture?: (object: CapturedObject) => void;
}

/* ─────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────── */

export default function CommandBar({
  gapCount = 0,
  onOpenObject,
  onInquiryComplete,
  externalQuery,
  onExternalQueryConsumed,
  onCapture,
}: CommandBarProps) {
  const { notifyCaptured } = useCapture();
  const { launchView } = useLayout();
  const { stashObject } = useWorkspace();

  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [webEnabled, setWebEnabled] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [selectedTarget, setSelectedTarget] = useState<ObjectSearchResult | null>(null);

  const [graphResults, setGraphResults] = useState<ObjectSearchResult[]>([]);
  const [planResult, setPlanResult] = useState<InquiryPlanResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [runningInquiry, setRunningInquiry] = useState<InquiryProgress | null>(null);
  const [inquiryResult, setInquiryResult] = useState<InquiryResultData | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* ─── Derived mode ─── */
  const trimmed = query.trim();
  const isCommandMode = trimmed.startsWith('/');
  const isCaptureInput = !isCommandMode && trimmed.length > 0;
  const isExpanded = isFocused && trimmed.length > 0;
  const isRunning = runningInquiry !== null && !inquiryResult;

  const commandFilter = isCommandMode ? trimmed.slice(1).toLowerCase() : '';
  const commandName = commandFilter.split(/\s+/)[0] ?? '';
  const commandRemainder = commandFilter.split(/\s+/).slice(1).join(' ').trim();
  const filteredCommands = useMemo(
    () => (isCommandMode
      ? ALL_COMMANDS.filter((c) => c.label.startsWith(commandName))
      : []),
    [commandName, isCommandMode],
  );
  const commandTarget = useMemo(
    () => selectedTarget ?? graphResults[0] ?? null,
    [graphResults, selectedTarget],
  );

  /* ─── Cmd+K / Ctrl+K global summon ─── */
  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsFocused(true);
      }
    }
    document.addEventListener('keydown', onGlobalKey);
    return () => document.removeEventListener('keydown', onGlobalKey);
  }, []);

  /* ─── External query ─── */
  useEffect(() => {
    if (!externalQuery) return;
    const timer = window.setTimeout(() => {
      setQuery(externalQuery);
      setIsFocused(true);
      inputRef.current?.focus();
      onExternalQueryConsumed?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [externalQuery, onExternalQueryConsumed]);

  /* ─── Debounced graph search ─── */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!trimmed) {
      const timer = window.setTimeout(() => {
        setGraphResults([]);
        setSelectedTarget(null);
        setPlanResult(null);
        setIsSearching(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (isCommandMode) {
      const timer = window.setTimeout(() => {
        setPlanResult(null);
        setIsSearching(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const startTimer = window.setTimeout(() => setIsSearching(true), 0);
    debounceRef.current = setTimeout(async () => {
      const [objects, plan] = await Promise.allSettled([
        searchObjects(trimmed, 5),
        fetchInquiryPlan(trimmed),
      ]);
      if (objects.status === 'fulfilled') {
        setGraphResults(objects.value);
        setSelectedTarget((current) => current ?? objects.value[0] ?? null);
      }
      if (plan.status === 'fulfilled') setPlanResult(plan.value);
      setIsSearching(false);
    }, 180);
    return () => {
      window.clearTimeout(startTimer);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmed, isCommandMode]);

  /* ─── Poll inquiry progress ─── */
  useEffect(() => {
    if (!runningInquiry || inquiryResult) return;
    const poll = async () => {
      try {
        const progress = await fetchInquiryProgress(runningInquiry.id);
        setRunningInquiry(progress);
        if (progress.status === 'succeeded') {
          const result = await fetchInquiryResult(progress.id);
          setInquiryResult(result);
          onInquiryComplete?.(result);
        } else if (progress.status !== 'failed' && progress.status !== 'cancelled') {
          pollRef.current = setTimeout(poll, 2000);
        }
      } catch {
        pollRef.current = setTimeout(poll, 3000);
      }
    };
    pollRef.current = setTimeout(poll, 2000);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [runningInquiry?.id, runningInquiry?.status, inquiryResult, onInquiryComplete, runningInquiry]);

  /* ─── Outside click ─── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
        setSelectedIdx(-1);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ─── Capture ─── */
  const handleCapture = useCallback(
    async (typeOverride?: string, textOverride?: string) => {
      const captureText = (textOverride ?? trimmed).trim();
      if (!captureText) {
        toast.message('Type something to capture');
        return;
      }
      const obj = createCapturedObject({
        text: captureText,
        captureMethod: 'typed',
        objectType: typeOverride,
        sourceUrl: isUrl(captureText) ? captureText : undefined,
      });
      setQuery('');
      setIsFocused(false);
      setSelectedIdx(-1);
      setSelectedTarget(null);
      if (onCapture) {
        onCapture(obj);
      } else {
        const result = await syncCapture(obj);
        if (result.ok) {
          notifyCaptured();
        } else {
          toast.error(result.error ?? 'Capture failed');
        }
      }
    },
    [trimmed, onCapture, notifyCaptured],
  );

  /* ─── Web inquiry ─── */
  const handleSearchWeb = useCallback(async (force = false) => {
    if (!trimmed || (!force && !webEnabled)) return;
    setIsFocused(false);
    try {
      const resp = await startInquiry({ query: trimmed, external_search: true });
      setRunningInquiry({
        id: resp.inquiry_id,
        status: resp.status,
        phase: 'internal_retrieval',
        progress: { subqueries: 0, subqueries_completed: 0, hits_total: 0, hits_captured: 0 },
      });
      setInquiryResult(null);
    } catch {
      toast.error('Inquiry could not start');
    }
  }, [trimmed, webEnabled]);

  const closeBar = useCallback(() => {
    setQuery('');
    setIsFocused(false);
    setSelectedIdx(-1);
  }, []);

  const handleCommand = useCallback(
    async (cmd: CommandEntry) => {
      if (cmd.id.startsWith('type-')) {
        await handleCapture(cmd.label, commandRemainder);
        return;
      }

      const action = cmd.id as OrganizeCommandId;
      const target = commandTarget;
      const targetObject = target ? resultToRenderable(target) : null;
      const fallbackText = commandRemainder || trimmed.replace(/^\/\S+\s*/, '').trim();

      if ((action === 'file' || action === 'delegate') && targetObject) {
        stashObject(targetObject);
      }

      switch (action) {
        case 'file':
          launchView('files', target ? { objectSlug: target.slug, action: 'file' } : undefined);
          toast.message(target ? `Ready to file "${target.display_title || target.title}"` : 'Open Files to choose a collection');
          break;
        case 'delegate':
          launchView(
            'connection-engine',
            target ? { objectSlug: target.slug, action: 'delegate' } : { action: 'delegate' },
            true,
          );
          toast.message(target ? `Delegating "${target.display_title || target.title}"` : 'Delegation queue opened');
          break;
        case 'draft':
          launchView('compose', {
            prefillText: commandText(action, target, fallbackText),
            prefillType: 'note',
          }, true);
          break;
        case 'develop':
          launchView('compose', {
            prefillText: commandText(action, target, fallbackText),
            prefillType: 'hunch',
          }, true);
          break;
        default:
          break;
      }

      closeBar();
    },
    [
      closeBar,
      commandRemainder,
      commandTarget,
      handleCapture,
      launchView,
      stashObject,
      trimmed,
    ],
  );

  /* ─── Keyboard navigation (APG combobox) ─── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setIsFocused(false);
        setSelectedIdx(-1);
        return;
      }
      const items = isCommandMode ? filteredCommands : graphResults;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, items.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (isCommandMode) {
          const cmd =
            selectedIdx >= 0
              ? filteredCommands[selectedIdx]
              : filteredCommands.find((entry) => entry.label === commandName) ?? filteredCommands[0];
          if (cmd) handleCommand(cmd);
          return;
        }
        if (!isCommandMode && selectedIdx >= 0 && graphResults[selectedIdx]) {
          setSelectedTarget(graphResults[selectedIdx]);
          onOpenObject?.(graphResults[selectedIdx].id);
          setIsFocused(false);
          setSelectedIdx(-1);
          return;
        }
        if (!isCommandMode && trimmed.endsWith('?')) {
          handleSearchWeb(true);
          return;
        }
        if (isCaptureInput) {
          handleCapture();
        }
      }
    },
    [
      isCommandMode,
      filteredCommands,
      graphResults,
      selectedIdx,
      isCaptureInput,
      handleCapture,
      handleCommand,
      handleSearchWeb,
      onOpenObject,
      trimmed,
      commandName,
    ],
  );

  /* ─── Phase helpers ─── */
  function getPhaseStatus(phase: InquiryPhase): 'done' | 'active' | 'pending' {
    if (!runningInquiry) return 'pending';
    const currentIdx = INQUIRY_PHASES.indexOf(runningInquiry.phase as InquiryPhase);
    const phaseIdx = INQUIRY_PHASES.indexOf(phase);
    if (phaseIdx < currentIdx) return 'done';
    if (phaseIdx === currentIdx) return inquiryResult ? 'done' : 'active';
    return 'pending';
  }

  function getPhaseDetail(phase: InquiryPhase): string {
    if (!runningInquiry) return '';
    const p = runningInquiry.progress;
    switch (phase) {
      case 'internal_retrieval':
        return getPhaseStatus(phase) === 'done' ? `${graphResults.length} related` : '';
      case 'planning':
        return getPhaseStatus(phase) === 'done' ? `${p.subqueries} subqueries` : '';
      case 'external_search':
        return getPhaseStatus(phase) === 'active'
          ? `subquery ${p.subqueries_completed}/${p.subqueries}...`
          : getPhaseStatus(phase) === 'done'
          ? `${p.subqueries} complete`
          : '';
      case 'fetch_capture':
        return getPhaseStatus(phase) === 'done' ? `${p.hits_captured} captured` : '';
      default:
        return '';
    }
  }

  /* ─── ARIA IDs ─── */
  const listboxId = 'cp-cmdbar-listbox';
  const activeDescendantId = selectedIdx >= 0 ? `cp-cmdbar-opt-${selectedIdx}` : undefined;

  /* ─── Render ─── */
  return (
    <div ref={containerRef} className="cp-inquiry-container cp-cmdbar">
      {/* ── Input row ── */}
      <div
        className={`cp-inquiry-input-row${isFocused ? ' cp-inquiry-input-row--focused' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {isCommandMode ? (
          <span className="cp-cmdbar-slash-icon" aria-hidden="true">/</span>
        ) : (
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            className="cp-inquiry-search-icon"
            stroke={isFocused ? 'var(--cp-red)' : 'var(--cp-text-faint)'}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx={11} cy={11} r={8} />
            <line x1={21} y1={21} x2={16.65} y2={16.65} />
          </svg>
        )}

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isExpanded && !isRunning}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeDescendantId}
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setSelectedIdx(-1);
            if (!val.trim().startsWith('/')) {
              setSelectedTarget(null);
            }
            if (val.trim().length > 0 && !val.startsWith('/') && !webEnabled) {
              setWebEnabled(true);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={
            isCommandMode
              ? 'file, delegate, draft, develop...'
              : 'Search, capture, or / for commands'
          }
          className="cp-inquiry-input"
        />

        {/* Mode badge */}
        {isCommandMode && (
          <span className="cp-cmdbar-mode-tag cp-cmdbar-mode-tag--command">CMD</span>
        )}
        {!isCommandMode && isCaptureInput && !isSearching && graphResults.length === 0 && (
          <span className="cp-cmdbar-mode-tag cp-cmdbar-mode-tag--capture">CAPTURE</span>
        )}

        {/* Web toggle */}
        {webEnabled && !isCommandMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setWebEnabled(false);
            }}
            title="Web search on (click to disable)"
            className="cp-inquiry-web-toggle cp-inquiry-web-toggle--on"
          >
            WEB ON
          </button>
        )}

        {gapCount > 0 && (
          <span
            title={`${gapCount} knowledge gap${gapCount !== 1 ? 's' : ''} detected`}
            className="cp-inquiry-gap-count"
          >
            {gapCount} gap{gapCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Dropdown (expanded state) ── */}
      {isExpanded && !isRunning && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Command bar options"
          className="cp-inquiry-dropdown"
        >
          {/* Command mode: slash palette */}
          {isCommandMode && (
            <>
              <div className="cp-inquiry-group-label">Commands</div>
              {commandTarget && (
                <div className="cp-cmdbar-target-row">
                  <span>Target</span>
                  <strong>{commandTarget.display_title || commandTarget.title}</strong>
                </div>
              )}
              {filteredCommands.length === 0 && (
                <div className="cp-inquiry-searching">No matching commands</div>
              )}
              {filteredCommands.map((cmd, i) => (
                <button
                  key={cmd.id}
                  id={`cp-cmdbar-opt-${i}`}
                  role="option"
                  aria-selected={selectedIdx === i}
                  type="button"
                  onClick={() => {
                    handleCommand(cmd);
                  }}
                  className={`cp-cmdbar-command-row${selectedIdx === i ? ' cp-cmdbar-command-row--selected' : ''}`}
                >
                  {'color' in cmd && cmd.color && (
                    <span className="cp-inquiry-result-dot" style={{ background: cmd.color }} />
                  )}
                  <span className="cp-cmdbar-command-label">/{cmd.label}</span>
                  <span className="cp-cmdbar-command-desc">{cmd.description}</span>
                  <span className="cp-cmdbar-command-tag">{cmd.tag}</span>
                </button>
              ))}
            </>
          )}

          {/* Search mode: graph results */}
          {!isCommandMode && (graphResults.length > 0 || isSearching) && (
            <>
              <div className="cp-inquiry-group-label">
                In your graph{graphResults.length > 0 ? ` (${graphResults.length})` : ''}
              </div>
              {graphResults.map((result, i) => {
                const identity = getObjectTypeIdentity(result.object_type_name);
                return (
                  <button
                    key={result.id}
                    id={`cp-cmdbar-opt-${i}`}
                    role="option"
                    aria-selected={selectedIdx === i}
                    type="button"
                    onClick={() => {
                      setSelectedTarget(result);
                      setIsFocused(false);
                      setSelectedIdx(-1);
                      onOpenObject?.(result.id);
                    }}
                    className={`cp-inquiry-result-row${selectedIdx === i ? ' cp-inquiry-result-row--selected' : ''}`}
                  >
                    <span className="cp-inquiry-result-dot" style={{ background: identity.color }} />
                    <span className="cp-inquiry-result-title">
                      {result.display_title || result.title}
                    </span>
                    <span className="cp-inquiry-result-type">{identity.label}</span>
                  </button>
                );
              })}
              {isSearching && graphResults.length === 0 && (
                <div className="cp-inquiry-searching">Searching...</div>
              )}
            </>
          )}

          {/* Capture offer — always shown when there is capturable input */}
          {isCaptureInput && !isCommandMode && (
            <div className="cp-cmdbar-capture-section">
              <div className="cp-inquiry-group-label">Capture</div>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => handleCapture()}
                className="cp-cmdbar-capture-row"
              >
                <span className="cp-cmdbar-capture-icon" aria-hidden="true">+</span>
                <span className="cp-cmdbar-capture-text">
                  {isUrl(trimmed) ? 'Save link' : 'Save as note'}:{' '}
                  <em className="cp-cmdbar-capture-preview">
                    {trimmed.slice(0, 52)}{trimmed.length > 52 ? '…' : ''}
                  </em>
                </span>
              </button>
            </div>
          )}

          {/* Suggested searches */}
          {!isCommandMode && planResult && planResult.subqueries.length > 0 && (
            <>
              <div className="cp-inquiry-group-label">Suggested searches</div>
              {planResult.subqueries.map((sq, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setQuery(sq.query);
                    inputRef.current?.focus();
                  }}
                  className="cp-inquiry-suggestion-row"
                >
                  <span className="cp-inquiry-suggestion-icon" style={{ color: 'var(--cp-text-muted)' }}>Q</span>
                  <div style={{ flex: 1 }}>
                    <div className="cp-inquiry-suggestion-text">&ldquo;{sq.query}&rdquo;</div>
                    <div className="cp-inquiry-suggestion-meta">{sq.purpose}</div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Evidence gaps */}
          {!isCommandMode && planResult && planResult.internal_context.evidence_gaps.length > 0 && (
            <>
              <div className="cp-inquiry-group-label">Gaps in your knowledge</div>
              {planResult.internal_context.evidence_gaps.map((gap, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setQuery(gap.description);
                    inputRef.current?.focus();
                  }}
                  className="cp-inquiry-suggestion-row"
                >
                  <span className="cp-inquiry-suggestion-icon" style={{ color: 'var(--cp-term-amber)' }}>!</span>
                  <div style={{ flex: 1 }}>
                    <div className="cp-inquiry-suggestion-text">{gap.description}</div>
                    <div className="cp-inquiry-suggestion-meta">
                      {gap.priority > 0.7 ? 'High priority' : 'Evidence gap'}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Action buttons */}
          {!isCommandMode && (
            <div className="cp-inquiry-actions">
              <button
                type="button"
                onClick={() => setIsFocused(false)}
                className="cp-inquiry-action-btn"
              >
                SEARCH GRAPH
              </button>
              <button
                type="button"
                onClick={() => handleSearchWeb()}
                disabled={!webEnabled}
                className={`cp-inquiry-action-btn${webEnabled ? ' cp-inquiry-action-btn--web' : ''}`}
              >
                SEARCH WEB
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Terminal block (running inquiry) ── */}
      {isRunning && (
        <TerminalBlock
          title={`Inquiry: ${query}`}
          status="running"
          style={{ marginTop: 10 }}
        >
          {INQUIRY_PHASES.map((phase) => {
            const status = getPhaseStatus(phase);
            return (
              <div key={phase} className="cp-inquiry-phase-row">
                <span className={`cp-inquiry-phase-icon cp-inquiry-phase-icon--${status}`}>
                  {status === 'done' ? '✓' : status === 'active' ? '●' : '○'}
                </span>
                <span className={`cp-inquiry-phase-label${status === 'pending' ? ' cp-inquiry-phase-label--pending' : ''}`}>
                  {phase.replace(/_/g, ' ')}
                </span>
                <span className="cp-inquiry-phase-detail">{getPhaseDetail(phase)}</span>
              </div>
            );
          })}
        </TerminalBlock>
      )}

      {/* ── Inquiry result ── */}
      {inquiryResult && (
        <TerminalBlock title="Inquiry Results" status="complete" style={{ marginTop: 10 }}>
          {inquiryResult.answer.answer_text && (
            <div className="cp-inquiry-result-answer">
              <div className="cp-inquiry-result-label">
                Answer (confidence: {inquiryResult.answer.confidence.toFixed(2)})
              </div>
              <div>{inquiryResult.answer.answer_text}</div>
            </div>
          )}

          <div className="cp-inquiry-result-summary">
            {inquiryResult.supporting_evidence.length} supporting
            {inquiryResult.contradicting_evidence.length > 0 &&
              ` · ${inquiryResult.contradicting_evidence.length} contradicting`}
            {inquiryResult.what_changed.new_artifacts_captured > 0 &&
              ` · ${inquiryResult.what_changed.new_artifacts_captured} new artifacts`}
          </div>

          {inquiryResult.open_gaps.length > 0 && (
            <div className="cp-inquiry-result-gaps">
              <div className="cp-inquiry-result-gaps-label">Still missing</div>
              {inquiryResult.open_gaps.map((gap, i) => (
                <div key={i} className="cp-inquiry-result-gap-item">{gap.description}</div>
              ))}
            </div>
          )}

          <div className="cp-inquiry-dismiss-row">
            <button
              type="button"
              onClick={() => {
                setRunningInquiry(null);
                setInquiryResult(null);
              }}
              className="cp-inquiry-dismiss-btn"
            >
              DISMISS
            </button>
          </div>
        </TerminalBlock>
      )}
    </div>
  );
}
