/**
 * Lens registry — the sibling of the object-renderer registry.
 *
 * Objects are nouns; lenses are verbs you point at any object. The
 * object-renderer registry answers "what does this object look like" by
 * dispatching on object type. This registry answers "what does this object
 * look like through lens L" by dispatching on (object type, lens).
 *
 * Two kinds:
 *   - engine lenses (terminal/cluster/timeline) call the engine and render a
 *     live, transient readout in a pane.
 *   - attachment lenses (notes/tasks/reminder/photos) add a persisted object
 *     related to the target.
 *
 * Adding a lens = adding one entry here + one renderer in lenses/lens-renderers
 * (SC-001 / SC-040). No edit to objects or to the toolbox shell.
 */

import type { RenderableObject } from '@/components/commonplace/objects/ObjectRenderer';

export type LensKind = 'engine' | 'attachment';

export interface LensDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  kind: LensKind;
  /** Attachment lenses: the component_type_slug used to persist (FR-040). */
  apiTypeName: string;
  /** Does this lens apply to the given object? Default: every object (SC-002). */
  applies: (object: RenderableObject) => boolean;
}

const ALWAYS = () => true;

/**
 * The seven lenses. Engine lenses first, attachment lenses second — the
 * toolbox renders these two groups directly (FR-004).
 */
export const LENS_REGISTRY: LensDef[] = [
  // ── Engine lenses ──
  { id: 'terminal', label: 'Terminal', icon: 'terminal',      color: '#2D5F6B', kind: 'engine',     apiTypeName: 'terminal', description: "The engine's epistemic read of this object", applies: ALWAYS },
  { id: 'cluster',  label: 'Cluster',  icon: 'network-right', color: '#7050A0', kind: 'engine',     apiTypeName: 'cluster',  description: 'This object plus its neighborhood in the graph', applies: ALWAYS },
  { id: 'timeline', label: 'Timeline', icon: 'clock',         color: '#3858B8', kind: 'engine',     apiTypeName: 'timeline', description: "This object's history, yours and the world's", applies: ALWAYS },
  // ── Attachment lenses ──
  { id: 'notes',    label: 'Notes',    icon: 'edit-pencil',   color: '#78767E', kind: 'attachment', apiTypeName: 'text',     description: 'Rich-text notes attached to this object', applies: ALWAYS },
  { id: 'tasks',    label: 'Tasks',    icon: 'check',         color: '#B85C28', kind: 'attachment', apiTypeName: 'task',     description: 'A checklist attached to this object', applies: ALWAYS },
  { id: 'reminder', label: 'Reminder', icon: 'bell',          color: '#B8623D', kind: 'attachment', apiTypeName: 'reminder', description: 'A time-triggered resurface of this object', applies: ALWAYS },
  { id: 'photos',   label: 'Photos',   icon: 'media-image',   color: '#C49A4A', kind: 'attachment', apiTypeName: 'file',     description: 'An image collection attached to this object', applies: ALWAYS },
];

export function getLens(id: string): LensDef | undefined {
  return LENS_REGISTRY.find((l) => l.id === id);
}

/** Lenses that apply to a given object (filtered by their predicate). */
export function lensesForObject(object: RenderableObject): LensDef[] {
  return LENS_REGISTRY.filter((l) => {
    try {
      return l.applies(object);
    } catch {
      return false;
    }
  });
}

export function engineLenses(): LensDef[] {
  return LENS_REGISTRY.filter((l) => l.kind === 'engine');
}

export function attachmentLenses(): LensDef[] {
  return LENS_REGISTRY.filter((l) => l.kind === 'attachment');
}

/** Context handed to a lens when it opens in a pane (FR-002). */
export interface LensContext {
  lensId: string;
  objectRef: number;
  objectSlug: string;
  objectType: string;
  objectTitle: string;
}
