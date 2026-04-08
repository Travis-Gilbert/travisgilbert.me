/**
 * Phase B: owns all THINKING-state visualizations.
 *
 * Receives SSE stage events from the async ask pipeline and dispatches
 * to the right visualization module. Tracks cleanup functions so
 * visualizations do not leak across queries. Designed so visualization
 * modules can be added additively without changing the dispatch shape.
 */
import type { DotGridHandle } from '@/components/theseus/TheseusDotGrid';
import type { StageEvent } from '@/lib/theseus-api';
import { animatePageRankFlood } from './algorithms/pagerank-flood';
import { animateSBERTHeatmap } from './algorithms/sbert-heatmap';
import { animateBM25Strobe } from './algorithms/bm25-strobe';
import { animateCommunityPulse } from './algorithms/community-pulse';
import { animateTensionFlares } from './algorithms/tension-flares';

export interface ChoreographerOptions {
  prefersReducedMotion: boolean;
  /** Map from object_id (int) to its dotIndex in the grid. */
  objectIdToDotIndex: Map<number, number>;
  /** Dot indices marked personal (terracotta). May be empty if semantic colors not populated. */
  personalDotIndices: Set<number>;
  /** Dot indices marked corpus (teal). May be empty. */
  corpusDotIndices: Set<number>;
}

export class ThinkingChoreographer {
  private cleanupFns: Array<() => void> = [];
  private lastEntityObjectIds: number[] = [];

  constructor(
    private readonly grid: DotGridHandle,
    private readonly options: ChoreographerOptions,
  ) {}

  handleStage(event: StageEvent): void {
    switch (event.name) {
      case 'e4b_classify_complete': {
        // Pre-stage the PageRank source dots so the user sees classification
        // landed on real graph objects before the flood starts.
        this.lastEntityObjectIds = event.entity_object_ids ?? [];
        for (const objId of this.lastEntityObjectIds) {
          const idx = this.options.objectIdToDotIndex.get(objId);
          if (idx === undefined) continue;
          this.grid.setDotGalaxyState(idx, {
            opacityOverride: 0.85,
            colorOverride: [74, 138, 150],
          });
        }
        this.grid.wakeAnimation();
        break;
      }

      case 'retrieval_complete': {
        const sourceDots = this.lastEntityObjectIds
          .map((id) => this.options.objectIdToDotIndex.get(id))
          .filter((idx): idx is number => idx !== undefined);

        this.registerCleanup(
          animatePageRankFlood(
            this.grid,
            sourceDots,
            event.pagerank_scores,
            this.options.objectIdToDotIndex,
            this.options.prefersReducedMotion,
          ),
        );

        this.registerCleanup(
          animateSBERTHeatmap(
            this.grid,
            event.sbert_scores,
            this.options.objectIdToDotIndex,
            this.options.prefersReducedMotion,
          ),
        );

        this.registerCleanup(
          animateBM25Strobe(
            this.grid,
            event.bm25_hits,
            this.options.objectIdToDotIndex,
            this.options.prefersReducedMotion,
          ),
        );

        this.registerCleanup(
          animateCommunityPulse(
            this.grid,
            event.community_assignments,
            event.pagerank_scores,
            this.options.objectIdToDotIndex,
            this.options.prefersReducedMotion,
          ),
        );

        if (event.tensions.length > 0) {
          this.registerCleanup(
            animateTensionFlares(
              this.grid,
              event.tensions,
              this.options.objectIdToDotIndex,
              this.options.prefersReducedMotion,
            ),
          );
        }
        break;
      }

      case 'objects_loaded':
      case 'expression_start':
        // Thinking phase is ending. Clean up so construction has a clean slate.
        this.cleanup();
        break;

      default:
        // pipeline_start, e4b_classify_start, retrieval_start, expression_complete
        // do not drive visualizations directly.
        break;
    }
  }

  cleanup(): void {
    for (const fn of this.cleanupFns) {
      try {
        fn();
      } catch (err) {
        console.warn('[ThinkingChoreographer] cleanup failed', err);
      }
    }
    this.cleanupFns = [];
  }

  private registerCleanup(fn: () => void): void {
    this.cleanupFns.push(fn);
  }
}
