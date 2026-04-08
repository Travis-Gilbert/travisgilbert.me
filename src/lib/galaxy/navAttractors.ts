/**
 * navAttractors.ts
 *
 * Button attractor physics for the adaptive navigation system. A subset of
 * background dots is recruited toward attractor positions to form button
 * shapes. Recruited dots use this module's spring physics; non-recruited
 * dots stay on the host grid's normal physics path.
 *
 * Coexistence with Phase B visualizations: Phase B writes opacity and color
 * overrides via setDotGalaxyState. This module only writes positions and
 * velocities. Recruited dots keep any color/opacity overrides Phase B has
 * already set on them, and they will appear in those colors while sitting
 * inside button shapes. The host component is responsible for skipping the
 * normal home-spring and mouse-repulsion physics for any dot that is
 * currently recruited (so this module owns position exclusively for the
 * dots it claims).
 */

export interface NavAttractor {
  id: string;
  /** Center position in canvas coordinates. */
  cx: number;
  cy: number;
  /** Button bounds (rectangular; pill visual is delivered by Batch 3 labels). */
  width: number;
  height: number;
  /** Spring stiffness applied each tick. */
  stiffness: number;
  /** Per-tick velocity damping factor. */
  damping: number;
  /** Animated formation progress, 0 (scattered) .. 1 (fully formed). */
  formation: number;
  /** Formation target. 1 = forming, 0 = dissolving. */
  targetFormation: number;
  /** Dot indices currently bound to this attractor. */
  recruitedDots: Set<number>;
  /** Per-recruited-dot target position inside the button shape. */
  targetPositions: Map<number, [number, number]>;
  /** Display label (rendered by Batch 3). */
  label: string;
  /** Derived from formation via easeOutCubic. */
  alpha: number;
}

const DEFAULT_STIFFNESS = 0.06;
const DEFAULT_DAMPING = 0.85;
const FORMATION_RATE = 0.08;
const BOTTOM_GAP = 12;
const HORIZONTAL_GAP = 16;
const DESKTOP_HEIGHT = 36;
const MOBILE_HEIGHT = 44;
const MIN_BUTTON_WIDTH = 80;
const LABEL_CHAR_PX = 8;
const LABEL_PADDING_PX = 32;
const RECRUIT_SPACING_FACTOR = 0.6;

function easeOutCubic(t: number): number {
  const x = 1 - t;
  return 1 - x * x * x;
}

function computeButtonDimensions(label: string, viewportWidth: number): { width: number; height: number } {
  const isMobile = viewportWidth < 768;
  const height = isMobile ? MOBILE_HEIGHT : DESKTOP_HEIGHT;
  const width = Math.max(MIN_BUTTON_WIDTH, label.length * LABEL_CHAR_PX + LABEL_PADDING_PX);
  return { width, height };
}

/**
 * Compute attractor positions from a list of buttons and the viewport.
 *
 * Diffs against `existingAttractors`: matching ids preserve their animation
 * state (formation, targetFormation, recruitedDots, targetPositions, cx, cy)
 * so transitions stay smooth, with width/height/label refreshed. Removed
 * buttons are kept in the result with `targetFormation = 0` so they animate
 * out gracefully; the caller prunes them once fully dissolved.
 */
export function layoutAttractors(
  buttons: Array<{ id: string; label: string }>,
  viewportWidth: number,
  viewportHeight: number,
  existingAttractors: NavAttractor[],
): NavAttractor[] {
  const existingById = new Map<string, NavAttractor>();
  for (const a of existingAttractors) existingById.set(a.id, a);

  // Compute total row width to find the starting x for centered layout.
  const sized = buttons.map((b) => ({
    button: b,
    dims: computeButtonDimensions(b.label, viewportWidth),
  }));

  const totalWidth = sized.reduce((sum, s, i) => sum + s.dims.width + (i > 0 ? HORIZONTAL_GAP : 0), 0);
  let cursorX = Math.round((viewportWidth - totalWidth) / 2);

  const result: NavAttractor[] = [];
  const seenIds = new Set<string>();

  for (const { button, dims } of sized) {
    const cx = cursorX + dims.width / 2;
    const cy = viewportHeight - BOTTOM_GAP - dims.height / 2;
    cursorX += dims.width + HORIZONTAL_GAP;
    seenIds.add(button.id);

    const existing = existingById.get(button.id);
    if (existing) {
      // Preserve animation state; refresh layout.
      existing.cx = cx;
      existing.cy = cy;
      existing.width = dims.width;
      existing.height = dims.height;
      existing.label = button.label;
      existing.targetFormation = 1;
      result.push(existing);
    } else {
      result.push({
        id: button.id,
        cx,
        cy,
        width: dims.width,
        height: dims.height,
        stiffness: DEFAULT_STIFFNESS,
        damping: DEFAULT_DAMPING,
        formation: 0,
        targetFormation: 1,
        recruitedDots: new Set<number>(),
        targetPositions: new Map<number, [number, number]>(),
        label: button.label,
        alpha: 0,
      });
    }
  }

  // Carry over removed attractors so they animate out.
  for (const existing of existingAttractors) {
    if (seenIds.has(existing.id)) continue;
    existing.targetFormation = 0;
    result.push(existing);
  }

  return result;
}

/**
 * Recruit the nearest dots to fill an attractor's button shape with a tight
 * grid layout (60% of natural background spacing). Skips dots already
 * recruited by another attractor. Stores per-dot target positions on the
 * attractor.
 */
export function recruitDotsForAttractor(
  attractor: NavAttractor,
  dotPositionsX: Float32Array,
  dotPositionsY: Float32Array,
  alreadyRecruited: Set<number>,
): void {
  const totalDots = dotPositionsX.length;
  if (totalDots === 0) return;

  // Estimate natural grid spacing from total area / dot count, then tighten.
  // We don't know viewport precisely here, so estimate from the bounding
  // box of dot positions.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < totalDots; i++) {
    const x = dotPositionsX[i];
    const y = dotPositionsY[i];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const areaW = Math.max(1, maxX - minX);
  const areaH = Math.max(1, maxY - minY);
  const naturalSpacing = Math.sqrt((areaW * areaH) / totalDots);
  const tightSpacing = Math.max(2, naturalSpacing * RECRUIT_SPACING_FACTOR);

  // Build target slot grid inside the button rectangle.
  const cols = Math.max(1, Math.floor(attractor.width / tightSpacing));
  const rows = Math.max(1, Math.floor(attractor.height / tightSpacing));
  const slotsCount = cols * rows;
  const startX = attractor.cx - ((cols - 1) * tightSpacing) / 2;
  const startY = attractor.cy - ((rows - 1) * tightSpacing) / 2;

  const slots: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push([startX + c * tightSpacing, startY + r * tightSpacing]);
    }
  }

  // Find the nearest `slotsCount` dots to attractor center, skipping any
  // dots already claimed by another attractor.
  const candidates: Array<{ index: number; dist: number }> = [];
  for (let i = 0; i < totalDots; i++) {
    if (alreadyRecruited.has(i)) continue;
    const dx = dotPositionsX[i] - attractor.cx;
    const dy = dotPositionsY[i] - attractor.cy;
    candidates.push({ index: i, dist: dx * dx + dy * dy });
  }
  candidates.sort((a, b) => a.dist - b.dist);
  const picked = candidates.slice(0, slotsCount);

  // Assign each picked dot to the nearest free slot for stable mapping.
  const remainingSlots = slots.slice();
  for (const { index } of picked) {
    let bestSlot = 0;
    let bestSlotDist = Infinity;
    const dx0 = dotPositionsX[index];
    const dy0 = dotPositionsY[index];
    for (let s = 0; s < remainingSlots.length; s++) {
      const [sx, sy] = remainingSlots[s];
      const sd = (sx - dx0) * (sx - dx0) + (sy - dy0) * (sy - dy0);
      if (sd < bestSlotDist) {
        bestSlotDist = sd;
        bestSlot = s;
      }
    }
    const [tx, ty] = remainingSlots[bestSlot];
    attractor.recruitedDots.add(index);
    attractor.targetPositions.set(index, [tx, ty]);
    alreadyRecruited.add(index);
    remainingSlots.splice(bestSlot, 1);
    if (remainingSlots.length === 0) break;
  }
}

/**
 * Per-frame physics: animate formation, then apply spring physics to all
 * recruited dots. Dots whose attractor is dissolving spring back to their
 * original grid home. Once an attractor is fully dissolved, its recruits
 * are released so the host's normal physics resumes.
 */
export function tickAttractorPhysics(
  attractors: NavAttractor[],
  dotPositionsX: Float32Array,
  dotPositionsY: Float32Array,
  dotHomeX: Float32Array,
  dotHomeY: Float32Array,
  dotVelocityX: Float32Array,
  dotVelocityY: Float32Array,
): void {
  for (const attractor of attractors) {
    // Animate formation.
    attractor.formation += (attractor.targetFormation - attractor.formation) * FORMATION_RATE;
    if (attractor.formation < 0) attractor.formation = 0;
    if (attractor.formation > 1) attractor.formation = 1;
    attractor.alpha = easeOutCubic(attractor.formation);

    const stiffness = attractor.stiffness;
    const damping = attractor.damping;
    const forming = attractor.formation > 0.05;
    const dissolving = attractor.targetFormation === 0 && !forming;

    for (const idx of attractor.recruitedDots) {
      if (idx < 0 || idx >= dotPositionsX.length) continue;

      let targetX: number;
      let targetY: number;
      if (forming) {
        const target = attractor.targetPositions.get(idx);
        if (!target) continue;
        targetX = target[0];
        targetY = target[1];
      } else {
        // Springing back home as the attractor dissolves.
        targetX = dotHomeX[idx];
        targetY = dotHomeY[idx];
      }

      const dx = targetX - dotPositionsX[idx];
      const dy = targetY - dotPositionsY[idx];
      dotVelocityX[idx] += dx * stiffness;
      dotVelocityY[idx] += dy * stiffness;
      dotVelocityX[idx] *= damping;
      dotVelocityY[idx] *= damping;
      dotPositionsX[idx] += dotVelocityX[idx];
      dotPositionsY[idx] += dotVelocityY[idx];
    }

    // Release recruits once fully dissolved so the host's normal physics
    // can take over again.
    if (dissolving && attractor.formation < 0.01) {
      attractor.recruitedDots.clear();
      attractor.targetPositions.clear();
    }
  }
}

/**
 * Hit-test a canvas-coordinate point against formed buttons. Only attractors
 * with `formation > 0.8` are clickable; partially formed buttons are
 * intentionally inert so users do not click ghosts.
 */
export function hitTestAttractor(
  attractors: NavAttractor[],
  x: number,
  y: number,
): NavAttractor | null {
  for (const a of attractors) {
    if (a.formation <= 0.8) continue;
    const halfW = a.width / 2;
    const halfH = a.height / 2;
    if (x >= a.cx - halfW && x <= a.cx + halfW && y >= a.cy - halfH && y <= a.cy + halfH) {
      return a;
    }
  }
  return null;
}
