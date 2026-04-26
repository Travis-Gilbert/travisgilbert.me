/**
 * Spacetime Atlas: shared types.
 *
 * The /spacetime page renders research clusters across time and space on a
 * sketched rotating globe. The data shape here is the contract between
 * (a) the backend endpoint at `/api/v2/theseus/spacetime/topic/`, and
 * (b) every visual component in `src/components/spacetime/`.
 *
 * Keep these names stable: renaming a field here means a coordinated edit
 * across the data layer and every component below.
 */

/**
 * One geo-temporal cluster on the globe: a single dot with a tooltip.
 *
 * `year` is signed: positive integers are CE years; negative numbers are
 * BCE / Mya for prehistory topics. This keeps the sort order monotonic
 * across the whole timeline and lets `Math.abs` + a unit decide rendering.
 */
export interface SpacetimeEvent {
  id: number;
  city: string;
  lat: number;
  lon: number;
  year: number;
  papers: number;
  note: string;
  /**
   * Per-event accent. Topic-level color overrides this for trace lines and
   * dot fills, but `accent` is preserved so we could later colour individual
   * dots inside one topic differently (e.g. a "controversy" cluster).
   */
  accent: 'terracotta' | 'teal';
}

export type SpacetimeMode = 'modern' | 'prehistory';

/**
 * One topic-row in the explorer. The page can show one (single-topic) or
 * two (compare-mode) of these at a time.
 */
export interface SpacetimeTopic {
  /** Stable slug used as URL fragment / lookup key (e.g. "sickle-cell-anemia"). */
  key: string;
  title: string;
  sub: string;
  /** Total source count behind the topic: appears in the info card. */
  sources: number;
  /** [min year, max year] inclusive. Drives the timeline scrubber. */
  span: [number, number];
  events: SpacetimeEvent[];
  /** Ordered event ids. The pen-line walks this sequence. */
  trace: number[];
  /**
   * Drives the visual treatment (palette + year formatter). The active
   * Topic A's mode wins when a comparison spans modes.
   */
  mode: SpacetimeMode;
}

/**
 * Topic A is always set; Topic B is null when the user has not opted into
 * comparison.
 */
export interface SpacetimeViewState {
  topicA: SpacetimeTopic | null;
  topicB: SpacetimeTopic | null;
}

/** Color for Topic A's dots and trace on the globe. */
export const COLOR_TOPIC_A = '#B45A2D';
/** Color for Topic B's dots and trace on the globe. */
export const COLOR_TOPIC_B = '#2D5F6B';
/**
 * Topic-A accent text color, lifted for legibility on the
 * warm-charcoal info card surface (mirrors the site's dark-mode
 * --color-terracotta-light token).
 */
export const COLOR_TOPIC_A_TEXT = '#D8885E';
/**
 * Topic-B accent text color, lifted for legibility on the
 * warm-charcoal info card surface (mirrors the site's dark-mode
 * --color-teal-light token).
 */
export const COLOR_TOPIC_B_TEXT = '#5AAEC0';
/** Color for cross-topic linkage arcs (shared city). */
export const COLOR_LINKAGE_CITY = '#7A4A8A';
/** Color for cross-topic linkage arcs (close in time). */
export const COLOR_LINKAGE_TIME = '#9A7A6A';
