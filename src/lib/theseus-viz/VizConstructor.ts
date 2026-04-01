/* SPEC-VIE-3: Top-level orchestrator for visualization construction */

import type { TheseusResponse } from '@/lib/theseus-types';
import type { SceneSpec, DataShape } from './SceneSpec';
import { ruleBasedConstruct } from './rules/RuleEngine';

/**
 * Constructs a complete visualization from a TheseusResponse.
 * Uses the learned model if available, otherwise falls back to rules.
 *
 * Pipeline:
 *  1. Extract features
 *  2. Check if ModelManager has a loaded model
 *  3. If yes: learned pipeline (encoder > heads > layout)
 *  4. If no: RuleEngine
 *  5. Generate data_layer if processedData present
 *  6. Generate construction_sequence
 *  7. Generate interaction rules
 *  8. Assemble SceneSpec
 *  9. Log inference_method and inference_time_ms
 * 10. Start FeedbackCollector recording
 * 11. Return SceneSpec
 */
export async function constructVisualization(
  response: TheseusResponse,
  processedData?: unknown[],
  dataShape?: DataShape | null,
): Promise<SceneSpec> {
  const startTime = performance.now();

  // Try learned model path if ModelManager is available
  let modelManager: { isModelLoaded: () => boolean; construct: (r: TheseusResponse, d?: unknown[], s?: DataShape | null) => Promise<SceneSpec> } | null = null;

  try {
    const mod = await import('./model/ModelManager');
    modelManager = mod.modelManager;
  } catch {
    // ModelManager not available yet or TF.js not loaded
  }

  let sceneSpec: SceneSpec;

  if (modelManager && modelManager.isModelLoaded()) {
    try {
      sceneSpec = await modelManager.construct(response, processedData, dataShape);
    } catch {
      // Fall back to rules if model inference fails
      sceneSpec = ruleBasedConstruct(response, processedData, dataShape);
    }
  } else {
    sceneSpec = ruleBasedConstruct(response, processedData, dataShape);
  }

  // Start feedback recording (non-blocking)
  try {
    const { feedbackCollector } = await import('./training/FeedbackCollector');
    feedbackCollector.startRecording(sceneSpec);
  } catch {
    // Feedback collector not available
  }

  // Update timing to include orchestration overhead
  sceneSpec.inference_time_ms = performance.now() - startTime;

  return sceneSpec;
}
