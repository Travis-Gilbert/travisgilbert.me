'use client';

import type { Assumption } from '@/lib/commonplace-models';
import AssumptionRow from './AssumptionRow';

/**
 * AssumptionRegister: vertical list of assumption rows.
 *
 * This is the primary argument structure of a model. Assumptions
 * are ordered by position_index (set by the backend ModelClaimRole).
 * Each row is an expandable card showing the claim, its status,
 * confidence, and grouped evidence.
 *
 * The register is always visible in the workspace (it is the core
 * of the model, not a toggleable module brick).
 */

interface AssumptionRegisterProps {
  assumptions: Assumption[];
  onOpenObject?: (objectRef: number) => void;
}

export default function AssumptionRegister({
  assumptions,
  onOpenObject,
}: AssumptionRegisterProps) {
  const sorted = [...assumptions].sort(
    (a, b) => a.positionIndex - b.positionIndex,
  );

  if (sorted.length === 0) {
    return (
      <div
        style={{
          padding: '24px 20px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 11,
            color: 'var(--cp-text-faint, #68666E)',
            letterSpacing: '0.04em',
            marginBottom: 6,
          }}
        >
          No assumptions yet.
        </div>
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            color: 'var(--cp-text-faint, #68666E)',
          }}
        >
          Add claims to build the argument structure.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '12px 20px',
      }}
    >
      {/* Section label */}
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--cp-text-faint, #68666E)',
          marginBottom: 4,
        }}
      >
        Argument Register
      </div>

      {sorted.map((assumption, i) => (
        <AssumptionRow
          key={assumption.id}
          assumption={assumption}
          index={i}
          onOpenObject={onOpenObject}
        />
      ))}
    </div>
  );
}
