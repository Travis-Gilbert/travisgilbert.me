/* SPEC-VIE-3 v3: Top-level orchestrator for scene intelligence
 *
 * Pipeline:
 *  1. Initialize ModelManager if not done
 *  2. Call ModelManager.direct()
 *  3. Start FeedbackCollector recording
 *  4. Return SceneDirective
 *
 * Completes in < 200ms for graph-only, < 500ms for data-driven.
 * Never calls server endpoints. Never blocks main thread > 50ms.
 */

import type { TheseusResponse } from '@/lib/theseus-types';
import type { SceneDirective } from './SceneDirective';
import type { DataShape } from './SceneSpec';
import { ruleBasedDirect } from './rules/RuleEngine';

type ManagerShape = {
  isModelLoaded: () => boolean;
  direct: (r: TheseusResponse, d?: unknown[], s?: DataShape | null) => Promise<SceneDirective>;
};

let initPromise: Promise<void> | null = null;
let modelManagerInstance: ManagerShape | null = null;
let feedbackModule: { feedbackCollector: { startRecording: (d: SceneDirective) => void } } | null = null;

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const mod = await import('./model/ModelManager');
        modelManagerInstance = mod.modelManager;
        await mod.modelManager.initialize();
      } catch {
        modelManagerInstance = null;
      }
      try {
        feedbackModule = await import('./training/FeedbackCollector');
      } catch {
        feedbackModule = null;
      }
    })();
  }
  return initPromise;
}

export async function directScene(
  response: TheseusResponse,
  processedData?: unknown[],
  dataShape?: DataShape | null,
): Promise<SceneDirective> {
  const startTime = performance.now();

  await ensureInit();

  let directive: SceneDirective;

  if (modelManagerInstance && modelManagerInstance.isModelLoaded()) {
    try {
      directive = await modelManagerInstance.direct(response, processedData, dataShape);
    } catch {
      directive = ruleBasedDirect(response, processedData, dataShape);
    }
  } else {
    directive = ruleBasedDirect(response, processedData, dataShape);
  }

  feedbackModule?.feedbackCollector.startRecording(directive);

  directive.inference_time_ms = performance.now() - startTime;

  return directive;
}
