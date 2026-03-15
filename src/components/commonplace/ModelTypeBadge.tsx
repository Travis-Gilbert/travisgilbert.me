'use client';

import type { ModelType } from '@/lib/commonplace-models';
import { MODEL_TYPE_META } from '@/lib/commonplace-models';

/**
 * ModelTypeBadge: colored label indicating the model's epistemic type.
 *
 * Each of the six model types (explanatory, causal, comparative,
 * predictive, normative, process) has a semantic color defined in
 * MODEL_TYPE_META. The badge renders as a compact pill with a
 * left-border accent.
 */

interface ModelTypeBadgeProps {
  modelType: ModelType;
  size?: 'sm' | 'md';
}

export default function ModelTypeBadge({
  modelType,
  size = 'sm',
}: ModelTypeBadgeProps) {
  const meta = MODEL_TYPE_META[modelType];
  const fontSize = size === 'sm' ? 10 : 11;
  const padding = size === 'sm' ? '2px 8px 2px 6px' : '3px 10px 3px 8px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--cp-font-mono)',
        fontSize,
        fontWeight: 500,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: meta.color,
        background: `${meta.color}11`,
        borderLeft: `2px solid ${meta.color}`,
        borderRadius: '0 3px 3px 0',
        padding,
        lineHeight: 1.3,
      }}
    >
      {meta.label}
    </span>
  );
}
