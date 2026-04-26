/**
 * Canonical contract for `GET /api/v1/notebook/objects/<id>/lens-focus/`.
 *
 * The Index-API helpers in `apps/notebook/views/_lens_helpers.py`
 * (`build_focus_payload`) return:
 *
 *   {
 *     focused: { id, title, kind, summary, source_system, subtype },
 *     neighbors: [
 *       { id, title, kind,
 *         edge: { type, display_label, epistemic_role, reason } },
 *       ...
 *     ]
 *   }
 *
 * This module owns the TypeScript types for that wire shape and the
 * pure mapping from the response into the `computeLensLayout` input
 * shape. Keeping the mapping in one tested function lets us pin the
 * contract without spinning up a React test renderer.
 */
import type { LensNeighborInput } from './useLensLayout';

export type EpistemicRoleSlug =
  | 'kin'
  | 'anchoring'
  | 'context'
  | 'structural';

export interface LensFocusEdge {
  type: string;
  display_label: string;
  epistemic_role: EpistemicRoleSlug;
  reason: string;
}

export interface LensFocusNeighbor {
  id: number;
  title: string;
  kind: string;
  edge: LensFocusEdge;
}

export interface LensFocusFocused {
  id: number;
  title: string;
  kind: string;
  summary: string;
  source_system: string | null;
  subtype: string | null;
}

export interface LensFocusResponse {
  focused: LensFocusFocused;
  neighbors: LensFocusNeighbor[];
}

export interface LensLayoutInputs {
  focused: { id: string; kind: string };
  neighbors: LensNeighborInput[];
}

/**
 * Map a `lens-focus` response into the input shape `computeLensLayout`
 * expects. Pure function so it can be unit-tested without rendering.
 *
 * The mapping is intentionally narrow: it discards epistemic_role,
 * reason, summary, source_system, and subtype because the celestial
 * shell layout in `useLensLayout.ts` does not need them. Tier 3 panels
 * (LensPropertiesStrip, LensDossier, LensTimeline) consume those
 * fields directly from the response, not from the layout output.
 */
export function lensFocusToLayoutInputs(
  data: LensFocusResponse,
): LensLayoutInputs {
  return {
    focused: {
      id: String(data.focused.id),
      kind: data.focused.kind,
    },
    neighbors: data.neighbors.map((n) => ({
      node: { id: String(n.id), kind: n.kind },
      edgeType: n.edge.type,
      edgeLabel: n.edge.display_label,
    })),
  };
}
