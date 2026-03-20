'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type {
  EngineLogEntry,
  EngineCandidate,
  StressResult,
  EnginePassName,
} from '@/lib/commonplace-models';
import {
  ENGINE_PASS_COLOR,
  fetchEngineLog,
  fetchStressResult,
  fetchCandidates,
} from '@/lib/commonplace-models';

/**
 * EngineTerminal: fixed-bottom terminal spanning the full viewport.
 *
 * Two states:
 *   Collapsed (28px): status bar with engine dot, drift, event count
 *   Expanded (200px, resizable): three tabs (log, stress, candidates)
 *
 * Mounted in layout.tsx as a global overlay (like ObjectDrawer).
 * Uses createPortal to render into document.body so it escapes
 * any stacking context from the sidebar or split pane system.
 *
 * The scope toggle button switches between "all models" and
 * "current model" filtering for log entries.
 */

type TerminalTab = 'log' | 'stress' | 'candidates';

interface EngineTerminalProps {
  /** Currently open model ID (undefined = no model selected) */
  activeModelId?: number;
}

const COLLAPSED_HEIGHT = 28;
const DEFAULT_EXPANDED_HEIGHT = 200;
const MIN_EXPANDED_HEIGHT = 120;
const MAX_EXPANDED_HEIGHT = 500;

export default function EngineTerminal({
  activeModelId,
}: EngineTerminalProps) {
  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState(DEFAULT_EXPANDED_HEIGHT);
  const [activeTab, setActiveTab] = useState<TerminalTab>('log');
  const [scopeAll, setScopeAll] = useState(true);

  const [logEntries, setLogEntries] = useState<EngineLogEntry[]>([]);
  const [stressResult, setStressResult] = useState<StressResult | null>(null);
  const [candidates, setCandidates] = useState<EngineCandidate[]>([]);

  const [mounted, setMounted] = useState(false);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(
    null,
  );
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load data
  useEffect(() => {
    const modelId = scopeAll ? undefined : activeModelId;
    fetchEngineLog(modelId).then(setLogEntries);
  }, [scopeAll, activeModelId]);

  useEffect(() => {
    if (activeModelId) {
      fetchStressResult(activeModelId).then(setStressResult);
      fetchCandidates(activeModelId).then(setCandidates);
    }
  }, [activeModelId]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logEntries]);

  // Resize drag
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeRef.current = { startY: e.clientY, startHeight: height };

      const handleMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const delta = resizeRef.current.startY - ev.clientY;
        const next = Math.max(
          MIN_EXPANDED_HEIGHT,
          Math.min(MAX_EXPANDED_HEIGHT, resizeRef.current.startHeight + delta),
        );
        setHeight(next);
      };

      const handleUp = () => {
        resizeRef.current = null;
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [height],
  );

  const terminalHeight = expanded ? height : COLLAPSED_HEIGHT;

  const tabs: { id: TerminalTab; label: string }[] = [
    { id: 'log', label: 'Log' },
    { id: 'stress', label: 'Stress' },
    { id: 'candidates', label: `Candidates${candidates.length ? ` (${candidates.filter((c) => c.status === 'pending').length})` : ''}` },
  ];

  const content = (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: terminalHeight,
        zIndex: 9000,
        background: 'var(--cp-term, #1A1C22)',
        borderTop: '1px solid var(--cp-term-border, #2A2C32)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--cp-font-mono)',
        fontSize: 12,
        color: 'var(--cp-term-text, #C0C8D8)',
        transition: 'height 0.15s ease',
      }}
    >
      {/* Resize handle (only when expanded) */}
      {expanded && (
        <div
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            top: -3,
            left: 0,
            right: 0,
            height: 6,
            cursor: 'ns-resize',
            zIndex: 1,
          }}
        />
      )}

      {/* Status bar / collapsed view */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 12px',
          height: COLLAPSED_HEIGHT,
          flexShrink: 0,
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: expanded
            ? '1px solid var(--cp-term-border, #2A2C32)'
            : 'none',
        }}
      >
        {/* Engine status dot */}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--cp-term-green, #6AAA6A)',
            flexShrink: 0,
          }}
        />

        <span
          style={{
            fontWeight: 500,
            fontSize: 11,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Engine
        </span>

        {/* Drift indicator */}
        {stressResult && (
          <span
            style={{
              fontSize: 10,
              color: stressResult.drift > 0.15
                ? 'var(--cp-term-amber, #CCAA44)'
                : 'var(--cp-term-muted, #6A7080)',
            }}
          >
            drift {(stressResult.drift * 100).toFixed(0)}%
          </span>
        )}

        {/* Event count */}
        <span
          style={{
            fontSize: 10,
            color: 'var(--cp-term-muted, #6A7080)',
            marginLeft: 'auto',
          }}
        >
          {logEntries.length} events
        </span>

        {/* Scope toggle button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setScopeAll(!scopeAll);
          }}
          title={scopeAll ? 'Showing all models' : 'Showing current model'}
          style={{
            background: 'none',
            border: `1px solid ${scopeAll ? 'var(--cp-term-border, #2A2C32)' : 'var(--cp-term-amber, #CCAA44)'}`,
            borderRadius: 3,
            padding: '1px 6px',
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: 'var(--cp-font-mono)',
            color: scopeAll
              ? 'var(--cp-term-muted, #6A7080)'
              : 'var(--cp-term-amber, #CCAA44)',
            letterSpacing: '0.03em',
          }}
        >
          {scopeAll ? 'ALL' : 'THIS'}
        </button>

        {/* Expand chevron */}
        <span
          style={{
            fontSize: 10,
            color: 'var(--cp-term-muted, #6A7080)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          &#x25B2;
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <>
          {/* Tab bar */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              borderBottom: '1px solid var(--cp-term-border, #2A2C32)',
              flexShrink: 0,
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom:
                    activeTab === tab.id
                      ? '2px solid var(--cp-teal, #2D5F6B)'
                      : '2px solid transparent',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color:
                    activeTab === tab.id
                      ? 'var(--cp-term-text, #C0C8D8)'
                      : 'var(--cp-term-muted, #6A7080)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '8px 12px',
            }}
          >
            {activeTab === 'log' && (
              <LogTab entries={logEntries} logEndRef={logEndRef} />
            )}
            {activeTab === 'stress' && (
              <StressTab result={stressResult} />
            )}
            {activeTab === 'candidates' && (
              <CandidatesTab
                candidates={candidates}
                onUpdate={setCandidates}
              />
            )}
          </div>
        </>
      )}
    </div>
  );

  if (!mounted) return null;

  return createPortal(
    <div className="commonplace-theme">{content}</div>,
    document.body,
  );
}

/* ─────────────────────────────────────────────────
   Log tab
   ───────────────────────────────────────────────── */

function LogTab({
  entries,
  logEndRef,
}: {
  entries: EngineLogEntry[];
  logEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          color: 'var(--cp-term-muted, #6A7080)',
          fontSize: 11,
          fontStyle: 'italic',
        }}
      >
        No engine activity recorded.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {entries.map((entry) => (
        <LogLine key={entry.id} entry={entry} />
      ))}
      <div ref={logEndRef} />
    </div>
  );
}

function LogLine({ entry }: { entry: EngineLogEntry }) {
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const passColor = ENGINE_PASS_COLOR[entry.pass] ?? 'var(--cp-term-text)';

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'baseline',
        lineHeight: 1.6,
      }}
    >
      <span
        style={{
          color: 'var(--cp-term-muted, #6A7080)',
          fontSize: 10,
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {time}
      </span>
      <span
        style={{
          color: passColor,
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          flexShrink: 0,
          minWidth: 48,
        }}
      >
        {entry.pass}
      </span>
      <span style={{ fontSize: 11 }}>{entry.message}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Stress tab
   ───────────────────────────────────────────────── */

function StressTab({ result }: { result: StressResult | null }) {
  if (!result) {
    return (
      <div
        style={{
          color: 'var(--cp-term-muted, #6A7080)',
          fontSize: 11,
          fontStyle: 'italic',
        }}
      >
        No stress test results. Select a model to run stress analysis.
      </div>
    );
  }

  const severityIcon: Record<string, string> = {
    high: '\u25A0',
    medium: '\u25C6',
    low: '\u25CB',
  };

  const severityColor: Record<string, string> = {
    high: 'var(--cp-term-red, #CC6644)',
    medium: 'var(--cp-term-amber, #CCAA44)',
    low: 'var(--cp-term-muted, #6A7080)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
        <span>
          <span style={{ color: 'var(--cp-term-muted, #6A7080)' }}>
            Drift:{' '}
          </span>
          <span
            style={{
              color:
                result.drift > 0.15
                  ? 'var(--cp-term-amber, #CCAA44)'
                  : 'var(--cp-term-green, #6AAA6A)',
            }}
          >
            {(result.drift * 100).toFixed(1)}%
          </span>
        </span>
        <span>
          <span style={{ color: 'var(--cp-term-muted, #6A7080)' }}>
            Unlinked:{' '}
          </span>
          <span
            style={{
              color:
                result.unlinkedCount > 0
                  ? 'var(--cp-term-amber, #CCAA44)'
                  : 'var(--cp-term-green, #6AAA6A)',
            }}
          >
            {result.unlinkedCount}
          </span>
        </span>
      </div>

      {/* Findings */}
      {result.findings.map((f) => (
        <div
          key={f.id}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'baseline',
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          <span
            style={{
              color: severityColor[f.severity],
              fontSize: 10,
              flexShrink: 0,
            }}
          >
            {severityIcon[f.severity]}
          </span>
          <span>{f.text}</span>
          {f.linkedAssumptionId && (
            <span
              style={{
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 2,
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--cp-term-muted, #6A7080)',
                flexShrink: 0,
              }}
            >
              A{f.linkedAssumptionId}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Candidates tab
   ───────────────────────────────────────────────── */

function CandidatesTab({
  candidates,
  onUpdate,
}: {
  candidates: EngineCandidate[];
  onUpdate: (c: EngineCandidate[]) => void;
}) {
  const pending = candidates.filter((c) => c.status === 'pending');

  if (pending.length === 0) {
    return (
      <div
        style={{
          color: 'var(--cp-term-muted, #6A7080)',
          fontSize: 11,
          fontStyle: 'italic',
        }}
      >
        No pending candidates. Run the engine to discover new evidence links.
      </div>
    );
  }

  const handleAction = (id: number, status: 'accepted' | 'rejected') => {
    onUpdate(
      candidates.map((c) => (c.id === id ? { ...c, status } : c)),
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {pending.map((c) => (
        <div
          key={c.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 8px',
            borderRadius: 3,
            border: '1px dashed var(--cp-term-border, #2A2C32)',
            fontSize: 11,
          }}
        >
          {/* ENGINE label */}
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--cp-term-amber, #CCAA44)',
              flexShrink: 0,
            }}
          >
            ENGINE
          </span>

          {/* Object title */}
          <span style={{ flex: 1 }}>{c.objectTitle}</span>

          {/* Relation + target */}
          <span
            style={{
              fontSize: 10,
              color:
                c.relation === 'supports'
                  ? 'var(--cp-term-green, #6AAA6A)'
                  : 'var(--cp-term-red, #CC6644)',
            }}
          >
            {c.relation} A{c.suggestedAssumptionId}
          </span>

          {/* Confidence */}
          <span
            style={{
              fontSize: 10,
              color: 'var(--cp-term-muted, #6A7080)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(c.confidence * 100)}%
          </span>

          {/* Accept / Reject */}
          <button
            onClick={() => handleAction(c.id, 'accepted')}
            title="Accept candidate"
            style={{
              background: 'none',
              border: '1px solid var(--cp-term-green, #6AAA6A)',
              borderRadius: 2,
              padding: '1px 6px',
              cursor: 'pointer',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              color: 'var(--cp-term-green, #6AAA6A)',
            }}
          >
            &#x2713;
          </button>
          <button
            onClick={() => handleAction(c.id, 'rejected')}
            title="Reject candidate"
            style={{
              background: 'none',
              border: '1px solid var(--cp-term-red, #CC6644)',
              borderRadius: 2,
              padding: '1px 6px',
              cursor: 'pointer',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              color: 'var(--cp-term-red, #CC6644)',
            }}
          >
            &#x2717;
          </button>
        </div>
      ))}
    </div>
  );
}
