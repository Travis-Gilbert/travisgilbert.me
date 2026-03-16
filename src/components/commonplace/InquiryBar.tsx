'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { getObjectTypeIdentity } from '@/lib/commonplace';
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
import TerminalBlock from './TerminalBlock';

/* ─────────────────────────────────────────────────
   Types
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

interface InquiryBarProps {
  gapCount?: number;
  onOpenObject?: (objectRef: number) => void;
  onInquiryComplete?: (result: InquiryResultData) => void;
  /** When set, pre-fills the input and focuses. Parent should clear via onExternalQueryConsumed. */
  externalQuery?: string;
  onExternalQueryConsumed?: () => void;
}

/* ─────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────── */

export default function InquiryBar({
  gapCount = 0,
  onOpenObject,
  onInquiryComplete,
  externalQuery,
  onExternalQueryConsumed,
}: InquiryBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [webEnabled, setWebEnabled] = useState(false);

  // Dropdown results
  const [graphResults, setGraphResults] = useState<ObjectSearchResult[]>([]);
  const [planResult, setPlanResult] = useState<InquiryPlanResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Inquiry running state
  const [runningInquiry, setRunningInquiry] = useState<InquiryProgress | null>(null);
  const [inquiryResult, setInquiryResult] = useState<InquiryResultData | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Consume external query from parent (e.g. InquirySuggestions card click)
  useEffect(() => {
    if (externalQuery) {
      setQuery(externalQuery);
      setIsFocused(true);
      inputRef.current?.focus();
      onExternalQueryConsumed?.();
    }
  }, [externalQuery, onExternalQueryConsumed]);

  const isExpanded = isFocused && query.trim().length > 0;
  const isRunning = runningInquiry !== null && !inquiryResult;

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setGraphResults([]);
      setPlanResult(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const trimmed = query.trim();
      const [objects, plan] = await Promise.allSettled([
        searchObjects(trimmed, 5),
        fetchInquiryPlan(trimmed),
      ]);

      if (objects.status === 'fulfilled') setGraphResults(objects.value);
      if (plan.status === 'fulfilled') setPlanResult(plan.value);
      setIsSearching(false);
    }, 180);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Poll inquiry progress
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
        } else if (progress.status === 'failed' || progress.status === 'cancelled') {
          // Stop polling on terminal states
        } else {
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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearchGraph = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleSearchWeb = useCallback(async () => {
    if (!query.trim() || !webEnabled) return;
    setIsFocused(false);
    try {
      const resp = await startInquiry({
        query: query.trim(),
        external_search: true,
      });
      setRunningInquiry({
        id: resp.inquiry_id,
        status: resp.status,
        phase: 'internal_retrieval',
        progress: { subqueries: 0, subqueries_completed: 0, hits_total: 0, hits_captured: 0 },
      });
      setInquiryResult(null);
    } catch {
      // Could show a toast here
    }
  }, [query, webEnabled]);

  const handleResultClick = useCallback(
    (result: ObjectSearchResult) => {
      setIsFocused(false);
      onOpenObject?.(result.id);
    },
    [onOpenObject],
  );

  const handleSuggestionFill = useCallback((text: string) => {
    setQuery(text);
    inputRef.current?.focus();
  }, []);

  const dismissInquiry = useCallback(() => {
    setRunningInquiry(null);
    setInquiryResult(null);
  }, []);

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

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* ── Search input ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 6,
          border: `1px solid ${isFocused ? 'var(--cp-red-line)' : 'var(--cp-border)'}`,
          boxShadow: isFocused ? '0 0 0 3px var(--cp-red-soft)' : 'none',
          background: isFocused ? 'var(--cp-card)' : 'rgba(254, 254, 254, 0.7)',
          backdropFilter: isFocused ? 'none' : 'blur(4px)',
          transition: 'border-color 200ms, box-shadow 200ms, background 200ms',
          cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <svg
          width={14}
          height={14}
          viewBox="0 0 16 16"
          fill="none"
          style={{ flexShrink: 0 }}
        >
          <circle
            cx={7}
            cy={7}
            r={5}
            stroke={isFocused ? 'var(--cp-red)' : 'var(--cp-text-faint)'}
            strokeWidth={1.4}
          />
          <path
            d="M11 11l3.5 3.5"
            stroke={isFocused ? 'var(--cp-red)' : 'var(--cp-text-faint)'}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="What your notes want you to find"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--cp-font-body)',
            fontSize: 14,
            color: 'var(--cp-text)',
          }}
        />

        {/* Web toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setWebEnabled(!webEnabled);
          }}
          title={webEnabled ? 'Web search on' : 'Web search off'}
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            letterSpacing: '0.04em',
            padding: '2px 7px',
            borderRadius: 3,
            cursor: 'pointer',
            transition: 'all 150ms',
            border: webEnabled ? '1px solid var(--cp-red-line)' : '1px solid transparent',
            background: webEnabled ? 'var(--cp-red-soft)' : 'transparent',
            color: webEnabled ? 'var(--cp-red)' : 'var(--cp-text-faint)',
            userSelect: 'none',
          }}
        >
          {webEnabled ? 'WEB ON' : 'WEB OFF'}
        </button>

        {/* Gap count */}
        {gapCount > 0 && (
          <span
            title={`${gapCount} knowledge gap${gapCount !== 1 ? 's' : ''} detected`}
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              color: 'var(--cp-text-faint)',
            }}
          >
            {gapCount} gap{gapCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Dropdown (expanded state) ── */}
      {isExpanded && !isRunning && (
        <div
          style={{
            marginTop: 6,
            border: '1px solid var(--cp-border)',
            borderRadius: 6,
            background: 'var(--cp-card)',
            overflow: 'hidden',
            animation: 'inquirySlideDown 200ms ease-out',
            boxShadow: 'var(--cp-shadow)',
          }}
        >
          {/* Graph results */}
          {(graphResults.length > 0 || isSearching) && (
            <>
              <div style={groupLabelStyle}>
                In your graph{graphResults.length > 0 ? ` (${graphResults.length})` : ''}
              </div>
              {graphResults.map((result) => {
                const identity = getObjectTypeIdentity(result.object_type_name);
                return (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => handleResultClick(result)}
                    style={resultRowStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--cp-border-faint)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: identity.color, flexShrink: 0 }} />
                    <span style={resultTitleStyle}>{result.display_title || result.title}</span>
                    <span style={resultTypeStyle}>{identity.label}</span>
                  </button>
                );
              })}
              {isSearching && graphResults.length === 0 && (
                <div style={{ padding: '8px 12px', fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: 'var(--cp-text-faint)' }}>
                  Searching...
                </div>
              )}
            </>
          )}

          {/* Suggested searches (from plan) */}
          {planResult && planResult.subqueries.length > 0 && (
            <>
              <div style={groupLabelStyle}>Suggested searches</div>
              {planResult.subqueries.map((sq, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSuggestionFill(sq.query)}
                  style={suggestionRowStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cp-border-faint)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ ...suggestionIconStyle, color: 'var(--cp-text-muted)' }}>Q</span>
                  <div style={{ flex: 1 }}>
                    <div style={suggestionTextStyle}>&ldquo;{sq.query}&rdquo;</div>
                    <div style={suggestionMetaStyle}>{sq.purpose}</div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Gaps in knowledge */}
          {planResult && planResult.internal_context.evidence_gaps.length > 0 && (
            <>
              <div style={groupLabelStyle}>Gaps in your knowledge</div>
              {planResult.internal_context.evidence_gaps.map((gap, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSuggestionFill(gap.description)}
                  style={suggestionRowStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cp-border-faint)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ ...suggestionIconStyle, color: 'var(--cp-term-amber)' }}>!</span>
                  <div style={{ flex: 1 }}>
                    <div style={suggestionTextStyle}>{gap.description}</div>
                    <div style={suggestionMetaStyle}>
                      {gap.priority > 0.7 ? 'High priority' : 'Evidence gap'}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--cp-border-faint)' }}>
            <button
              type="button"
              onClick={handleSearchGraph}
              style={actionBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--cp-text-faint)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--cp-border)'; }}
            >
              SEARCH GRAPH
            </button>
            <button
              type="button"
              onClick={handleSearchWeb}
              disabled={!webEnabled}
              style={{
                ...actionBtnStyle,
                background: webEnabled ? 'var(--cp-red-soft)' : 'transparent',
                color: webEnabled ? 'var(--cp-red)' : 'var(--cp-text-faint)',
                borderColor: webEnabled ? 'var(--cp-red-line)' : 'var(--cp-border)',
                opacity: webEnabled ? 1 : 0.35,
                cursor: webEnabled ? 'pointer' : 'default',
              }}
            >
              SEARCH WEB
            </button>
          </div>
        </div>
      )}

      {/* ── Terminal block (running state) ── */}
      {isRunning && (
        <TerminalBlock
          title={`Inquiry: ${query}`}
          status="running"
          style={{ marginTop: 10 }}
        >
          {INQUIRY_PHASES.map((phase) => {
            const status = getPhaseStatus(phase);
            return (
              <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 14,
                    textAlign: 'center',
                    fontSize: 11,
                    color:
                      status === 'done' ? 'var(--cp-term-green)'
                        : status === 'active' ? 'var(--cp-term-amber)'
                          : 'var(--cp-term-muted)',
                    animation: status === 'active' ? 'cpPulse 2s ease-in-out infinite' : 'none',
                  }}
                >
                  {status === 'done' ? '\u2713' : status === 'active' ? '\u25CF' : '\u25CB'}
                </span>
                <span style={{ flex: 1, color: status === 'pending' ? 'var(--cp-term-muted)' : 'var(--cp-term-text)' }}>
                  {phase.replace(/_/g, ' ')}
                </span>
                <span style={{ color: 'var(--cp-term-muted)', fontSize: 10 }}>
                  {getPhaseDetail(phase)}
                </span>
              </div>
            );
          })}
        </TerminalBlock>
      )}

      {/* ── Inquiry result (completed state) ── */}
      {inquiryResult && (
        <TerminalBlock
          title="Inquiry Results"
          status="complete"
          style={{ marginTop: 10 }}
        >
          {inquiryResult.answer.answer_text && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: 'var(--cp-term-muted)', fontSize: 9, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                Answer (confidence: {inquiryResult.answer.confidence.toFixed(2)})
              </div>
              <div>{inquiryResult.answer.answer_text}</div>
            </div>
          )}

          <div style={{ color: 'var(--cp-term-muted)', fontSize: 10, marginTop: 4 }}>
            {inquiryResult.supporting_evidence.length} supporting
            {inquiryResult.contradicting_evidence.length > 0 &&
              ` \u00B7 ${inquiryResult.contradicting_evidence.length} contradicting`}
            {inquiryResult.what_changed.new_artifacts_captured > 0 &&
              ` \u00B7 ${inquiryResult.what_changed.new_artifacts_captured} new artifacts`}
          </div>

          {inquiryResult.open_gaps.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: 'var(--cp-term-amber)', fontSize: 9, marginBottom: 2, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                Still missing
              </div>
              {inquiryResult.open_gaps.map((gap, i) => (
                <div key={i} style={{ color: 'var(--cp-term-muted)', fontSize: 10 }}>
                  {gap.description}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={dismissInquiry}
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: 'var(--cp-term-green)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              DISMISS
            </button>
          </div>
        </TerminalBlock>
      )}

      <style>{`
        @keyframes inquirySlideDown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Shared inline styles
   ───────────────────────────────────────────────── */

const groupLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--cp-font-mono)',
  fontSize: 9,
  letterSpacing: '0.06em',
  color: 'var(--cp-text-faint)',
  padding: '10px 12px 4px',
  textTransform: 'uppercase',
};

const resultRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 12px',
  cursor: 'pointer',
  transition: 'background 100ms',
  background: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
};

const resultTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontFamily: 'var(--cp-font-body)',
  color: 'var(--cp-text)',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const resultTypeStyle: React.CSSProperties = {
  fontFamily: 'var(--cp-font-mono)',
  fontSize: 9,
  color: 'var(--cp-text-faint)',
  flexShrink: 0,
};

const suggestionRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: '7px 12px',
  cursor: 'pointer',
  transition: 'background 100ms',
  background: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
};

const suggestionIconStyle: React.CSSProperties = {
  fontFamily: 'var(--cp-font-mono)',
  fontSize: 11,
  flexShrink: 0,
  width: 16,
  textAlign: 'center',
  lineHeight: '1.4',
};

const suggestionTextStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: 'var(--cp-font-body)',
  color: 'var(--cp-text-muted)',
};

const suggestionMetaStyle: React.CSSProperties = {
  fontFamily: 'var(--cp-font-mono)',
  fontSize: 9,
  color: 'var(--cp-text-faint)',
  marginTop: 1,
};

const actionBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '7px 0',
  borderRadius: 4,
  fontFamily: 'var(--cp-font-mono)',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 150ms',
  border: '1px solid var(--cp-border)',
  background: 'var(--cp-card)',
  color: 'var(--cp-text-muted)',
};
