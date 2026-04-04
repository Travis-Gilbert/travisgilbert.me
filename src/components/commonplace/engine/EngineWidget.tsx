'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type {
  EngineLogEntry,
  EngineCandidate,
  StressResult,
} from '@/lib/commonplace-models';
import {
  fetchEngineLog,
  fetchStressResult,
  fetchCandidates,
} from '@/lib/commonplace-models';
import { useDrawer } from '@/lib/providers/drawer-provider';
import TerminalCanvas from './TerminalCanvas';
import EngineAskTab from './EngineAskTab';
import EngineAnalyzeTab from './EngineAnalyzeTab';
import { humanizeLogEntry, generateIdleThought } from './humanize';

type WidgetTab = 'ask' | 'analyze' | 'log' | 'stress' | 'candidates';

interface EngineWidgetProps {
  activeModelId?: number;
}

const COLLAPSED_HEIGHT = 44;
const DEFAULT_EXPANDED_HEIGHT = 360;
const MIN_EXPANDED_HEIGHT = 200;
const MAX_EXPANDED_HEIGHT = 650;

export default function EngineWidget({ activeModelId }: EngineWidgetProps) {
  const { openDrawer } = useDrawer();
  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState(DEFAULT_EXPANDED_HEIGHT);
  const [activeTab, setActiveTab] = useState<WidgetTab>('ask');
  const [scopeAll, setScopeAll] = useState(true);

  const [logEntries, setLogEntries] = useState<EngineLogEntry[]>([]);
  const [stressResult, setStressResult] = useState<StressResult | null>(null);
  const [candidates, setCandidates] = useState<EngineCandidate[]>([]);
  const [logError, setLogError] = useState<string | null>(null);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [thoughtTick, setThoughtTick] = useState(0);
  const [thoughtOpacity, setThoughtOpacity] = useState(1);

  const [inputValue, setInputValue] = useState('');
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const askSendRef = useRef<((text: string) => void) | null>(null);

  // Load data
  useEffect(() => {
    const modelId = scopeAll ? undefined : activeModelId;
    fetchEngineLog(modelId)
      .then((entries) => {
        setLogEntries(entries);
        setLogError(null);
      })
      .catch(() => {
        setLogEntries([]);
        setLogError('Live engine log unavailable.');
      });
  }, [scopeAll, activeModelId]);

  useEffect(() => {
    if (!activeModelId) return;

    let isActive = true;
    fetchStressResult(activeModelId)
      .then((result) => {
        if (isActive) setStressResult(result);
      })
      .catch(() => {
        if (isActive) setStressResult(null);
      });
    fetchCandidates(activeModelId)
      .then((items) => {
        if (!isActive) return;
        setCandidates(items);
        setCandidateError(null);
      })
      .catch(() => {
        if (!isActive) return;
        setCandidates([]);
        setCandidateError('Live candidate data unavailable.');
      });

    return () => {
      isActive = false;
    };
  }, [activeModelId]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logEntries]);

  const thoughtText = useMemo(() => {
    if (logEntries.length > 0) {
      const index = thoughtTick % logEntries.length;
      return humanizeLogEntry(logEntries[index]);
    }
    return generateIdleThought({ objects: 52, edges: 847 });
  }, [logEntries, thoughtTick]);

  // Thought text cycling (collapsed bar)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setThoughtOpacity(0);
      timeout = setTimeout(() => {
        setThoughtTick((current) => current + 1);
        setThoughtOpacity(1);
      }, 200);
    }, 5000);

    return () => {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  // Focus input on expand
  useEffect(() => {
    if (expanded) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [expanded]);

  // Escape key + click-outside handler
  const widgetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setExpanded(false);
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (widgetRef.current && !widgetRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expanded]);

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

  const visibleStressResult = activeModelId ? stressResult : null;
  const visibleCandidates = activeModelId ? candidates : [];
  const visibleCandidateError = activeModelId ? candidateError : null;
  const pendingCount = visibleCandidates.filter((c) => c.status === 'pending').length;

  const tabs: { id: WidgetTab; label: string }[] = [
    { id: 'ask', label: 'Ask' },
    { id: 'analyze', label: 'Analyze' },
    { id: 'log', label: 'Log' },
    { id: 'stress', label: 'Stress' },
    { id: 'candidates', label: `Candidates${pendingCount ? ` (${pendingCount})` : ''}` },
  ];

  const content = (
    <div
      ref={widgetRef}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: expanded ? height : COLLAPSED_HEIGHT,
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Canvas background */}
      <TerminalCanvas seed={77} />

      {/* Resize handle (only when expanded) */}
      {expanded && (
        <div
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            top: -4,
            left: 0,
            right: 0,
            height: 8,
            cursor: 'ns-resize',
            zIndex: 5,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 3,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 32,
              height: 3,
              borderRadius: 2,
              background: 'rgba(244,243,240,0.06)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(244,243,240,0.16)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(244,243,240,0.06)';
            }}
          />
        </div>
      )}

      {/* Collapsed bar */}
      {!expanded && (
        <div
          onClick={() => setExpanded(true)}
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            height: COLLAPSED_HEIGHT,
            padding: '0 16px',
            cursor: 'pointer',
            userSelect: 'none',
            gap: 10,
          }}
        >
          {/* Search icon */}
          <span style={{ color: '#3A7A88', fontSize: 15, flexShrink: 0 }}>
            &#8981;
          </span>

          {/* Green status dot with pulse */}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#4ADE80',
              flexShrink: 0,
              animation: 'enginePulse 2s ease-in-out infinite',
            }}
          />

          {/* Thought text */}
          <span
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: 11,
              color: '#7A756E',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              opacity: thoughtOpacity,
              transition: 'opacity 0.2s',
            }}
          >
            {thoughtText}
          </span>

          {/* Meta: event count */}
          <span
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: 10,
              color: '#555048',
              flexShrink: 0,
            }}
          >
            {logEntries.length} events
          </span>

          {/* Pending badge */}
          {pendingCount > 0 && (
            <span
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: 9,
                fontWeight: 600,
                background: '#C49A4A',
                color: '#1C1C20',
                padding: '1px 6px',
                borderRadius: 7,
              }}
            >
              {pendingCount}
            </span>
          )}

          {/* Expand chevron */}
          <span style={{ fontSize: 8, color: '#555048' }}>&#x25B2;</span>
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Input area (top of expanded widget) */}
          <div
            style={{
              borderBottom: '1px solid rgba(244,243,240,0.05)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
              background: 'rgba(30,32,40,0.5)',
            }}
          >
            <span style={{ color: '#3A7A88', fontSize: 15, flexShrink: 0 }}>
              &#8981;
            </span>
            <input
              ref={inputRef}
              type="text"
              placeholder="ask the engine anything..."
              autoComplete="off"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  askSendRef.current?.(inputValue.trim());
                  setInputValue('');
                  if (activeTab !== 'ask') setActiveTab('ask');
                }
              }}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: '#F4F3F0',
                padding: '6px 0',
              }}
            />
            {/* Placeholder style for input */}
            <style>{`
              .engine-widget-input::placeholder {
                color: #555048;
                font-family: var(--font-code);
                font-size: 12px;
              }
            `}</style>
            <button
              onClick={() => {
                if (inputValue.trim()) {
                  askSendRef.current?.(inputValue.trim());
                  setInputValue('');
                  if (activeTab !== 'ask') setActiveTab('ask');
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-code)',
                fontSize: 11,
                color: '#555048',
                padding: '4px 10px',
                borderRadius: 4,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#3A7A88';
                (e.currentTarget as HTMLElement).style.background = 'rgba(45,95,107,0.1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#555048';
                (e.currentTarget as HTMLElement).style.background = 'none';
              }}
            >
              send
            </button>
            <button
              onClick={() => setExpanded(false)}
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: 9,
                color: '#555048',
                background: 'rgba(244,243,240,0.04)',
                border: '1px solid rgba(244,243,240,0.05)',
                padding: '2px 6px',
                borderRadius: 3,
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#C0BDB5';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,243,240,0.12)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#555048';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,243,240,0.05)';
              }}
              title="Collapse widget (Escape)"
            >
              esc
            </button>
            <button
              onClick={() => setExpanded(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 8,
                color: '#555048',
                padding: '4px 2px',
                flexShrink: 0,
                transform: 'rotate(180deg)',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#C0BDB5';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#555048';
              }}
              title="Collapse widget"
            >
              &#x25B2;
            </button>
          </div>

          {/* Tab bar */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              borderBottom: '1px solid rgba(244,243,240,0.05)',
              flexShrink: 0,
              padding: '0 14px',
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
                      ? '2px solid #2D5F6B'
                      : '2px solid transparent',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-code)',
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                  color: activeTab === tab.id ? '#C0BDB5' : '#555048',
                  transition: 'all 0.15s',
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
            {activeTab === 'ask' && (
              <EngineAskTab
                logEntries={logEntries}
                onSendReady={(fn) => { askSendRef.current = fn; }}
              />
            )}
            {activeTab === 'analyze' && (
              <EngineAnalyzeTab />
            )}
            {activeTab === 'log' && (
              <LogTab
                entries={logEntries}
                logEndRef={logEndRef}
                scopeAll={scopeAll}
                onToggleScope={() => setScopeAll(!scopeAll)}
                loadError={logError}
              />
            )}
            {activeTab === 'stress' && (
              <StressTab result={visibleStressResult} />
            )}
            {activeTab === 'candidates' && (
              <CandidatesTab
                candidates={visibleCandidates}
                onUpdate={setCandidates}
                loadError={visibleCandidateError}
                onOpenCandidate={(candidate) => {
                  const slug = candidate.target?.kind === 'object'
                    ? (candidate.target.object?.slug || (candidate.target.object?.id != null ? String(candidate.target.object.id) : ''))
                    : (candidate.objectSlug || String(candidate.objectRef || ''));
                  if (slug) openDrawer(slug);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes enginePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="commonplace-theme">{content}</div>,
    document.body,
  );
}

/* Log tab (carried forward from EngineTerminal) */

function LogTab({
  entries,
  logEndRef,
  scopeAll,
  onToggleScope,
  loadError,
}: {
  entries: EngineLogEntry[];
  logEndRef: React.RefObject<HTMLDivElement | null>;
  scopeAll: boolean;
  onToggleScope: () => void;
  loadError?: string | null;
}) {
  const ENGINE_PASS_COLOR: Record<string, string> = {
    sbert: '#CCAA44',
    nli: '#CCAA44',
    kge: '#CCAA44',
    stress: '#CC6644',
    promote: '#6AAA6A',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Scope toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button
          onClick={onToggleScope}
          title={scopeAll ? 'Showing all models' : 'Showing current model'}
          style={{
            background: 'none',
            border: `1px solid ${scopeAll ? 'rgba(244,243,240,0.05)' : '#CCAA44'}`,
            borderRadius: 3,
            padding: '1px 6px',
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: 'var(--font-code)',
            color: scopeAll ? '#555048' : '#CCAA44',
            letterSpacing: '0.03em',
          }}
        >
          {scopeAll ? 'ALL' : 'THIS'}
        </button>
      </div>

      {loadError ? (
        <div
          style={{
            color: '#CC6644',
            fontSize: 11,
            fontFamily: 'var(--font-code)',
          }}
        >
          {loadError}
        </div>
      ) : entries.length === 0 ? (
        <div
          style={{
            color: '#555048',
            fontSize: 11,
            fontFamily: 'var(--font-code)',
            fontStyle: 'italic',
          }}
        >
          No engine activity recorded.
        </div>
      ) : (
        entries.map((entry) => {
          const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          const passColor = ENGINE_PASS_COLOR[entry.pass] ?? '#C0BDB5';

          return (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'baseline',
                lineHeight: 1.6,
                fontFamily: 'var(--font-code)',
              }}
            >
              <span
                style={{
                  color: '#555048',
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
              <span style={{ fontSize: 11, color: '#C0BDB5' }}>{entry.message}</span>
            </div>
          );
        })
      )}
      <div ref={logEndRef} />
    </div>
  );
}

/* Stress tab (carried forward from EngineTerminal) */

function StressTab({ result }: { result: StressResult | null }) {
  if (!result) {
    return (
      <div
        style={{
          color: '#555048',
          fontSize: 11,
          fontFamily: 'var(--font-code)',
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
    high: '#CC6644',
    medium: '#CCAA44',
    low: '#555048',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--font-code)' }}>
      <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
        <span>
          <span style={{ color: '#555048' }}>Drift: </span>
          <span
            style={{
              color: result.drift > 0.15 ? '#CCAA44' : '#6AAA6A',
            }}
          >
            {(result.drift * 100).toFixed(1)}%
          </span>
        </span>
        <span>
          <span style={{ color: '#555048' }}>Unlinked: </span>
          <span
            style={{
              color: result.unlinkedCount > 0 ? '#CCAA44' : '#6AAA6A',
            }}
          >
            {result.unlinkedCount}
          </span>
        </span>
      </div>

      {result.findings.map((f) => (
        <div
          key={f.id}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'baseline',
            fontSize: 11,
            lineHeight: 1.5,
            color: '#C0BDB5',
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
                color: '#555048',
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

/* Candidates tab (carried forward from EngineTerminal) */

function CandidatesTab({
  candidates,
  onUpdate,
  loadError,
  onOpenCandidate,
}: {
  candidates: EngineCandidate[];
  onUpdate: (c: EngineCandidate[]) => void;
  loadError?: string | null;
  onOpenCandidate?: (candidate: EngineCandidate) => void;
}) {
  const pending = candidates.filter((c) => c.status === 'pending');

  if (loadError) {
    return (
      <div
        style={{
          color: '#CC6644',
          fontSize: 11,
          fontFamily: 'var(--font-code)',
        }}
      >
        {loadError}
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div
        style={{
          color: '#555048',
          fontSize: 11,
          fontFamily: 'var(--font-code)',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-code)' }}>
      {pending.map((c) => (
        <div
          key={c.id}
          role={onOpenCandidate ? 'button' : undefined}
          tabIndex={onOpenCandidate ? 0 : undefined}
          onClick={onOpenCandidate ? () => onOpenCandidate(c) : undefined}
          onKeyDown={onOpenCandidate ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenCandidate(c);
            }
          } : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 8px',
            borderRadius: 3,
            border: '1px dashed rgba(244,243,240,0.05)',
            fontSize: 11,
            color: '#C0BDB5',
            cursor: onOpenCandidate ? 'pointer' : 'default',
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#CCAA44',
              flexShrink: 0,
            }}
          >
            ENGINE
          </span>
          <span style={{ flex: 1 }}>{c.objectTitle}</span>
          <span
            style={{
              fontSize: 10,
              color: c.relation === 'supports' ? '#6AAA6A' : '#CC6644',
            }}
          >
            {c.relation} A{c.suggestedAssumptionId}
          </span>
          <span
            style={{
              fontSize: 10,
              color: '#555048',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(c.confidence * 100)}%
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction(c.id, 'accepted');
            }}
            title="Accept candidate"
            style={{
              background: 'none',
              border: '1px solid #6AAA6A',
              borderRadius: 2,
              padding: '1px 6px',
              cursor: 'pointer',
              fontFamily: 'var(--font-code)',
              fontSize: 10,
              color: '#6AAA6A',
            }}
          >
            &#x2713;
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction(c.id, 'rejected');
            }}
            title="Reject candidate"
            style={{
              background: 'none',
              border: '1px solid #CC6644',
              borderRadius: 2,
              padding: '1px 6px',
              cursor: 'pointer',
              fontFamily: 'var(--font-code)',
              fontSize: 10,
              color: '#CC6644',
            }}
          >
            &#x2717;
          </button>
        </div>
      ))}
    </div>
  );
}
