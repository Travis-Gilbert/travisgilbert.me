/**
 * Phase B: owns all THINKING-state visualizations.
 *
 * Receives SSE stage events from the async ask pipeline and dispatches
 * to the right visualization module. Tracks cleanup functions so
 * visualizations do not leak across queries. Designed so visualization
 * modules can be added additively without changing the dispatch shape.
 *
 * Causal map mode (2026-04-15): the dot grid is a causal map of the
 * retrieval, not a lava lamp. One clear signal (PageRank flood) carries
 * the "evidence rippling out from the entity seeds" reading. Tension
 * flares mark contradictions as a distinct semantic layer. Community
 * pulse adds a gentle structural undertone. The SBERT heatmap and BM25
 * strobe were retired because they visually collided with the flood on
 * the same dots, producing the glowy "all animations firing at once"
 * feel that was the thing the redesign set out to fix.
 */
import type { DotGridHandle } from '@/components/theseus/TheseusDotGrid';
import type { StageEvent } from '@/lib/theseus-api';
import { animatePageRankFlood } from './algorithms/pagerank-flood';
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

        // Primary signal: PageRank flood. A BFS wavefront from the entity
        // seeds that brightens each dot to its Personalized PageRank score.
        // This is the causal "evidence rippling out" reading the dot grid
        // was supposed to carry all along.
        this.registerCleanup(
          animatePageRankFlood(
            this.grid,
            sourceDots,
            event.pagerank_scores,
            this.options.objectIdToDotIndex,
            this.options.prefersReducedMotion,
          ),
        );

        // Background layer: community pulse. A gentle structural
        // undertone so clusters are visible during the flood. Tuned low
        // so it does not compete with the flood for attention.
        this.registerCleanup(
          animateCommunityPulse(
            this.grid,
            event.community_assignments,
            event.pagerank_scores,
            this.options.objectIdToDotIndex,
            this.options.prefersReducedMotion,
          ),
        );

        // Distinct semantic layer: tension flares. Only fires when the
        // retrieval actually surfaced contradictions. Retiring it when
        // tensions.length === 0 means no flare when there is nothing
        // to flag, which keeps the surface honest.
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

        // SBERT heatmap and BM25 strobe were intentionally retired in the
        // 2026-04-15 loading redesign. Their job (showing which specific
        // objects matched the query) is now carried by the terminal
        // stream ("evidence gathered · N items") and by the answer
        // scaffold cards. See docs/plans/2026-04-15-loading-experience-redesign.md.
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
