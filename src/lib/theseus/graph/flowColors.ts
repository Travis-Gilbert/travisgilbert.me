/**
 * Assign a warm chromatic gradient to points sorted by their angle
 * around the graph centroid. Adjacent indices in the rotation buffer
 * become adjacent on the rotation wave, so `rotateColorsGlobally`
 * produces a visible pinwheel instead of an imperceptible shuffle
 * of type colors (which only has ~7 distinct hues).
 *
 * The gradient spans warm hues only (reddish -> gold -> chartreuse)
 * to stay within the editorial palette. Writes into `colors` in
 * place; sorts points by polar angle from the centroid.
 */

/** HSL to RGB. h in [0, 360), s/l in [0, 1]. Returns RGBA in [0, 1]. */
function hslToRgba(h: number, s: number, l: number, alpha = 1): [number, number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) { r1 = c; g1 = x; b1 = 0; }
  else if (hp < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (hp < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (hp < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  const m = l - c / 2;
  return [r1 + m, g1 + m, b1 + m, alpha];
}

/**
 * Populate `colors` with a warm gradient sorted by polar angle.
 * `positions` is a Float32Array of alternating x/y in cosmos.gl space.
 * `colors` gets RGBA per point (4 floats). Writes in place; both
 * arrays must be sized for the same point count.
 *
 * The gradient spans hues 0 (red) -> 75 (yellow-green) with
 * saturation 0.70 and lightness 0.60 (stays vivid against the
 * parchment background and never approaches true white).
 */
export function assignFlowGradient(
  positions: ArrayLike<number>,
  colors: Float32Array,
): void {
  const n = colors.length / 4;
  if (n === 0) return;
  if (positions.length < n * 2) return;

  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += positions[i * 2];
    cy += positions[i * 2 + 1];
  }
  cx /= n;
  cy /= n;

  const ranked: Array<{ idx: number; angle: number }> = new Array(n);
  for (let i = 0; i < n; i++) {
    const dx = positions[i * 2] - cx;
    const dy = positions[i * 2 + 1] - cy;
    ranked[i] = { idx: i, angle: Math.atan2(dy, dx) };
  }
  ranked.sort((a, b) => a.angle - b.angle);

  for (let rank = 0; rank < n; rank++) {
    const pointIdx = ranked[rank].idx;
    const t = rank / n;
    const hue = t * 75;
    const [r, g, b, a] = hslToRgba(hue, 0.70, 0.60, 1);
    const off = pointIdx * 4;
    colors[off] = r;
    colors[off + 1] = g;
    colors[off + 2] = b;
    colors[off + 3] = a;
  }
}
