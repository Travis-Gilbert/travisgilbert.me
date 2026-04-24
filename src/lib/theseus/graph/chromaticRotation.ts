/**
 * Chromatic rotation (global): shift every point's color forward by
 * one slot. Point `i` receives the color previously held by point
 * `i - 1`; point `0` wraps to the last point's color. Over time this
 * produces a visible chromatic wave across the entire canvas.
 *
 * Semantic color identity (type -> color) is only disturbed during the
 * Flow lens; Atlas and Clusters lenses reload colors from backend data
 * on lens switch, restoring type-to-color meaning for reading. This
 * matches the cosmos.gl worm example reference.
 *
 * Buffer reuse: writes into `dst` (must match `src` length).
 * Allocations in hot paths are a known perf smell (claim 9d94e0e528c3),
 * so the caller must always pass a pooled `dst`.
 */
export function rotateColorsGlobally(src: Float32Array, dst: Float32Array): void {
  if (dst.length !== src.length) {
    throw new Error(
      `rotateColorsGlobally: dst length ${dst.length} must equal src length ${src.length}`,
    );
  }
  const pointCount = src.length / 4;
  if (pointCount < 2) {
    dst.set(src);
    return;
  }
  // First point wraps to last point's color.
  const lastOff = (pointCount - 1) * 4;
  dst[0] = src[lastOff];
  dst[1] = src[lastOff + 1];
  dst[2] = src[lastOff + 2];
  dst[3] = src[lastOff + 3];
  // Remaining points receive the previous point's color.
  for (let i = 1; i < pointCount; i++) {
    const dstOff = i * 4;
    const srcOff = (i - 1) * 4;
    dst[dstOff] = src[srcOff];
    dst[dstOff + 1] = src[srcOff + 1];
    dst[dstOff + 2] = src[srcOff + 2];
    dst[dstOff + 3] = src[srcOff + 3];
  }
}

/**
 * Within-cluster rotation: shift each point's color by one slot
 * within its Leiden cluster. Kept for future lens experimentation;
 * NOT currently used by the Flow lens because Leiden clusters are
 * color-homogeneous (points of the same type cluster together), so
 * within-cluster rotation is visually null.
 *
 * Buffer reuse: writes into `dst` (must match `src` length).
 */
export function rotateColorsWithinClusters(
  src: Float32Array,
  clusters: Int32Array,
  dst: Float32Array,
): void {
  const pointCount = clusters.length;
  if (src.length !== pointCount * 4) {
    throw new Error(
      `rotateColorsWithinClusters: src length ${src.length} does not match pointCount * 4 (${pointCount * 4})`,
    );
  }
  if (dst.length !== src.length) {
    throw new Error(
      `rotateColorsWithinClusters: dst length ${dst.length} must equal src length ${src.length}`,
    );
  }

  // Build cluster membership: for each cluster id, the list of point
  // indices. Built each call (cheap; linear in pointCount) so the
  // caller does not have to pre-partition.
  const members = new Map<number, number[]>();
  for (let i = 0; i < pointCount; i++) {
    const c = clusters[i];
    const list = members.get(c);
    if (list) {
      list.push(i);
    } else {
      members.set(c, [i]);
    }
  }

  // Rotate: dst[member[k]] = src[member[(k - 1 + n) % n]].
  // Singletons copy straight across.
  for (const ring of members.values()) {
    const n = ring.length;
    if (n < 2) {
      for (const idx of ring) {
        const off = idx * 4;
        dst[off] = src[off];
        dst[off + 1] = src[off + 1];
        dst[off + 2] = src[off + 2];
        dst[off + 3] = src[off + 3];
      }
      continue;
    }
    for (let k = 0; k < n; k++) {
      const dstIdx = ring[k];
      const srcIdx = ring[(k - 1 + n) % n];
      const dstOff = dstIdx * 4;
      const srcOff = srcIdx * 4;
      dst[dstOff] = src[srcOff];
      dst[dstOff + 1] = src[srcOff + 1];
      dst[dstOff + 2] = src[srcOff + 2];
      dst[dstOff + 3] = src[srcOff + 3];
    }
  }
}
