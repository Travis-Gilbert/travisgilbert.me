/**
 * Map artifact types for saved, replayable epistemic snapshots.
 *
 * A Map is a TMS-powered visual record of what is known, contested,
 * and unknown about a topic at a point in time. Three entry points:
 *   1. Rich answer from Ask Theseus (origin: 'ask')
 *   2. Microscope mode pointed at a graph region (origin: 'microscope')
 *   3. Re-run of a saved map to see what changed (origin: 'rerun')
 */

import type { SceneDirective, TruthMapTopologyDirective } from '@/lib/theseus-viz/SceneDirective';
import type { MapSection } from '@/lib/theseus-types';

export type MapOrigin = 'ask' | 'microscope' | 'rerun';

export type MicroscopeTargetType = 'cluster' | 'object' | 'topic';

export interface DotAssignment {
  dot_index: number;
  region_type: 'agreement' | 'tension' | 'blind_spot' | 'ambient';
  region_id: string;
  claim_pk?: number;
  entrenchment?: number;
}

export interface MapVisualComposition {
  scene_directive: SceneDirective;
  truth_topology: TruthMapTopologyDirective;
  dot_assignments: DotAssignment[];
}

export interface SavedMap {
  slug: string;
  title: string;
  origin: MapOrigin;
  query_text: string;
  target_cluster_id?: number;
  target_object_id?: number;
  target_topic?: string;
  parent_map_slug?: string;
  epistemic_data: MapSection;
  visual_composition: MapVisualComposition;
  claim_count: number;
  tension_count: number;
  blind_spot_count: number;
  source_independence_score: number;
  created_at: string;
  updated_at: string;
}

export interface SavedMapListItem {
  slug: string;
  title: string;
  origin: MapOrigin;
  query_text: string;
  claim_count: number;
  tension_count: number;
  blind_spot_count: number;
  source_independence_score: number;
  created_at: string;
}

export interface MapDiff {
  new_claims: number[];
  removed_claims: number[];
  resolved_tensions: number[];
  new_tensions: number[];
  new_blind_spots: string[];
  resolved_blind_spots: string[];
  entrenchment_changes: Array<{
    claim_pk: number;
    old_entrenchment: number;
    new_entrenchment: number;
  }>;
}

export interface MapRerunResult {
  tms_map_data: MapSection;
  diff: MapDiff;
  parent_slug: string;
  new_slug?: string;
}

export interface SaveMapInput {
  title: string;
  origin: MapOrigin;
  query_text?: string;
  target_cluster_id?: number;
  target_object_id?: number;
  target_topic?: string;
  epistemic_data: MapSection;
  visual_composition: MapVisualComposition;
  notebook_slug?: string;
  project_slug?: string;
}

export interface MicroscopeInput {
  target_type: MicroscopeTargetType;
  target_id?: number;
  target_topic?: string;
  depth?: number;
}
