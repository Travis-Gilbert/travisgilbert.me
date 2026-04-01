/* SPEC-VIE-3 v3: Captures interaction signals for model training */

import type { SceneDirective, VizFeedback } from '../SceneDirective';
import { djb2 } from '@/lib/studio-prng';

class FeedbackCollector {
  private recording = false;
  private currentDirective: SceneDirective | null = null;
  private startTime = 0;
  private firstInteractionTime = 0;
  private nodesClicked: string[] = [];
  private nodesClickedWithin3s: string[] = [];
  private dwellTimes: Record<string, number> = {};
  private whatIfRemovals = 0;
  private clusterWhatIfs = 0;
  private followUpsAsked = 0;
  private modelSaved = false;
  private gifExported = false;
  private thumbs: 'up' | 'down' | null = null;
  private wrongConnections: string[] = [];
  private usefulConnections: string[] = [];
  private constructionWatchedFully = false;

  startRecording(directive: SceneDirective): void {
    this.stopRecording();
    this.recording = true;
    this.currentDirective = directive;
    this.startTime = performance.now();
    this.firstInteractionTime = 0;
    this.nodesClicked = [];
    this.nodesClickedWithin3s = [];
    this.dwellTimes = {};
    this.whatIfRemovals = 0;
    this.clusterWhatIfs = 0;
    this.followUpsAsked = 0;
    this.modelSaved = false;
    this.gifExported = false;
    this.thumbs = null;
    this.wrongConnections = [];
    this.usefulConnections = [];
    this.constructionWatchedFully = false;
  }

  recordNodeClick(nodeId: string): void {
    if (!this.recording) return;
    this.nodesClicked.push(nodeId);
    if (!this.firstInteractionTime) {
      this.firstInteractionTime = performance.now();
    }
    const elapsed = performance.now() - this.startTime;
    if (elapsed < 3000) {
      this.nodesClickedWithin3s.push(nodeId);
    }
  }

  recordDwell(nodeId: string, durationMs: number): void {
    if (!this.recording) return;
    this.dwellTimes[nodeId] = (this.dwellTimes[nodeId] || 0) + durationMs;
  }

  recordWhatIfRemoval(): void {
    if (!this.recording) return;
    this.whatIfRemovals++;
  }

  recordClusterWhatIf(): void {
    if (!this.recording) return;
    this.clusterWhatIfs++;
  }

  recordFollowUp(): void {
    if (!this.recording) return;
    this.followUpsAsked++;
  }

  recordModelSaved(): void {
    if (!this.recording) return;
    this.modelSaved = true;
  }

  recordGifExported(): void {
    if (!this.recording) return;
    this.gifExported = true;
  }

  recordThumbs(direction: 'up' | 'down'): void {
    if (!this.recording) return;
    this.thumbs = direction;
  }

  recordWrongConnection(edgeId: string): void {
    if (!this.recording) return;
    this.wrongConnections.push(edgeId);
  }

  recordUsefulConnection(edgeId: string): void {
    if (!this.recording) return;
    this.usefulConnections.push(edgeId);
  }

  recordConstructionWatched(): void {
    if (!this.recording) return;
    this.constructionWatchedFully = true;
  }

  stopRecording(): VizFeedback | null {
    if (!this.recording || !this.currentDirective) return null;

    const d = this.currentDirective;
    const totalMs = performance.now() - this.startTime;
    const clickedSet = new Set(this.nodesClicked);
    const allNodeIds = d.salience.map(s => s.node_id);
    const visibleNotClicked = allNodeIds.filter(id => !clickedSet.has(id));

    const feedback: VizFeedback = {
      query_hash: djb2(d.topology.primary_shape + d.salience.length.toString()).toString(36),
      topology_primary: d.topology.primary_shape,
      render_target_used: d.render_target.primary,
      inference_method: d.inference_method,
      node_count: d.salience.length,
      edge_count: d.hypothesis_style.edge_styles.length,
      has_data_layer: d.context_shelf.enabled,

      nodes_clicked: this.nodesClicked,
      nodes_clicked_within_3s: this.nodesClickedWithin3s,
      nodes_visible_not_clicked: visibleNotClicked,
      dwell_time_per_node: this.dwellTimes,
      what_if_removals: this.whatIfRemovals,
      cluster_what_ifs: this.clusterWhatIfs,
      follow_ups_asked: this.followUpsAsked,
      model_saved: this.modelSaved,
      gif_exported: this.gifExported,

      thumbs: this.thumbs,
      wrong_connections: this.wrongConnections,
      useful_connections: this.usefulConnections,

      time_to_first_interaction_ms: this.firstInteractionTime
        ? this.firstInteractionTime - this.startTime
        : totalMs,
      total_session_ms: totalMs,
      construction_watched_fully: this.constructionWatchedFully,
    };

    this.recording = false;
    this.currentDirective = null;
    return feedback;
  }
}

export const feedbackCollector = new FeedbackCollector();
