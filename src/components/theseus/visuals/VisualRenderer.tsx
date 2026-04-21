/**
 * VisualRenderer — dispatches a StructuredVisual to the appropriate
 * renderer component based on `structured_visual.renderer`.
 *
 * The backend streams StructuredVisual mid-stream via `visual_delta`
 * events for 7 answer types. Types are defined in theseus-types.ts;
 * each renderer consumes a narrow slice of that payload.
 *
 * Dispatch policy (respects project "No Fake UI" rule):
 *   - A known renderer key → matching component
 *   - An unknown / unwired key → null (no placeholder UI)
 *   - A payload with no structured data → null
 *
 * Region hover bubbles back to the caller so the canvas can cross-
 * highlight via `adapter.focusNodes`.
 */

'use client';

import type { FC } from 'react';
import type { StructuredVisual, StructuredVisualRegion } from '@/lib/theseus-types';
import ComparisonTable from './ComparisonTable';
import TimelineStrip from './TimelineStrip';
import HierarchyTree from './HierarchyTree';
import ConceptMap from './ConceptMap';
import ProcessFlow from './ProcessFlow';
import TFJSStipple from './TFJSStipple';
import GeographicMap from './GeographicMap';

export interface VisualRendererProps {
  visual: StructuredVisual | null | undefined;
  /** Fired when the user hovers a labeled region. The caller is expected
   *  to route to `adapter.focusNodes(region.linked_evidence)`. */
  onRegionHover?: (region: StructuredVisualRegion | null) => void;
  /** Fired when the user clicks a region. Same routing contract. */
  onRegionSelect?: (region: StructuredVisualRegion) => void;
}

const VisualRenderer: FC<VisualRendererProps> = ({ visual, onRegionHover, onRegionSelect }) => {
  if (!visual) return null;

  // Backend `renderer` wins when present (explicit authoritative key).
  // Fall back to `visual_type` mapping for older payloads / classifier
  // outputs that haven't been upgraded backend-side yet.
  const key = visual.renderer ?? visualTypeToRenderer(visual.visual_type);
  if (!key) return null;

  switch (key) {
    case 'comparison_table':
      return (
        <ComparisonTable
          visual={visual}
          onRegionHover={onRegionHover}
          onRegionSelect={onRegionSelect}
        />
      );
    case 'timeline_strip':
      return (
        <TimelineStrip
          visual={visual}
          onRegionHover={onRegionHover}
          onRegionSelect={onRegionSelect}
        />
      );
    case 'hierarchy_tree':
      return (
        <HierarchyTree
          visual={visual}
          onRegionHover={onRegionHover}
          onRegionSelect={onRegionSelect}
        />
      );
    case 'concept_map':
      return (
        <ConceptMap
          visual={visual}
          onRegionHover={onRegionHover}
          onRegionSelect={onRegionSelect}
        />
      );
    case 'process_flow':
      return (
        <ProcessFlow
          visual={visual}
          onRegionHover={onRegionHover}
          onRegionSelect={onRegionSelect}
        />
      );
    case 'tfjs_stipple':
      return (
        <TFJSStipple
          visual={visual}
          onRegionHover={onRegionHover}
          onRegionSelect={onRegionSelect}
        />
      );
    case 'geographic_map':
      return (
        <GeographicMap
          visual={visual}
          onRegionHover={onRegionHover}
          onRegionSelect={onRegionSelect}
        />
      );
    default:
      return null;
  }
};

function visualTypeToRenderer(
  visualType: StructuredVisual['visual_type'] | undefined,
): string | null {
  if (!visualType) return null;
  switch (visualType) {
    case 'comparison':
      return 'comparison_table';
    case 'timeline':
      return 'timeline_strip';
    case 'hierarchy':
      return 'hierarchy_tree';
    case 'diagram':
      return 'concept_map';
    case 'geographic':
      return 'geographic_map';
    case 'portrait':
      return 'tfjs_stipple';
    case 'explanation':
    case 'code':
    default:
      return null;
  }
}

export default VisualRenderer;
