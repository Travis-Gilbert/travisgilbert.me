import type { RenderTargetDirective } from '../SceneDirective';
import type { DataShape, GraphDecision } from '../SceneSpec';
import { generateD3Spec } from './D3SpecGenerator';
import { generateVegaSpec } from './VegaSpecGenerator';

function buildGraphDecision(
  renderTarget: RenderTargetDirective,
): GraphDecision {
  return {
    render_target:
      renderTarget.primary === 'd3' || renderTarget.primary === 'vega-lite'
        ? renderTarget.primary
        : 'r3f',
    render_target_confidence: 1,
    layout_type: 'mixed',
    layout_type_confidence: 1,
    data_viz_type: renderTarget.data_viz_type ?? 'custom',
    camera_position: [0, 0, 8],
    camera_lookAt: [0, 0, 0],
  };
}

export function buildRenderTargetSpecs(
  renderTarget: RenderTargetDirective,
  processedData?: unknown[],
  dataShape?: DataShape | null,
): RenderTargetDirective {
  if (!processedData?.length || !dataShape) {
    return renderTarget;
  }

  const graphDecision = buildGraphDecision(renderTarget);

  if (renderTarget.primary === 'vega-lite') {
    const vega = generateVegaSpec(dataShape, processedData, graphDecision);
    return {
      ...renderTarget,
      data_viz_type: vega.chartType,
      vega_spec: vega.spec,
    };
  }

  if (renderTarget.primary === 'd3') {
    const d3 = generateD3Spec(dataShape, processedData, graphDecision);
    return {
      ...renderTarget,
      data_viz_type:
        d3.type === 'geo_heatmap'
          ? 'geographic'
          : d3.type === 'scatter_3d'
            ? 'scatter'
            : d3.type === 'network'
              ? 'custom'
              : 'custom',
      d3_spec: d3.spec,
    };
  }

  return renderTarget;
}
