'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  useApiData,
  fetchEmergentTypes,
  applyEmergentType,
} from '@/lib/commonplace-api';
import { useCapture } from '@/lib/providers/capture-provider';
import type { ApiEmergentTypeSuggestion } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Emergent Type Suggestions View
   Monitoring surface: cluster-detected type
   candidates with inline apply customizer.
   ───────────────────────────────────────────────── */

/** 10 color swatches for the type customizer. */
const COLOR_SWATCHES = [
  '#B45A2D', // terracotta
  '#2D5F6B', // teal
  '#C49A4A', // gold
  '#8B6FA0', // purple
  '#5A7A4A', // green
  '#4A6A8A', // steel blue
  '#B06080', // rose
  '#6B7A8A', // slate
  '#C47A3A', // amber
  '#7050A0', // deep purple
];

type CardState = 'default' | 'customizing' | 'applying' | 'applied' | 'dismissed';

export default function EmergentTypeSuggestionsView() {
  const { captureVersion } = useCapture();
  const [cardStates, setCardStates] = useState<Map<string, CardState>>(new Map());

  const { data: suggestions, loading, error, refetch } = useApiData(
    () => fetchEmergentTypes(),
    [captureVersion],
  );

  const visibleSuggestions = useMemo(() => {
    if (!suggestions) return [];
    return suggestions.filter((s) => {
      const state = cardStates.get(s.suggested_slug);
      return state !== 'applied' && state !== 'dismissed';
    });
  }, [suggestions, cardStates]);

  const setCardState = useCallback((slug: string, state: CardState) => {
    setCardStates((prev) => new Map(prev).set(slug, state));
  }, []);

  if (loading) {
    return (
      <div className="cp-pane-content" style={containerStyle}>
        <div style={centeredStyle}>
          <div style={monoLabel}>LOADING SUGGESTIONS...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-pane-content" style={containerStyle}>
        <div style={centeredStyle}>
          <div style={{ color: 'var(--cp-red)', fontSize: 13, marginBottom: 8 }}>{error.message}</div>
          <button onClick={refetch} style={actionBtnStyle('var(--cp-teal)')}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-pane-content" style={containerStyle}>
      {/* Header */}
      <div>
        <h2 style={titleStyle}>Emergent Types</h2>
        <p style={subtitleStyle}>
          Clusters of objects sharing common patterns. Apply to create
          new object types, or dismiss to skip (they may reappear next run).
        </p>
      </div>

      {/* Stats */}
      {suggestions && suggestions.length > 0 && (
        <div style={statsBarStyle}>
          <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 13, color: 'var(--cp-text)' }}>
            {visibleSuggestions.length} suggestion{visibleSuggestions.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 11, color: 'var(--cp-text-faint)', fontFamily: 'var(--cp-font-mono)' }}>
            {(suggestions?.length ?? 0) - visibleSuggestions.length} resolved
          </span>
        </div>
      )}

      {/* Suggestion cards */}
      {visibleSuggestions.length === 0 ? (
        <div style={centeredStyle}>
          <div style={{ fontFamily: 'var(--cp-font-title)', fontSize: 18, color: 'var(--cp-text)', marginBottom: 6 }}>
            No type suggestions
          </div>
          <div style={{ fontSize: 13, color: 'var(--cp-text-muted)', textAlign: 'center' as const, maxWidth: 300 }}>
            The self-organize engine has not detected any emergent
            type patterns yet. Run the connection engine to analyze
            your objects.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.suggested_slug}
              suggestion={suggestion}
              state={cardStates.get(suggestion.suggested_slug) ?? 'default'}
              onSetState={(state) => setCardState(suggestion.suggested_slug, state)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Suggestion Card ── */

function SuggestionCard({
  suggestion,
  state,
  onSetState,
}: {
  suggestion: ApiEmergentTypeSuggestion;
  state: CardState;
  onSetState: (state: CardState) => void;
}) {
  const [customName, setCustomName] = useState(suggestion.suggested_name);
  const [customColor, setCustomColor] = useState(COLOR_SWATCHES[0]);

  const handleApply = useCallback(async () => {
    onSetState('applying');
    try {
      await applyEmergentType({
        suggested_name: customName,
        suggested_slug: suggestion.suggested_slug,
        member_pks: suggestion.member_pks,
        color: customColor,
      });
      onSetState('applied');
    } catch {
      onSetState('customizing');
    }
  }, [customName, customColor, suggestion, onSetState]);

  if (state === 'applying') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16 }}>
          <div style={{ ...monoLabel, color: 'var(--cp-teal)' }}>APPLYING...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ padding: '14px 16px' }}>
        {/* Header row: name + member count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ fontSize: 16, fontFamily: 'var(--cp-font-title)', color: 'var(--cp-text)' }}>
            {suggestion.suggested_name}
          </div>
          <span style={{
            fontSize: 11,
            fontFamily: 'var(--cp-font-mono)',
            color: 'var(--cp-text-muted)',
            padding: '2px 8px',
            borderRadius: 10,
            backgroundColor: 'var(--cp-chrome-line)',
            flexShrink: 0,
            marginLeft: 8,
          }}>
            {suggestion.member_count} object{suggestion.member_count !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Reason */}
        <div style={{ fontSize: 13, color: 'var(--cp-text-muted)', lineHeight: 1.5, marginBottom: 10 }}>
          {suggestion.reason}
        </div>

        {/* Member samples */}
        {suggestion.member_samples && suggestion.member_samples.length > 0 && (
          <MemberPillList members={suggestion.member_samples} maxVisible={6} />
        )}

        {/* Inline customizer (expanded state) */}
        {state === 'customizing' && (
          <TypeCustomizer
            name={customName}
            color={customColor}
            onNameChange={setCustomName}
            onColorChange={setCustomColor}
            onConfirm={handleApply}
            onCancel={() => onSetState('default')}
          />
        )}

        {/* Action buttons (default state) */}
        {state === 'default' && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button
              onClick={() => onSetState('customizing')}
              style={actionBtnStyle('var(--cp-teal)')}
            >
              Apply
            </button>
            <button
              onClick={() => onSetState('dismissed')}
              style={actionBtnStyle('var(--cp-text-faint)')}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Member Pill List ── */

function MemberPillList({
  members,
  maxVisible,
}: {
  members: { id: number; title: string; object_type_name: string }[];
  maxVisible: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? members : members.slice(0, maxVisible);
  const remaining = members.length - maxVisible;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
      {visible.map((m) => {
        const identity = getObjectTypeIdentity(m.object_type_name);
        return (
          <span
            key={m.id}
            style={{
              fontSize: 11,
              fontFamily: 'var(--cp-font-mono)',
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: `${identity.color}18`,
              color: identity.color,
              border: `1px solid ${identity.color}30`,
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const,
            }}
          >
            {m.title}
          </span>
        );
      })}
      {!showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            fontSize: 11,
            fontFamily: 'var(--cp-font-mono)',
            padding: '2px 8px',
            borderRadius: 4,
            backgroundColor: 'transparent',
            color: 'var(--cp-text-faint)',
            border: '1px dashed var(--cp-chrome-line)',
            cursor: 'pointer',
          }}
        >
          +{remaining} more
        </button>
      )}
    </div>
  );
}

/* ── Type Customizer (inline expand) ── */

function TypeCustomizer({
  name,
  color,
  onNameChange,
  onColorChange,
  onConfirm,
  onCancel,
}: {
  name: string;
  color: string;
  onNameChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={customizerStyle}>
      {/* Name input */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ ...monoLabel, color: 'var(--cp-text-muted)', display: 'block', marginBottom: 4 }}>
          TYPE NAME
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Color swatch grid */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ ...monoLabel, color: 'var(--cp-text-muted)', display: 'block', marginBottom: 6 }}>
          COLOR
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              onClick={() => onColorChange(swatch)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                backgroundColor: swatch,
                border: swatch === color
                  ? '2px solid var(--cp-text)'
                  : '2px solid transparent',
                cursor: 'pointer',
                outline: 'none',
                padding: 0,
              }}
              title={swatch}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ ...monoLabel, color: 'var(--cp-text-faint)' }}>PREVIEW:</span>
        <span
          style={{
            fontSize: 12,
            fontFamily: 'var(--cp-font-mono)',
            padding: '3px 10px',
            borderRadius: 4,
            backgroundColor: `${color}18`,
            color,
            border: `1px solid ${color}40`,
          }}
        >
          {name || 'Untitled Type'}
        </span>
      </div>

      {/* Confirm / Cancel */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={onConfirm}
          disabled={!name.trim()}
          style={{
            ...actionBtnStyle('var(--cp-teal)'),
            opacity: name.trim() ? 1 : 0.4,
          }}
        >
          Confirm
        </button>
        <button onClick={onCancel} style={actionBtnStyle('var(--cp-text-faint)')}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Styles ── */

const containerStyle: React.CSSProperties = {
  padding: 20,
  overflowY: 'auto',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--cp-font-title)',
  fontSize: 22,
  color: 'var(--cp-text)',
  margin: 0,
  marginBottom: 4,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--cp-text-muted)',
  margin: 0,
  lineHeight: 1.5,
};

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--cp-font-mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
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

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  backgroundColor: 'var(--cp-surface)',
  border: '1px solid var(--cp-chrome-line)',
  overflow: 'hidden',
};

const customizerStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 14,
  borderRadius: 6,
  backgroundColor: 'var(--cp-chrome-bg)',
  border: '1px solid var(--cp-chrome-line)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: 14,
  fontFamily: 'var(--cp-font-title)',
  color: 'var(--cp-text)',
  backgroundColor: 'var(--cp-surface)',
  border: '1px solid var(--cp-chrome-line)',
  borderRadius: 5,
  outline: 'none',
  boxSizing: 'border-box' as const,
};

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    padding: '4px 12px',
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
