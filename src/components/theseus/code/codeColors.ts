/**
 * Color and label tokens for code intelligence components.
 *
 * All colors reference the existing --cw-* CSS variables defined
 * in theseus.css. Community clusters cycle through a small palette
 * so neighbouring clusters read as distinct without requiring a
 * hand-tuned color per cluster.
 */

import type { CodeEdgeType, CodeEntityType } from '@/lib/theseus-types';

export const ENTITY_COLORS: Record<CodeEntityType, string> = {
  code_file: 'var(--cw-text-dim)',
  code_structure: 'var(--cw-teal)',
  code_member: 'var(--cw-amber)',
  code_process: 'var(--cw-green)',
  specification: 'var(--cw-terra)',
  fix_pattern: 'var(--cw-purple)',
  commit: 'var(--cw-blue)',
};

export const ENTITY_LABELS: Record<CodeEntityType, string> = {
  code_file: 'File',
  code_structure: 'Structure',
  code_member: 'Member',
  code_process: 'Process',
  specification: 'Spec',
  fix_pattern: 'Pattern',
  commit: 'Commit',
};

export const EDGE_COLORS: Record<CodeEdgeType, string> = {
  imports: 'var(--cw-text-dim)',
  calls: 'var(--cw-teal)',
  inherits: 'var(--cw-amber)',
  has_member: 'var(--cw-text-muted)',
  references: 'var(--cw-text-dim)',
  belongs_to_process: 'var(--cw-green)',
  specified_by: 'var(--cw-terra)',
  contradicts_spec: 'var(--cw-red)',
};

export const EDGE_LABELS: Record<CodeEdgeType, string> = {
  imports: 'imports',
  calls: 'calls',
  inherits: 'inherits',
  has_member: 'has',
  references: 'refs',
  belongs_to_process: 'in process',
  specified_by: 'spec',
  contradicts_spec: 'drift',
};

/**
 * Community cluster palette. Consumers pass a community_id (integer)
 * and receive a stable color by modulo indexing.
 */
export const CLUSTER_PALETTE = [
  'var(--cw-teal)',
  'var(--cw-amber)',
  'var(--cw-terra)',
  'var(--cw-purple)',
  'var(--cw-green)',
  'var(--cw-blue)',
] as const;

export function clusterColor(communityId: number | undefined | null): string {
  if (communityId === undefined || communityId === null) return 'var(--cw-text-dim)';
  const idx = ((communityId % CLUSTER_PALETTE.length) + CLUSTER_PALETTE.length) % CLUSTER_PALETTE.length;
  return CLUSTER_PALETTE[idx];
}

/**
 * Severity color for drift tensions.
 */
export function severityColor(severity: number): string {
  if (severity >= 0.7) return 'var(--cw-terra)';
  if (severity >= 0.4) return 'var(--cw-amber)';
  return 'var(--cw-text-dim)';
}

/**
 * Feedback label color for fix patterns.
 */
export function feedbackLabelColor(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes('solves')) return 'var(--cw-green)';
  if (normalized.includes('hypothesis')) return 'var(--cw-amber)';
  if (normalized.includes('partial')) return 'var(--cw-blue)';
  return 'var(--cw-text-muted)';
}
