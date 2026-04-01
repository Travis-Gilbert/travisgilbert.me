/* SPEC-VIE-3 v2 (superseded): Redirects to SceneDirector.directScene */

import type { TheseusResponse } from '@/lib/theseus-types';
import type { DataShape } from './SceneSpec';
import { directScene } from './SceneDirector';

/**
 * @deprecated Use directScene from SceneDirector.ts instead.
 * This wrapper exists only for backward compatibility during migration.
 */
export async function constructVisualization(
  response: TheseusResponse,
  processedData?: unknown[],
  dataShape?: DataShape | null,
) {
  return directScene(response, processedData, dataShape);
}
