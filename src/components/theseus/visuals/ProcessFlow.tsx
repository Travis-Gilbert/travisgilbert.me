/**
 * ProcessFlow — stepped-sequence renderer for procedural/causal answers.
 *
 * Reads `visual.structured.steps: Array<{ id, label, detail?, linked_evidence? }>`.
 * Laid out as a horizontal or wrapping sequence of numbered cards joined
 * by arrows. Falls back to vertical layout when there are many steps.
 */

'use client';

import type { FC } from 'react';
import { useMemo } from 'react';
import type { StructuredVisual, StructuredVisualRegion } from '@/lib/theseus-types';

interface ProcessStep {
  id: string;
  label: string;
  detail?: string;
  linked_evidence?: string[];
}

interface ProcessFlowProps {
  visual: StructuredVisual;
  onRegionHover?: (region: StructuredVisualRegion | null) => void;
  onRegionSelect?: (region: StructuredVisualRegion) => void;
}

function readSteps(visual: StructuredVisual): ProcessStep[] {
  const raw = visual.structured?.steps;
  if (!Array.isArray(raw)) return [];
  const steps: ProcessStep[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i];
    if (!s || typeof s !== 'object') continue;
    const rec = s as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id : `step-${i}`;
    const label = typeof rec.label === 'string' ? rec.label : '';
    if (!label) continue;
    const detail = typeof rec.detail === 'string' ? rec.detail : undefined;
    const linked = Array.isArray(rec.linked_evidence) ? rec.linked_evidence.map(String) : undefined;
    steps.push({ id, label, detail, linked_evidence: linked });
  }
  return steps;
}

const ProcessFlow: FC<ProcessFlowProps> = ({ visual, onRegionHover }) => {
  const steps = useMemo(() => readSteps(visual), [visual]);
  if (steps.length === 0) return null;

  return (
    <div
      style={{
        background: 'var(--color-paper, #fdfbf6)',
        border: '1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)',
        borderRadius: 6,
        padding: 14,
        boxShadow: 'var(--shadow-warm-sm)',
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`,
        gap: 10,
        alignItems: 'stretch',
      }}
    >
      {steps.map((step, i) => {
        const hasLinked = step.linked_evidence && step.linked_evidence.length > 0;
        return (
          <div
            key={step.id}
            onMouseEnter={() => {
              if (!onRegionHover || !hasLinked) return;
              onRegionHover({
                id: step.id,
                label: step.label,
                x: i,
                y: 0,
                width: 1,
                height: 1,
                linked_evidence: step.linked_evidence,
              });
            }}
            onMouseLeave={() => onRegionHover?.(null)}
            style={{
              position: 'relative',
              padding: 10,
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-terracotta) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-terracotta) 25%, transparent)',
              cursor: hasLinked ? 'pointer' : 'default',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-metadata)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-terracotta)',
              }}
            >
              Step {i + 1}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--color-ink)',
              }}
            >
              {step.label}
            </div>
            {step.detail && (
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  color: 'var(--color-ink-muted)',
                  lineHeight: 1.4,
                }}
              >
                {step.detail}
              </div>
            )}
            {i < steps.length - 1 && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  right: -9,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  color: 'color-mix(in srgb, var(--color-ink) 45%, transparent)',
                  pointerEvents: 'none',
                }}
              >
                →
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProcessFlow;
