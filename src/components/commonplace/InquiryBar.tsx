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
    <div ref={containerRef} className="cp-inquiry-container">
      {/* ── Search input ── */}
      <div
        className={`cp-inquiry-input-row${isFocused ? ' cp-inquiry-input-row--focused' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        <svg
          width={14}
          height={14}
          viewBox="0 0 16 16"
          fill="none"
          className="cp-inquiry-search-icon"
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
          className="cp-inquiry-input"
        />

        {/* Web toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setWebEnabled(!webEnabled);
          }}
          title={webEnabled ? 'Web search on' : 'Web search off'}
          className={`cp-inquiry-web-toggle${webEnabled ? ' cp-inquiry-web-toggle--on' : ''}`}
        >
          {webEnabled ? 'WEB ON' : 'WEB OFF'}
        </button>

        {/* Gap count */}
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
        <div className="cp-inquiry-dropdown">
          {/* Graph results */}
          {(graphResults.length > 0 || isSearching) && (
            <>
              <div className="cp-inquiry-group-label">
                In your graph{graphResults.length > 0 ? ` (${graphResults.length})` : ''}
              </div>
              {graphResults.map((result) => {
                const identity = getObjectTypeIdentity(result.object_type_name);
                return (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => handleResultClick(result)}
                    className="cp-inquiry-result-row"
                  >
                    <span className="cp-inquiry-result-dot" style={{ background: identity.color }} />
                    <span className="cp-inquiry-result-title">{result.display_title || result.title}</span>
                    <span className="cp-inquiry-result-type">{identity.label}</span>
                  </button>
                );
              })}
              {isSearching && graphResults.length === 0 && (
                <div className="cp-inquiry-searching">
                  Searching...
                </div>
              )}
            </>
          )}

          {/* Suggested searches (from plan) */}
          {planResult && planResult.subqueries.length > 0 && (
            <>
              <div className="cp-inquiry-group-label">Suggested searches</div>
              {planResult.subqueries.map((sq, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSuggestionFill(sq.query)}
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

          {/* Gaps in knowledge */}
          {planResult && planResult.internal_context.evidence_gaps.length > 0 && (
            <>
              <div className="cp-inquiry-group-label">Gaps in your knowledge</div>
              {planResult.internal_context.evidence_gaps.map((gap, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSuggestionFill(gap.description)}
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
          <div className="cp-inquiry-actions">
            <button
              type="button"
              onClick={handleSearchGraph}
              className="cp-inquiry-action-btn"
            >
              SEARCH GRAPH
            </button>
            <button
              type="button"
              onClick={handleSearchWeb}
              disabled={!webEnabled}
              className={`cp-inquiry-action-btn${webEnabled ? ' cp-inquiry-action-btn--web' : ''}`}
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
              <div key={phase} className="cp-inquiry-phase-row">
                <span className={`cp-inquiry-phase-icon cp-inquiry-phase-icon--${status}`}>
                  {status === 'done' ? '\u2713' : status === 'active' ? '\u25CF' : '\u25CB'}
                </span>
                <span className={`cp-inquiry-phase-label${status === 'pending' ? ' cp-inquiry-phase-label--pending' : ''}`}>
                  {phase.replace(/_/g, ' ')}
                </span>
                <span className="cp-inquiry-phase-detail">
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
              ` \u00B7 ${inquiryResult.contradicting_evidence.length} contradicting`}
            {inquiryResult.what_changed.new_artifacts_captured > 0 &&
              ` \u00B7 ${inquiryResult.what_changed.new_artifacts_captured} new artifacts`}
          </div>

          {inquiryResult.open_gaps.length > 0 && (
            <div className="cp-inquiry-result-gaps">
              <div className="cp-inquiry-result-gaps-label">
                Still missing
              </div>
              {inquiryResult.open_gaps.map((gap, i) => (
                <div key={i} className="cp-inquiry-result-gap-item">
                  {gap.description}
                </div>
              ))}
            </div>
          )}

          <div className="cp-inquiry-dismiss-row">
            <button
              type="button"
              onClick={dismissInquiry}
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
