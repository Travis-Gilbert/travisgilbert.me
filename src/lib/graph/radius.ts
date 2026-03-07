/**
 * Node radius scaling functions for D3 graph visualizations.
 *
 * Three modes:
 *   scaleByCount   linear map of connection count to radius (ConnectionMap pattern)
 *   scaleByScore   linear map of total score to radius (quality-weighted, spec)
 *   scaleByDegree  linear map of edge degree to radius (KnowledgeMap/TimelineGraph pattern)
 */

/**
 * Scale radius by connection count. Used by ConnectionMap.
 *
 * @param count   number of connections for this node
 * @param max     maximum connection count across all nodes (must be >= 1)
 * @param minR    minimum radius in pixels (default 8)
 * @param maxR    maximum radius in pixels (default 24)
 */
export function scaleByCount(
  count: number,
  max: number,
  minR = 8,
  maxR = 24,
): number {
  if (max <= 0) return minR;
  return minR + (count / max) * (maxR - minR);
}

/**
 * Scale radius by sum of connection scores. Rewards quality over quantity.
 * A node with 3 connections at 0.9 each (sum 2.7) will be larger than
 * a node with 5 connections at 0.2 each (sum 1.0).
 *
 * @param totalScore  sum of connection weights for this node
 * @param maxScore    maximum total score across all nodes (must be >= 1)
 * @param minR        minimum radius in pixels (default 8)
 * @param maxR        maximum radius in pixels (default 24)
 */
export function scaleByScore(
  totalScore: number,
  maxScore: number,
  minR = 8,
  maxR = 24,
): number {
  if (maxScore <= 0) return minR;
  return minR + (totalScore / maxScore) * (maxR - minR);
}

/**
 * Scale radius by edge degree. Used by KnowledgeMap and TimelineGraph.
 * Smaller range than scaleByCount for denser graphs.
 *
 * @param degree  number of edges touching this node
 * @param max     maximum degree across all nodes (must be >= 1)
 * @param minR    minimum radius in pixels (default 6)
 * @param maxR    maximum radius in pixels (default 18)
 */
export function scaleByDegree(
  degree: number,
  max: number,
  minR = 6,
  maxR = 18,
): number {
  if (max <= 0) return minR;
  return minR + (degree / max) * (maxR - minR);
}
