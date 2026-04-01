/* SPEC-VIE-3 v3: Rule-based fallback (cold-start, no ML)
 *
 * Calls each intelligence module in rule-based mode (no model outputs)
 * and assembles a complete SceneDirective.
 */

import type { TheseusResponse } from '@/lib/theseus-types';
import type { SceneDirective, RenderTargetDirective } from '../SceneDirective';
import type { DataShape } from '../SceneSpec';
import { parseResponseSections } from '../features/parseResponse';
import { extractDataFeatures } from '../features/DataFeatures';
import { scoreSalience } from '../intelligence/SalienceScorer';
import { styleHypotheses } from '../intelligence/HypothesisStyler';
import { selectContextShelf } from '../intelligence/ContextShelfSelector';
import { composeSequence } from '../intelligence/SequenceComposer';
import { configureForces } from '../intelligence/ForceConfigurator';
import { composeCamera } from '../intelligence/CameraComposer';
import { interpretTopology } from '../intelligence/TopologyInterpreter';

export function ruleBasedDirect(
  response: TheseusResponse,
  processedData?: unknown[],
  dataShape?: DataShape | null,
): SceneDirective {
  const startTime = performance.now();

  const { tensions, hypotheses, allNodes, allEdges } =
    parseResponseSections(response);

  // Job 7: Topology (needed by ForceConfigurator)
  const topology = interpretTopology(
    allNodes, allEdges, tensions.length, hypotheses.length,
  );

  // Job 1: Salience
  const salience = scoreSalience(allNodes, allEdges);

  // Job 2: Hypothesis styling
  const hypothesisStyle = styleHypotheses(allNodes, allEdges);

  // Job 3: Context shelf
  const is3D = !dataShape; // 3D for graph-only, 2D for data-driven
  const contextShelf = selectContextShelf(allNodes, dataShape ?? null, is3D);

  // Job 4: Construction sequence
  const isConstructing = !!processedData && processedData.length > 0;
  const construction = composeSequence(allNodes, allEdges, salience, isConstructing);

  // Job 5: Force configuration
  const forceConfig = configureForces(allNodes, allEdges, topology.primary_shape);

  // Job 6: Camera
  const camera = composeCamera(allNodes, salience);

  // Render target
  const renderTarget = selectRenderTarget(dataShape ?? null, allNodes.length);

  return {
    salience,
    hypothesis_style: hypothesisStyle,
    context_shelf: contextShelf,
    construction,
    force_config: forceConfig,
    camera,
    topology,
    render_target: renderTarget,
    inference_method: 'rule_based',
    inference_time_ms: performance.now() - startTime,
  };
}

function selectRenderTarget(
  dataShape: DataShape | null,
  nodeCount: number,
): RenderTargetDirective {
  const dataFeatures = extractDataFeatures(dataShape);

  // Geographic data: d3
  if (dataFeatures[9] === 1.0) {
    return {
      primary: 'd3',
      fallback: 'sigma-2d',
      reason: 'geographic data detected',
      data_viz_type: 'geographic',
    };
  }

  // Time series: vega-lite
  if (dataFeatures[8] === 1.0) {
    return {
      primary: 'vega-lite',
      fallback: 'sigma-2d',
      reason: 'time series data detected',
      data_viz_type: 'line',
    };
  }

  // Categorical + numeric: vega-lite
  if (dataFeatures[2] === 1.0 && dataFeatures[3] === 1.0) {
    return {
      primary: 'vega-lite',
      fallback: 'sigma-2d',
      reason: 'categorical and numeric data detected',
      data_viz_type: 'bar',
    };
  }

  // Graph-only: size-based choice
  if (nodeCount >= 50) {
    return {
      primary: 'sigma-2d',
      fallback: 'force-graph-3d',
      reason: `large graph (${nodeCount} nodes), using 2D for performance`,
      data_viz_type: 'none',
    };
  }

  // Default: 3D force graph
  return {
    primary: 'force-graph-3d',
    fallback: 'sigma-2d',
    reason: 'graph-only answer',
    data_viz_type: 'none',
  };
}
