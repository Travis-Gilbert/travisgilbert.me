'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  useApiData,
  fetchPromotionQueue,
  submitReviewAction,
  fetchFeedbackStats,
} from '@/lib/commonplace-api';
import { useCapture } from '@/lib/providers/capture-provider';
import { useLayout } from '@/lib/providers/layout-provider';
import type { ApiPromotionItem } from '@/lib/commonplace';
import EngineShell from './EngineShell';
import { DISMISS_EXIT, useSpring } from './engine-motion';

/* ─────────────────────────────────────────────────
   Promotion Queue View
   Triage surface: 5 item types with color-coded
   left borders, inline accept/reject, batch actions.
   ───────────────────────────────────────────────── */

const ITEM_TYPE_STYLES: Record<
  ApiPromotionItem['item_type'],
  { color: string; label: string }
> = {
  claim: { color: '#B8623D', label: 'Claim' },
  entity: { color: '#1A7A8A', label: 'Entity' },
  question: { color: '#7050A0', label: 'Question' },
  rule: { color: '#A08020', label: 'Rule' },
  method_candidate: { color: '#3858B8', label: 'Method' },
};

type FilterType = 'all' | ApiPromotionItem['item_type'];

export default function PromotionQueueView() {
  const { captureVersion } = useCapture();
  const { navigateToScreen } = useLayout();
  const [filter, setFilter] = useState<FilterType>('all');
  const [reviewedIds, setReviewedIds] = useState<Set<number>>(new Set());

  const { data: items, loading, error, refetch } = useApiData(
    () => fetchPromotionQueue({ queue_state: 'pending' }),
    [captureVersion],
  );
  const { data: feedbackStats } = useApiData(fetchFeedbackStats, []);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    const visible = items.filter((item) => !reviewedIds.has(item.id));
    if (filter === 'all') return visible;
    return visible.filter((item) => item.item_type === filter);
  }, [items, filter, reviewedIds]);

  const typeCounts = useMemo(() => {
    if (!items) return {} as Record<string, number>;
    const visible = items.filter((item) => !reviewedIds.has(item.id));
    const counts: Record<string, number> = {};
    for (const item of visible) {
      counts[item.item_type] = (counts[item.item_type] ?? 0) + 1;
    }
    return counts;
  }, [items, reviewedIds]);

  const totalVisible = useMemo(
    () => (items ? items.filter((item) => !reviewedIds.has(item.id)).length : 0),
    [items, reviewedIds],
  );

  const handleReview = useCallback(
    async (itemId: number, action: 'accept' | 'reject') => {
      try {
        await submitReviewAction({ promotion_item_id: itemId, action_type: action });
        setReviewedIds((prev) => new Set(prev).add(itemId));
      } catch {
        // Silently fail; user can retry
      }
    },
    [],
  );

  const handleBatchAction = useCallback(
    async (action: 'accept' | 'reject') => {
      for (const item of filteredItems) {
        try {
          await submitReviewAction({ promotion_item_id: item.id, action_type: action });
          setReviewedIds((prev) => new Set(prev).add(item.id));
        } catch {
          break;
        }
      }
    },
    [filteredItems],
  );

  if (loading) {
    return (
      <EngineShell
        title="Review Queue"
        subtitle="Items extracted from artifacts awaiting review."
        feedbackStats={feedbackStats}
        onBack={() => navigateToScreen('engine')}
      >
        <div style={centeredStyle}>
          <div style={monoLabelStyle}>LOADING QUEUE...</div>
        </div>
      </EngineShell>
    );
  }

  if (error) {
    return (
      <EngineShell
        title="Review Queue"
        subtitle="Items extracted from artifacts awaiting review."
        feedbackStats={feedbackStats}
        onBack={() => navigateToScreen('engine')}
      >
        <div style={centeredStyle}>
          <div style={{ color: 'var(--cp-red)', fontSize: 13, marginBottom: 8 }}>{error.message}</div>
          <button onClick={refetch} style={actionBtnStyle('var(--cp-teal)')}>Retry</button>
        </div>
      </EngineShell>
    );
  }

  return (
    <EngineShell
      title="Review Queue"
      subtitle="Accept to promote, reject to discard."
      feedbackStats={feedbackStats}
      onBack={() => navigateToScreen('engine')}
    >
      {/* Stats bar */}
      <QueueStats total={totalVisible} typeCounts={typeCounts} />

      {/* Filter tabs */}
      <div style={filterBarStyle}>
        <FilterTab
          label="All"
          count={totalVisible}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        {(Object.keys(ITEM_TYPE_STYLES) as ApiPromotionItem['item_type'][]).map((type) => (
          <FilterTab
            key={type}
            label={ITEM_TYPE_STYLES[type].label}
            count={typeCounts[type] ?? 0}
            color={ITEM_TYPE_STYLES[type].color}
            active={filter === type}
            onClick={() => setFilter(type)}
          />
        ))}
      </div>

      {/* Batch actions */}
      {filteredItems.length > 1 && (
        <BatchActions
          count={filteredItems.length}
          onAcceptAll={() => handleBatchAction('accept')}
          onRejectAll={() => handleBatchAction('reject')}
        />
      )}

      {/* Queue items with animated dismiss */}
      {filteredItems.length === 0 ? (
        <EmptyQueue hasItems={totalVisible > 0} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <AnimatePresence initial={false}>
            {filteredItems.map((item) => (
              <QueueItemAnimated
                key={item.id}
                item={item}
                onAccept={() => handleReview(item.id, 'accept')}
                onReject={() => handleReview(item.id, 'reject')}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </EngineShell>
  );
}

/* ── Queue Stats ── */

function QueueStats({
  total,
  typeCounts,
}: {
  total: number;
  typeCounts: Record<string, number>;
}) {
  return (
    <div style={statsBarStyle}>
      <div style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 13, color: 'var(--cp-text)' }}>
        {total} pending
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {Object.entries(typeCounts).map(([type, count]) => {
          const meta = ITEM_TYPE_STYLES[type as ApiPromotionItem['item_type']];
          if (!meta) return null;
          return (
            <span key={type} style={{ fontSize: 11, color: meta.color, fontFamily: 'var(--cp-font-mono)' }}>
              {count} {meta.label.toLowerCase()}{count !== 1 ? 's' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ── Filter Tab ── */

function FilterTab({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        border: active
          ? `1px solid ${color ?? 'var(--cp-text-muted)'}`
          : '1px solid transparent',
        backgroundColor: active
          ? `${color ?? 'var(--cp-text-muted)'}14`
          : 'transparent',
        color: active ? (color ?? 'var(--cp-text)') : 'var(--cp-text-faint)',
        fontSize: 12,
        fontFamily: 'var(--cp-font-mono)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {color && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: color,
            opacity: active ? 1 : 0.4,
          }}
        />
      )}
      {label}
      <span style={{ opacity: 0.6 }}>{count}</span>
    </button>
  );
}

/* ── Animated Queue Item wrapper ── */

function QueueItemAnimated({
  item,
  onAccept,
  onReject,
}: {
  item: ApiPromotionItem;
  onAccept: () => void;
  onReject: () => void;
}) {
  const spring = useSpring('snappy');
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={DISMISS_EXIT}
      transition={spring}
    >
      <QueueItem item={item} onAccept={onAccept} onReject={onReject} />
    </motion.div>
  );
}

/* ── Queue Item ── */

function QueueItem({
  item,
  onAccept,
  onReject,
}: {
  item: ApiPromotionItem;
  onAccept: () => void;
  onReject: () => void;
}) {
  const [actionInFlight, setActionInFlight] = useState<'accept' | 'reject' | null>(null);
  const meta = ITEM_TYPE_STYLES[item.item_type] ?? { color: '#666', label: item.item_type };

  const handleAction = useCallback(
    async (action: 'accept' | 'reject') => {
      setActionInFlight(action);
      if (action === 'accept') await onAccept();
      else await onReject();
    },
    [onAccept, onReject],
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        backgroundColor: 'var(--cp-surface)',
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid var(--cp-chrome-line)',
      }}
    >
      {/* Color-coded left border */}
      <div style={{ width: 4, backgroundColor: meta.color, flexShrink: 0 }} />

      {/* Content */}
      <div style={{ flex: 1, padding: '10px 14px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--cp-font-mono)',
              color: meta.color,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
            }}
          >
            {meta.label}
          </span>
          {item.confidence > 0 && (
            <span style={{ fontSize: 10, color: 'var(--cp-text-faint)', fontFamily: 'var(--cp-font-mono)' }}>
              {Math.round(item.confidence * 100)}%
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--cp-text)',
            lineHeight: 1.4,
            fontFamily: item.item_type === 'question' ? 'var(--cp-font-title)' : undefined,
            fontStyle: item.item_type === 'rule' ? 'italic' : undefined,
          }}
        >
          {item.title}
        </div>
        {item.artifact_title && (
          <div style={{ fontSize: 11, color: 'var(--cp-text-faint)', marginTop: 3 }}>
            from: {item.artifact_title}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', flexShrink: 0 }}>
        <button
          onClick={() => handleAction('accept')}
          disabled={actionInFlight !== null}
          style={actionBtnStyle('var(--cp-green)')}
          title="Accept"
        >
          {actionInFlight === 'accept' ? '...' : '✓'}
        </button>
        <button
          onClick={() => handleAction('reject')}
          disabled={actionInFlight !== null}
          style={actionBtnStyle('var(--cp-red)')}
          title="Reject"
        >
          {actionInFlight === 'reject' ? '...' : '✕'}
        </button>
      </div>
    </div>
  );
}

/* ── Batch Actions ── */

function BatchActions({
  count,
  onAcceptAll,
  onRejectAll,
}: {
  count: number;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}) {
  return (
    <div style={batchBarStyle}>
      <span style={{ fontSize: 11, color: 'var(--cp-text-faint)', fontFamily: 'var(--cp-font-mono)' }}>
        {count} visible
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onAcceptAll} style={actionBtnStyle('var(--cp-green)')}>
          Accept all
        </button>
        <button onClick={onRejectAll} style={actionBtnStyle('var(--cp-red)')}>
          Reject all
        </button>
      </div>
    </div>
  );
}

/* ── Empty state ── */

function EmptyQueue({ hasItems }: { hasItems: boolean }) {
  return (
    <div style={centeredStyle}>
      <div style={{ fontFamily: 'var(--cp-font-title)', fontSize: 18, color: 'var(--cp-text)', marginBottom: 6 }}>
        {hasItems ? 'No items match this filter' : 'Queue clear'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--cp-text-muted)', textAlign: 'center' as const, maxWidth: 280 }}>
        {hasItems
          ? 'Try a different filter to see pending items.'
          : 'All items have been reviewed. Run an extraction to populate the queue.'}
      </div>
    </div>
  );
}

/* ── Styles ── */

const monoLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--cp-font-mono)',
  fontSize: 12,
  color: 'var(--cp-text-faint)',
  letterSpacing: '0.06em',
};

const centeredStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  padding: 40,
};

const statsBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: 8,
  backgroundColor: 'var(--cp-surface)',
  border: '1px solid var(--cp-chrome-line)',
};

const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
};

const batchBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 0',
};

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    padding: '4px 10px',
    borderRadius: 5,
    border: `1px solid ${color}`,
    backgroundColor: 'transparent',
    color,
    fontSize: 12,
    fontFamily: 'var(--cp-font-mono)',
    cursor: 'pointer',
    letterSpacing: '0.03em',
  };
}
