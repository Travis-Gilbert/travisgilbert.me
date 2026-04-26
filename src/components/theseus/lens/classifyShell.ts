// Per atlas-lens.jsx lines 27-37 and design-doc Architecture > Lens
// screen layout > classifyShell. The prototype hardcoded inner edge
// types and inner kinds; the live port reads epistemic_role from the
// /api/v2/theseus/edge-types/ endpoint via the cached map.
//
// Kind whitelists (live ObjectType slugs) live in `./lensKindSets`
// to keep the dispatch in this file purely metadata-driven.

import type { EdgeTypeMeta } from './edgeTypeMeta';
import { INNER_KINDS, MIDDLE_KINDS } from './lensKindSets';

export type Shell = 'inner' | 'middle' | 'outer';

export function classifyShell(
  node: { id: string; kind: string },
  edgeType: string,
  _focused: { id: string; kind: string },
  edgeTypeMeta: Map<string, EdgeTypeMeta>,
): Shell {
  const role = edgeTypeMeta.get(edgeType)?.epistemic_role;
  if (role === 'kin' && INNER_KINDS.has(node.kind)) return 'inner';
  if (MIDDLE_KINDS.has(node.kind)) return 'middle';
  return 'outer';
}
