'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  fetchFeedbackStats,
  fetchReviewQueue,
  submitStructuredConnectionFeedback,
  useApiData,
} from '@/lib/commonplace-api';
import type { FeedbackStats, ReviewQueueEdge } from '@/lib/commonplace-api';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { useLayout } from '@/lib/providers/layout-provider';
import { useDrawer } from '@/lib/providers/drawer-provider';
import ObjectRenderer from '../objects/ObjectRenderer';
import type { RenderableObject } from '../objects/ObjectRenderer';
import EngineProvenance from './EngineProvenance';
import EngineShell from './EngineShell';
import ModelDiagnostics from './ModelDiagnostics';
import { CROSSFADE, useSpring } from './engine-motion';

const PURPLE = '#8B6FA0';
const REVIEW_LAST_EDGE_KEY = 'commonplace.connection-review.last-edge-id';

type ReviewCorrectness = 'wrong' | 'unclear' | 'correct';
type ReviewQuality = 'obvious' | 'relevant' | 'surprising' | 'useful';
type ReviewConfidence = 'low' | 'medium' | 'high';
type ReviewAction = 'accept' | 'defer' | 'reject';

interface ReviewModifiers {
  weakEvidence: boolean;
  strongEvidence: boolean;
  tooVague: boolean;
  duplicate: boolean;
  sourceDisagreement: boolean;
}

interface StructuredConnectionReviewDraft {
  edgeId: number | null;
  correctness: ReviewCorrectness | null;
  qualities: ReviewQuality[];
  confidence: ReviewConfidence;
  modifiers: ReviewModifiers;
}

const DEFAULT_MODIFIERS: ReviewModifiers = {
  weakEvidence: false,
  strongEvidence: false,
  tooVague: false,
  duplicate: false,
  sourceDisagreement: false,
};

const CORRECTNESS_OPTIONS: Array<{
  key: ReviewCorrectness;
  label: string;
  shortcut: string;
  tone: string;
}> = [
  { key: 'wrong', label: 'Wrong', shortcut: '\u2190', tone: 'danger' },
  { key: 'unclear', label: 'Unclear', shortcut: '\u2193', tone: 'muted' },
  { key: 'correct', label: 'Correct', shortcut: '\u2192', tone: 'positive' },
];

const QUALITY_OPTIONS: Array<{
  key: ReviewQuality;
  label: string;
  shortcut: string;
}> = [
  { key: 'obvious', label: 'Obvious', shortcut: '1' },
  { key: 'relevant', label: 'Relevant', shortcut: '2' },
  { key: 'surprising', label: 'Surprising', shortcut: '3' },
  { key: 'useful', label: 'Useful', shortcut: '4' },
];

const MODIFIER_OPTIONS: Array<{
  key: keyof ReviewModifiers;
  label: string;
}> = [
  { key: 'weakEvidence', label: 'Weak evidence' },
  { key: 'strongEvidence', label: 'Strong evidence' },
  { key: 'tooVague', label: 'Too vague' },
  { key: 'duplicate', label: 'Duplicate' },
  { key: 'sourceDisagreement', label: 'Source disagreement' },
];

const CONFIDENCE_OPTIONS: Array<{
  key: ReviewConfidence;
  label: string;
}> = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
];

const ACTION_OPTIONS: Array<{
  key: ReviewAction;
  label: string;
  shortcut: string;
  tone: string;
  help: string;
}> = [
  {
    key: 'reject',
    label: 'Reject',
    shortcut: 'Backspace',
    tone: 'danger',
    help: 'Mark incorrect and train negative',
  },
  {
    key: 'defer',
    label: 'Skip for now',
    shortcut: 'Space',
    tone: 'muted',
    help: 'Not enough context yet (no training update)',
  },
  {
    key: 'accept',
    label: 'Accept',
    shortcut: 'Enter',
    tone: 'positive',
    help: 'Valid connection and train positive',
  },
];

function createInitialDraft(edgeId: number | null): StructuredConnectionReviewDraft {
  return {
    edgeId,
    correctness: null,
    qualities: [],
    confidence: 'medium',
    modifiers: { ...DEFAULT_MODIFIERS },
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function compileStructuredReview(draft: StructuredConnectionReviewDraft, action: ReviewAction) {
  const qualities = [...draft.qualities];

  let correctness = draft.correctness;
  if (!correctness && action === 'reject') correctness = 'wrong';
  if (!correctness && action === 'defer') correctness = 'unclear';
  if (!correctness && action === 'accept') correctness = 'correct';
  if (!correctness) return null;

  const normalizedQualities = correctness === 'correct' ? qualities : [];
  let label: 'engaged' | 'dismissed' = 'dismissed';
  if (correctness === 'correct' && action !== 'reject') {
    label = 'engaged';
  }

  let discoverySignal: string | undefined;
  if (correctness === 'wrong') {
    discoverySignal = 'wrong';
  } else if (action === 'accept' && normalizedQualities.includes('useful')) {
    discoverySignal = 'solves_problem';
  } else if (normalizedQualities.includes('surprising')) {
    discoverySignal = 'surprising';
  } else if (normalizedQualities.includes('relevant')) {
    discoverySignal = 'relevant';
  } else if (normalizedQualities.includes('obvious')) {
    discoverySignal = 'obvious';
  }

  const baseStrength = {
    low: 0.55,
    medium: 0.75,
    high: 0.90,
  }[draft.confidence];

  const modifiers = draft.modifiers;
  let labelStrength = baseStrength;
  if (modifiers.weakEvidence) labelStrength -= 0.15;
  if (modifiers.strongEvidence) labelStrength += 0.10;
  if (modifiers.sourceDisagreement) labelStrength -= 0.10;
  if (modifiers.tooVague) labelStrength -= 0.10;

  return {
    correctness,
    qualities: normalizedQualities,
    label,
    discoverySignal,
    labelStrength: clamp(labelStrength, 0.05, 1.0),
  };
}

function deriveOptimisticScorerMode(
  previous: FeedbackStats['scorer_mode'] | undefined,
  total: number,
): FeedbackStats['scorer_mode'] {
  if (previous === 'ensemble') return 'ensemble';
  if (total >= 200) return 'learned';
  if (total >= 50) return 'blended';
  return 'fixed';
}

function getNotebookSubtitle(notebookSlug?: string): string {
  if (!notebookSlug) {
    return 'Rate engine-discovered connections with structured feedback';
  }
  return `Rate engine-discovered connections inside ${notebookSlug}`;
}

function buildInformativeBadges(edge: ReviewQueueEdge, notebookSlug?: string) {
  const badges: Array<{ label: string; tone: 'purple' | 'gold' | 'danger' | 'muted' }> = [];

  if (edge.strategy === 'uncertainty' || edge.strategy === 'committee') {
    badges.push({ label: 'Most informative to rate', tone: 'gold' });
  }
  if (typeof edge.disagreement === 'number' && edge.disagreement >= 0.12) {
    badges.push({ label: 'High disagreement', tone: 'danger' });
  }
  if (
    (typeof edge.uncertainty === 'number' && edge.uncertainty >= 0.75)
    || (typeof edge.predicted_prob === 'number' && edge.predicted_prob >= 0.4 && edge.predicted_prob <= 0.6)
  ) {
    badges.push({ label: 'Low confidence', tone: 'muted' });
  }
  if (notebookSlug) {
    badges.push({ label: 'Notebook scoped', tone: 'purple' });
  }

  return badges;
}

function formatPercent(value?: number): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return `${Math.round(value * 100)}%`;
}

function isPlaceholderTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (normalized.startsWith('untitled')) return true;
  return normalized.length < 3;
}

function edgeReviewPriority(edge: ReviewQueueEdge): number {
  const predictiveUncertainty = typeof edge.predicted_prob === 'number'
    ? 1 - Math.abs(edge.predicted_prob - 0.5) * 2
    : 0;
  const disagreement = typeof edge.disagreement === 'number' ? edge.disagreement : 0;
  const uncertainty = typeof edge.uncertainty === 'number' ? edge.uncertainty : 0;
  const hasReason = edge.reason && edge.reason.trim().length >= 24 ? 0.35 : 0;
  const titleQualityBonus = (
    (isPlaceholderTitle(edge.from_title) ? -1.2 : 0.4)
    + (isPlaceholderTitle(edge.to_title) ? -1.2 : 0.4)
  );
  return (
    disagreement * 3.0
    + uncertainty * 2.2
    + predictiveUncertainty * 1.8
    + edge.strength * 0.25
    + hasReason
    + titleQualityBonus
  );
}

function rotateQueueAfterEdge(edges: ReviewQueueEdge[], afterEdgeId: number | null): ReviewQueueEdge[] {
  if (!afterEdgeId || edges.length < 2) return edges;
  const pivot = edges.findIndex((edge) => edge.edge_id === afterEdgeId);
  if (pivot === -1 || pivot === edges.length - 1) return edges;
  return [...edges.slice(pivot + 1), ...edges.slice(0, pivot + 1)];
}

function readLastEdgeId(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(REVIEW_LAST_EDGE_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

interface ConnectionWorkshopProps {
  notebookSlug?: string;
}

export default function ConnectionWorkshop({ notebookSlug }: ConnectionWorkshopProps) {
  const { navigateToScreen } = useLayout();
  const { openDrawer } = useDrawer();
  const { data, loading, error, refetch } = useApiData(
    () => fetchReviewQueue({ limit: 40, notebook: notebookSlug }),
    [notebookSlug],
  );
  const { data: stats } = useApiData(
    () => fetchFeedbackStats(notebookSlug ? { notebook: notebookSlug } : undefined),
    [notebookSlug],
  );

  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Record<number, StructuredConnectionReviewDraft>>({});
  const [sessionStats, setSessionStats] = useState({
    accept: 0,
    defer: 0,
    reject: 0,
  });
  const [localStats, setLocalStats] = useState<FeedbackStats | null>(null);

  const visibleEdges = useMemo(
    () => (data?.results ?? []).filter((edge) => !dismissed.has(edge.edge_id)),
    [data, dismissed],
  );
  const lastEdgeId = useMemo(() => readLastEdgeId(), []);
  const edges = useMemo(() => {
    const ranked = [...visibleEdges].sort((a, b) => edgeReviewPriority(b) - edgeReviewPriority(a));
    return rotateQueueAfterEdge(ranked, lastEdgeId);
  }, [visibleEdges, lastEdgeId]);
  const current = edges[0] ?? null;
  const draft = current
    ? (drafts[current.edge_id] ?? createInitialDraft(current.edge_id))
    : createInitialDraft(null);
  const total = edges.length;
  const reviewedTotal = sessionStats.accept + sessionStats.defer + sessionStats.reject;
  const effectiveStats = localStats ?? stats ?? data?.feedback_stats ?? null;

  const spring = useSpring('natural');
  const snappySpring = useSpring('snappy');

  useEffect(() => {
    if (!current || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(REVIEW_LAST_EDGE_KEY, String(current.edge_id));
    } catch {
      // Ignore storage quota/privacy errors.
    }
  }, [current]);

  const setCorrectness = useCallback((correctness: ReviewCorrectness) => {
    if (!current) return;
    setDrafts((prev) => {
      const currentDraft = prev[current.edge_id] ?? createInitialDraft(current.edge_id);
      return {
        ...prev,
        [current.edge_id]: {
          ...currentDraft,
          correctness,
          qualities: correctness === 'correct' ? currentDraft.qualities : [],
        },
      };
    });
  }, [current]);

  const toggleQuality = useCallback((quality: ReviewQuality) => {
    if (!current) return;
    setDrafts((prev) => {
      const currentDraft = prev[current.edge_id] ?? createInitialDraft(current.edge_id);
      const exists = currentDraft.qualities.includes(quality);
      return {
        ...prev,
        [current.edge_id]: {
          ...currentDraft,
          correctness: 'correct',
          qualities: exists
            ? currentDraft.qualities.filter((item) => item !== quality)
            : [...currentDraft.qualities, quality],
        },
      };
    });
  }, [current]);

  const toggleModifier = useCallback((modifier: keyof ReviewModifiers) => {
    if (!current) return;
    setDrafts((prev) => {
      const currentDraft = prev[current.edge_id] ?? createInitialDraft(current.edge_id);
      return {
        ...prev,
        [current.edge_id]: {
          ...currentDraft,
          modifiers: {
            ...currentDraft.modifiers,
            [modifier]: !currentDraft.modifiers[modifier],
          },
        },
      };
    });
  }, [current]);

  const setConfidence = useCallback((confidence: ReviewConfidence) => {
    if (!current) return;
    setDrafts((prev) => {
      const currentDraft = prev[current.edge_id] ?? createInitialDraft(current.edge_id);
      return {
        ...prev,
        [current.edge_id]: { ...currentDraft, confidence },
      };
    });
  }, [current]);

  const submitReview = useCallback(async (action: ReviewAction) => {
    if (!current) return;

    if (action === 'defer') {
      setSessionStats((prev) => ({
        ...prev,
        defer: prev.defer + 1,
      }));
      setDismissed((prev) => new Set(prev).add(current.edge_id));
      return;
    }

    const compiled = compileStructuredReview(draft, action);
    if (!compiled) return;

    const diagnostics = {
      strategy: current.strategy ?? data?.strategy,
      predicted_prob: current.predicted_prob,
      uncertainty: current.uncertainty,
      disagreement: current.disagreement,
      mean_prob: current.mean_prob,
      min_prob: current.min_prob,
      max_prob: current.max_prob,
      gbt: current.scorer_diagnostics?.gbt ?? current.predicted_prob ?? null,
      gnn: current.scorer_diagnostics?.gnn ?? null,
      rl: current.scorer_diagnostics?.rl ?? null,
      bp: current.scorer_diagnostics?.bp ?? null,
      ensemble: current.scorer_diagnostics?.ensemble ?? null,
      engine: current.engine,
    };

    try {
      await submitStructuredConnectionFeedback({
        edge: current.edge_id,
        from_object: current.from_object,
        to_object: current.to_object,
        feature_vector: current.feature_vector,
        label: compiled.label,
        discovery_signal: compiled.discoverySignal,
        label_strength: compiled.labelStrength,
        event_type: 'structured_review',
        event_metadata: {
          ui_version: 'connection_workshop_v3',
          correctness: compiled.correctness,
          qualities: compiled.qualities,
          confidence: draft.confidence,
          action,
          modifiers: draft.modifiers,
          diagnostics,
          notebook: notebookSlug ? { slug: notebookSlug } : undefined,
        },
      });
    } catch {
      // Optimistic dismissal keeps the review loop fast.
    }

    setSessionStats((prev) => ({
      ...prev,
      [action]: prev[action] + 1,
    }));
    setDismissed((prev) => new Set(prev).add(current.edge_id));
    setLocalStats((prev) => {
      const nextTotal = (prev?.total ?? effectiveStats?.total ?? 0) + 1;
      return {
        total: nextTotal,
        training_ready: nextTotal >= 50,
        training_tier:
          nextTotal >= 200 ? 'full' : nextTotal >= 50 ? 'blended' : 'fixed_weights',
        needed_for_training: Math.max(0, 50 - nextTotal),
        scorer_mode: deriveOptimisticScorerMode(
          prev?.scorer_mode ?? effectiveStats?.scorer_mode,
          nextTotal,
        ),
      };
    });
  }, [current, data?.strategy, draft, notebookSlug, effectiveStats?.scorer_mode, effectiveStats?.total]);

  useHotkeys('ArrowLeft', (event) => {
    event.preventDefault();
    setCorrectness('wrong');
  }, [setCorrectness]);

  useHotkeys('ArrowDown', (event) => {
    event.preventDefault();
    setCorrectness('unclear');
  }, [setCorrectness]);

  useHotkeys('ArrowRight', (event) => {
    event.preventDefault();
    setCorrectness('correct');
  }, [setCorrectness]);

  useHotkeys('1', (event) => {
    event.preventDefault();
    toggleQuality('obvious');
  }, [toggleQuality]);

  useHotkeys('2', (event) => {
    event.preventDefault();
    toggleQuality('relevant');
  }, [toggleQuality]);

  useHotkeys('3', (event) => {
    event.preventDefault();
    toggleQuality('surprising');
  }, [toggleQuality]);

  useHotkeys('4', (event) => {
    event.preventDefault();
    toggleQuality('useful');
  }, [toggleQuality]);

  useHotkeys('Enter', (event) => {
    event.preventDefault();
    submitReview('accept');
  }, [submitReview]);

  useHotkeys('Space', (event) => {
    event.preventDefault();
    submitReview('defer');
  }, [submitReview]);

  useHotkeys('Backspace', (event) => {
    event.preventDefault();
    submitReview('reject');
  }, [submitReview]);

  return (
    <EngineShell
      title="Connection Review"
      subtitle={getNotebookSubtitle(notebookSlug)}
      feedbackStats={effectiveStats}
      onBack={() => navigateToScreen('engine')}
    >
      <style>{`
        .cw-session-stats {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          font-family: var(--cp-font-mono);
          font-size: 11px;
          color: var(--cp-text-muted, #5C554D);
          flex-wrap: wrap;
        }
        .cw-stat {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .cw-stat-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .cw-nav-pills {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .cw-pill {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--cp-border, rgba(42,37,32,0.12));
        }
        .cw-pill--active {
          background: ${PURPLE};
        }
        .cw-counter {
          font-family: var(--cp-font-mono);
          font-size: 11px;
          color: var(--cp-text-faint, #8A8279);
          margin-left: 8px;
        }
        .cw-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cw-bridge {
          background: rgba(139,111,160,0.12);
          border: 1px solid rgba(139,111,160,0.20);
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .cw-score-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${PURPLE};
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--cp-font-mono);
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .cw-bridge-content {
          flex: 1;
          min-width: 0;
        }
        .cw-section-label {
          font-family: var(--cp-font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--cp-text-faint, #8A8279);
          margin-bottom: 6px;
        }
        .cw-bridge-reason {
          font-size: 13px;
          color: var(--cp-text, #2A2520);
          line-height: 1.5;
          margin: 0;
        }
        .cw-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }
        .cw-meta-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: var(--cp-font-mono);
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(42,37,32,0.06);
          color: var(--cp-text-muted, #5C554D);
        }
        .cw-meta-badge--purple {
          background: rgba(139,111,160,0.18);
          color: ${PURPLE};
        }
        .cw-meta-badge--gold {
          background: rgba(196,154,74,0.16);
          color: #9A7431;
        }
        .cw-meta-badge--danger {
          background: rgba(184,90,45,0.14);
          color: #B45A2D;
        }
        .cw-meta-badge--muted {
          background: rgba(138,130,121,0.12);
          color: #6A6259;
        }
        .cw-objects {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .cw-object-side {
          min-width: 0;
          overflow: hidden;
        }
        .cw-object-label {
          font-family: var(--cp-font-mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--cp-text-faint, #8A8279);
          margin-bottom: 6px;
        }
        .cw-review {
          border: 1px solid rgba(42,37,32,0.10);
          border-radius: 10px;
          background: rgba(255,255,255,0.22);
          padding: 16px;
        }
        .cw-review-grid {
          display: grid;
          gap: 14px;
        }
        .cw-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cw-row-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: baseline;
          flex-wrap: wrap;
        }
        .cw-row-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--cp-text, #2A2520);
        }
        .cw-row-note {
          font-size: 11px;
          color: var(--cp-text-faint, #8A8279);
        }
        .cw-chip-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .cw-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 9px;
          border: 1px solid rgba(42,37,32,0.10);
          background: transparent;
          color: var(--cp-text, #2A2520);
          font-family: var(--cp-font-body);
          font-size: 12px;
          cursor: pointer;
          transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
        }
        .cw-chip:hover {
          background: rgba(42,37,32,0.04);
        }
        .cw-chip--active {
          background: rgba(139,111,160,0.10);
          border-color: rgba(139,111,160,0.28);
          color: ${PURPLE};
        }
        .cw-chip--danger.cw-chip--active {
          background: rgba(216,138,138,0.12);
          border-color: rgba(216,138,138,0.32);
          color: #B96565;
        }
        .cw-chip--positive.cw-chip--active {
          background: rgba(45,95,107,0.12);
          border-color: rgba(45,95,107,0.30);
          color: #2D5F6B;
        }
        .cw-chip--muted.cw-chip--active {
          background: rgba(138,130,121,0.10);
          border-color: rgba(138,130,121,0.24);
          color: #6A6259;
        }
        .cw-shortcut {
          font-family: var(--cp-font-mono);
          font-size: 9px;
          padding: 1px 4px;
          border-radius: 4px;
          background: rgba(42,37,32,0.06);
          color: var(--cp-text-ghost, #AEA89F);
        }
        .cw-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding-top: 4px;
        }
        .cw-action-help {
          font-size: 11px;
          color: var(--cp-text-faint, #8A8279);
          line-height: 1.5;
        }
        .cw-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 9px;
          border: 1px solid rgba(42,37,32,0.10);
          background: transparent;
          font-family: var(--cp-font-body);
          font-size: 12px;
          cursor: pointer;
          transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
        }
        .cw-action-btn--positive {
          color: #2D5F6B;
          margin-left: auto;
        }
        .cw-action-btn--positive:hover {
          background: rgba(45,95,107,0.08);
          border-color: rgba(45,95,107,0.24);
        }
        .cw-action-btn--muted {
          color: #6A6259;
        }
        .cw-action-btn--muted:hover {
          background: rgba(138,130,121,0.08);
          border-color: rgba(138,130,121,0.22);
        }
        .cw-action-btn--danger {
          color: #B45A2D;
        }
        .cw-action-btn--danger:hover {
          background: rgba(180,90,45,0.08);
          border-color: rgba(180,90,45,0.22);
        }
        .cw-diagnostics {
          border-top: 1px dashed rgba(42,37,32,0.12);
          padding-top: 10px;
        }
        .cw-diagnostics-summary {
          cursor: pointer;
          font-family: var(--cp-font-mono);
          font-size: 11px;
          color: var(--cp-text-muted, #5C554D);
        }
        .cw-diagnostics-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px 12px;
          margin-top: 10px;
        }
        .cw-diagnostics-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 8px 10px;
          border-radius: 8px;
          background: rgba(42,37,32,0.03);
        }
        .cw-diagnostics-label {
          font-family: var(--cp-font-mono);
          font-size: 10px;
          color: var(--cp-text-faint, #8A8279);
        }
        .cw-diagnostics-value {
          font-size: 12px;
          color: var(--cp-text, #2A2520);
        }
        .cw-error-panel {
          padding: 16px;
          border-radius: 8px;
          background: rgba(180,90,45,0.06);
          border: 1px dashed rgba(180,90,45,0.2);
        }
        .cw-error-label {
          font-family: var(--cp-font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #D88A5A;
          display: block;
          margin-bottom: 4px;
        }
        .cw-error-panel p {
          font-size: 12px;
          color: var(--cp-text-muted, #5C554D);
          margin: 0 0 4px;
        }
        .cw-error-id {
          font-family: var(--cp-font-mono);
          font-size: 10px;
          color: var(--cp-text-faint, #8A8279);
        }
        .cw-empty {
          text-align: center;
          padding: 60px 20px;
          color: var(--cp-text-muted, #5C554D);
        }
        .cw-empty-title {
          font-family: var(--cp-font-title, var(--font-title));
          font-size: 18px;
          font-weight: 600;
          color: var(--cp-text, #2A2520);
          margin-bottom: 6px;
        }
        .cw-loading {
          text-align: center;
          padding: 60px 20px;
          color: var(--cp-text-muted, #5C554D);
          font-size: 13px;
        }
        @media (max-width: 780px) {
          .cw-objects {
            grid-template-columns: 1fr;
          }
          .cw-diagnostics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {loading && <div className="cw-loading">Loading review queue...</div>}

      {error && (
        <div className="cw-empty">
          <div className="cw-empty-title">Failed to load review queue</div>
          <button
            style={{
              marginTop: 8,
              fontSize: 12,
              color: PURPLE,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
            onClick={refetch}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && total === 0 && (
        <div className="cw-empty">
          <div className="cw-empty-title">All caught up</div>
          <div style={{ fontSize: 13 }}>
            {reviewedTotal > 0
              ? `Reviewed ${reviewedTotal} connections this session.`
              : 'No connections to review right now.'}
          </div>
          <button
            style={{
              marginTop: 12,
              fontSize: 12,
              color: PURPLE,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
            onClick={refetch}
          >
            Check for new connections
          </button>
        </div>
      )}

      {!loading && !error && current && (
        <>
          <div className="cw-session-stats">
            <span className="cw-stat">
              <span className="cw-stat-dot" style={{ background: '#2D5F6B' }} />
              {sessionStats.accept} accepted
            </span>
            <span className="cw-stat">
              <span className="cw-stat-dot" style={{ background: '#8A8279' }} />
              {sessionStats.defer} deferred
            </span>
            <span className="cw-stat">
              <span className="cw-stat-dot" style={{ background: '#B45A2D' }} />
              {sessionStats.reject} rejected
            </span>
            {reviewedTotal === 0 && (
              <span style={{ color: 'var(--cp-text-faint, #8A8279)' }}>No reviews yet</span>
            )}
          </div>

          <div className="cw-nav-pills">
            {edges.slice(0, Math.min(20, total)).map((edge, index) => (
              <span
                key={edge.edge_id}
                className={`cw-pill${index === 0 ? ' cw-pill--active' : ''}`}
              />
            ))}
            {total > 20 && <span className="cw-counter">+{total - 20} more</span>}
            <span className="cw-counter">{total} remaining</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={current.edge_id}
              className="cw-card"
              initial={CROSSFADE.initial}
              animate={CROSSFADE.animate}
              exit={CROSSFADE.exit}
              transition={spring}
            >
              <div className="cw-bridge">
                <div className="cw-score-circle">
                  {Math.round(current.strength * 100)}
                </div>
                <div className="cw-bridge-content">
                  <div className="cw-section-label">Claim</div>
                  <p className="cw-bridge-reason">
                    {current.reason || `${current.from_title} relates to ${current.to_title}.`}
                  </p>
                  <div className="cw-badges">
                    <span className="cw-meta-badge">{current.edge_type}</span>
                    <span className="cw-meta-badge">{current.engine}</span>
                    <span className="cw-meta-badge">
                      Strategy {(current.strategy ?? data?.strategy ?? 'diversified').toUpperCase()}
                    </span>
                    <span className="cw-meta-badge">
                      Strength {formatPercent(current.strength) ?? 'Unavailable'}
                    </span>
                    {typeof current.uncertainty === 'number' && (
                      <span className="cw-meta-badge">
                        Uncertainty {current.uncertainty.toFixed(2)}
                      </span>
                    )}
                    {typeof current.disagreement === 'number' && (
                      <span className="cw-meta-badge">
                        Disagreement {current.disagreement.toFixed(2)}
                      </span>
                    )}
                    {buildInformativeBadges(current, notebookSlug).map((badge) => (
                      <span
                        key={badge.label}
                        className={`cw-meta-badge cw-meta-badge--${badge.tone}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <EngineProvenance
                passes={parsePassesFromEngine(current.engine)}
                score={current.strength}
                engine={current.engine}
              />

              <div className="cw-objects">
                <div className="cw-object-side">
                  <div className="cw-object-label">
                    {(getObjectTypeIdentity(current.from_type).label ?? 'OBJECT').toUpperCase()}
                  </div>
                  <ObjectSide edge={current} side="from" onClick={(obj) => openDrawer(obj.slug)} />
                </div>
                <div className="cw-object-side">
                  <div className="cw-object-label">
                    {(getObjectTypeIdentity(current.to_type).label ?? 'OBJECT').toUpperCase()}
                  </div>
                  <ObjectSide edge={current} side="to" onClick={(obj) => openDrawer(obj.slug)} />
                </div>
              </div>

              <div className="cw-review">
                <div className="cw-review-grid">
                  <div className="cw-row">
                    <div className="cw-row-head">
                      <div className="cw-row-title">1. Correctness</div>
                      <div className="cw-row-note">Single select</div>
                    </div>
                    <div className="cw-chip-group">
                      {CORRECTNESS_OPTIONS.map((option) => (
                        <motion.button
                          key={option.key}
                          className={[
                            'cw-chip',
                            `cw-chip--${option.tone}`,
                            draft.correctness === option.key ? 'cw-chip--active' : '',
                          ].join(' ')}
                          onClick={() => setCorrectness(option.key)}
                          whileTap={{ scale: 0.98 }}
                          transition={snappySpring}
                        >
                          {option.label}
                          <span className="cw-shortcut">{option.shortcut}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="cw-row">
                    <div className="cw-row-head">
                      <div className="cw-row-title">2. Quality</div>
                      <div className="cw-row-note">Multi-select when correct</div>
                    </div>
                    <div className="cw-chip-group">
                      {QUALITY_OPTIONS.map((option) => (
                        <motion.button
                          key={option.key}
                          className={`cw-chip${draft.qualities.includes(option.key) ? ' cw-chip--active' : ''}`}
                          onClick={() => toggleQuality(option.key)}
                          whileTap={{ scale: 0.98 }}
                          transition={snappySpring}
                        >
                          {option.label}
                          <span className="cw-shortcut">{option.shortcut}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="cw-row">
                    <div className="cw-row-head">
                      <div className="cw-row-title">3. Evidence Modifiers</div>
                      <div className="cw-row-note">Optional</div>
                    </div>
                    <div className="cw-chip-group">
                      {MODIFIER_OPTIONS.map((option) => (
                        <motion.button
                          key={option.key}
                          className={`cw-chip${draft.modifiers[option.key] ? ' cw-chip--active' : ''}`}
                          onClick={() => toggleModifier(option.key)}
                          whileTap={{ scale: 0.98 }}
                          transition={snappySpring}
                        >
                          {option.label}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="cw-row">
                    <div className="cw-row-head">
                      <div className="cw-row-title">4. Reviewer Confidence</div>
                      <div className="cw-row-note">Three-state</div>
                    </div>
                    <div className="cw-chip-group">
                      {CONFIDENCE_OPTIONS.map((option) => (
                        <motion.button
                          key={option.key}
                          className={`cw-chip${draft.confidence === option.key ? ' cw-chip--active' : ''}`}
                          onClick={() => setConfidence(option.key)}
                          whileTap={{ scale: 0.98 }}
                          transition={snappySpring}
                        >
                          {option.label}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="cw-row">
                    <div className="cw-row-head">
                      <div className="cw-row-title">5. Action</div>
                      <div className="cw-row-note">Reject left, accept right</div>
                    </div>
                    <div className="cw-action-help">
                      Reject marks an incorrect connection and trains negative. Skip for now removes it from this session without changing training data. Accept confirms a valid connection and trains positive.
                    </div>
                    <div className="cw-actions">
                      {ACTION_OPTIONS.map((option) => (
                        <motion.button
                          key={option.key}
                          className={`cw-action-btn cw-action-btn--${option.tone}`}
                          onClick={() => submitReview(option.key)}
                          whileTap={{ scale: 0.98 }}
                          transition={snappySpring}
                          title={option.help}
                        >
                          {option.label}
                          <span className="cw-shortcut">{option.shortcut}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <ModelDiagnostics edge={current} />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </EngineShell>
  );
}

function ObjectSide({
  edge,
  side,
  onClick,
}: {
  edge: ReviewQueueEdge;
  side: 'from' | 'to';
  onClick?: (obj: RenderableObject) => void;
}) {
  const id = side === 'from' ? edge.from_object : edge.to_object;
  const title = side === 'from' ? edge.from_title : edge.to_title;
  const slug = side === 'from' ? edge.from_slug : edge.to_slug;
  const typeSlug = side === 'from' ? edge.from_type : edge.to_type;

  if (!title || !slug) {
    return (
      <div className="cw-error-panel">
        <span className="cw-error-label">COULD NOT LOAD OBJECT</span>
        <p>This object may be missing required fields. Your rating still counts.</p>
        <span className="cw-error-id">ID: {id}</span>
      </div>
    );
  }

  const extra = edge as unknown as Record<string, unknown>;
  const obj: RenderableObject = {
    id,
    slug,
    title,
    object_type_slug: typeSlug,
    body: extra[`${side}_body`] as string | undefined,
    edge_count: extra[`${side}_edge_count`] as number | undefined,
  };

  return <ObjectRenderer object={obj} variant="module" onClick={onClick} />;
}

function parsePassesFromEngine(engine: string): string[] {
  return engine
    .toLowerCase()
    .split(/[+\s,]+/)
    .filter(Boolean);
}
