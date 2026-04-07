/**
 * TheseusAvatar.ts
 *
 * Generates a geometric face density map for the stippling engine.
 * The face follows a 90s retro futuristic aesthetic (Tamagotchi, Happy Mac).
 *
 * Dark pixels produce high dot density. White pixels produce no dots.
 * The StipplingEngine uses rejection sampling where acceptance = 1 - brightness,
 * so darker regions accumulate more stipple dots.
 *
 * The visual canvas draws the face as dark shapes on a white ground.
 * The idMap canvas tags the entire face oval with a single unique color
 * so FaceAnimator can identify face dots after stippling.
 */

import type { OffscreenRenderResult, IdEntry } from './renderers/types';
import {
  createCanvasPair,
  indexToHex,
  OFFSCREEN_SIZE,
  uniformPhaseTemplate,
} from './renderers/types';

// ---------------------------------------------------------------------------
// Exported constants for FaceAnimator
// ---------------------------------------------------------------------------

/** Stable node ID for the face region in the idMap legend. */
export const FACE_NODE_ID = 'theseus-avatar-face';

/**
 * Mouth region in normalized coordinates (0 to 1), expressed as an ellipse.
 * FaceAnimator uses cx/cy/rx/ry for hit testing and split upper/lower.
 */
export const MOUTH_REGION = {
  cx: 0.50,
  cy: 0.62,
  rx: 0.18,
  ry: 0.04,
  /** Bounding rect helpers for rendering (x, y, width, height) */
  x: 0.32,
  y: 0.58,
  width: 0.36,
  height: 0.08,
} as const;

/**
 * Eye regions in normalized coordinates (0 to 1).
 * Keyed by 'left' and 'right' so FaceAnimator can iterate via Object.values
 * or access by name.
 */
export const EYE_REGIONS = {
  left: { cx: 0.36, cy: 0.40, rx: 0.08, ry: 0.07 },
  right: { cx: 0.64, cy: 0.40, rx: 0.08, ry: 0.07 },
} as const;

// ---------------------------------------------------------------------------
// Render options
// ---------------------------------------------------------------------------

export type FaceExpression =
  | 'sleep'
  | 'awake'
  | 'pondering'
  | 'curious'
  | 'contemplative';

export interface FaceRenderOptions {
  /** Mouth openness from 0 (closed) to 1 (fully open). Default 0. */
  mouthOpen?: number;
  /** Blink amount from 0 (eyes open) to 1 (eyes shut). Default 0. */
  blinkAmount?: number;
  /**
   * Expression:
   *   'sleep'         — chevron eyes, resting (deep idle / standby)
   *   'awake'         — open bracket eyes with centered pupils, neutral
   *                     smile. Default idle state.
   *   'pondering'     — SINGLE raised eyebrow over the left eye only,
   *                     otherwise neutral bracket eyes with centered
   *                     pupils and a thin straight mouth. Reads as the
   *                     classic "hmm, interesting — go on" one-eyebrow
   *                     cock. Used as the 3-second morph beat between
   *                     IDLE and THINKING so the user sees Theseus
   *                     register the question before the dissolve.
   *   'curious'       — BOTH eyebrows raised symmetrically, pupils
   *                     glanced slightly up, neutral mouth. Reads as
   *                     "huh, let me think about that." Wider-eyed
   *                     variant of pondering, reserved for future use
   *                     (e.g., when the query contains novel entities
   *                     Theseus hasn't seen before).
   *   'contemplative' — slightly narrowed eyes, centered small pupils,
   *                     no eyebrows, flat relaxed mouth. Reads as
   *                     "calm, working it through" — deep, quiet
   *                     thought. Reserved for long-wait states.
   */
  expression?: FaceExpression;
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render the Theseus avatar face as a density map for the stippling engine.
 *
 * Returns an OffscreenRenderResult with:
 *   visual: white background, face features drawn as dark regions
 *   idMap: entire face oval tagged with a single unique color
 *   idLegend: maps the face color to FACE_NODE_ID
 *   phaseTemplate: uniform 8x8 grid (all dots in phase 0)
 */
export function renderFace(options: FaceRenderOptions = {}): OffscreenRenderResult {
  const { mouthOpen = 0, blinkAmount = 0, expression = 'awake' } = options;
  const S = OFFSCREEN_SIZE;

  const { visual, visualCtx, idMap, idCtx } = createCanvasPair();

  // createCanvasPair fills both canvases with black.
  // The visual canvas needs a WHITE background so that regions outside the face
  // produce zero dots (brightness = 1 means acceptance = 0 in the engine).
  visualCtx.fillStyle = '#ffffff';
  visualCtx.fillRect(0, 0, S, S);

  // ------ Visual canvas: pixel grid face ------
  // All features are built from uniform square blocks on a grid,
  // like a retro CRT computer face. Each block is `b` pixels.

  const b = Math.round(S * 0.022); // block size (~11px on 512 canvas)
  visualCtx.fillStyle = '#000000';

  // Helper: draw a block at grid position (col, row) relative to an anchor
  const block = (anchorX: number, anchorY: number, col: number, row: number) => {
    visualCtx.fillRect(anchorX + col * b, anchorY + row * b, b, b);
  };

  // --- EYES ---
  // Left and right eyes are mirrored brackets with a floating pupil.
  // Left eye bracket opens to the right; right eye bracket opens to the left.
  const eyeKeys = ['left', 'right'] as const;
  for (const side of eyeKeys) {
    const eye = EYE_REGIONS[side];
    const ecx = Math.round(S * eye.cx);
    const ecy = Math.round(S * eye.cy);
    const ax = ecx - b * 3;
    const ay = ecy - b * 3;
    const isLeft = side === 'left';

    if (expression === 'sleep') {
      // Sleep: horizontal line (closed eyes)
      const sq = Math.max(1, Math.round((1 - blinkAmount * 0.85) * 3));
      for (let c = 0; c < 6; c++) block(ax, ay + sq, c, 0);
      block(ax, ay + sq - 1, 0, -1);
      block(ax, ay + sq - 1, 5, -1);
    } else if (expression === 'pondering') {
      // Pondering: ONE eyebrow cocked on the LEFT eye only. Right eye
      // is neutral. Pupils stay centered (no upward glance). Mouth
      // is a thin straight line (handled below). Reads as the
      // classic "hmm, interesting" one-eyebrow cock.

      const squeeze = Math.round(blinkAmount * 2);

      // Vertical bar (same spine as awake)
      const vCol1 = isLeft ? 0 : 4;
      const vCol2 = isLeft ? 1 : 5;
      for (let r = squeeze; r < 5 - squeeze; r++) block(ax, ay, vCol1, r);
      for (let r = squeeze; r < 5 - squeeze; r++) block(ax, ay, vCol2, r);

      // Top horizontal bar
      block(ax, ay, 2, squeeze);
      block(ax, ay, 3, squeeze);

      // Bottom horizontal bar
      block(ax, ay, 2, 4 - squeeze);
      block(ax, ay, 3, 4 - squeeze);

      // Pupil: 2x2 block, centered (rows 2-3, same as awake)
      if (blinkAmount < 0.7) {
        const pCol = isLeft ? 3 : 1;
        block(ax, ay, pCol, 2);
        block(ax, ay, pCol + 1, 2);
        block(ax, ay, pCol, 3);
        block(ax, ay, pCol + 1, 3);
      }

      // ONLY the left eye gets an eyebrow, raised and tilted outward.
      // The asymmetry is what makes this read as a cocked brow rather
      // than "both brows up" (which is the 'curious' expression).
      if (isLeft) {
        // Four-block-wide brow at row -2. Outer end slightly higher
        // for a rakish cocked-brow tilt.
        //     ##
        //  ## ## ##
        block(ax, ay, 0, -2);
        block(ax, ay, 1, -2);
        block(ax, ay, 2, -2);
        block(ax, ay, 3, -2);
        // Outer lift on the far end
        block(ax, ay, 0, -3);
      }
    } else if (expression === 'curious') {
      // Curious: BOTH eyebrows raised, pupils glanced up by 1 row,
      // neutral mouth (handled below). Wider-eyed variant of
      // pondering. Reserved for future use.

      const squeeze = Math.round(blinkAmount * 2);

      const vCol1 = isLeft ? 0 : 4;
      const vCol2 = isLeft ? 1 : 5;
      for (let r = squeeze; r < 5 - squeeze; r++) block(ax, ay, vCol1, r);
      for (let r = squeeze; r < 5 - squeeze; r++) block(ax, ay, vCol2, r);

      block(ax, ay, 2, squeeze);
      block(ax, ay, 3, squeeze);
      block(ax, ay, 2, 4 - squeeze);
      block(ax, ay, 3, 4 - squeeze);

      // Pupils raised one row
      if (blinkAmount < 0.7) {
        const pCol = isLeft ? 3 : 1;
        block(ax, ay, pCol, 1);
        block(ax, ay, pCol + 1, 1);
        block(ax, ay, pCol, 2);
        block(ax, ay, pCol + 1, 2);
      }

      // Both eyebrows: tilted inward-higher (inner end of the brow
      // 1 block higher than outer).
      const browInnerCol = isLeft ? 4 : 1;
      const browOuterStart = isLeft ? 0 : 2;
      for (let c = 0; c < 3; c++) block(ax, ay, browOuterStart + c, -2);
      block(ax, ay, browInnerCol, -3);
    } else if (expression === 'contemplative') {
      // Contemplative: narrowed eyes (+1 squeeze), no eyebrows,
      // smaller 1x1 pupils, flat relaxed mouth (handled below).
      // Reads as "calm, working it through." Deep quiet thought.

      // Force an extra squeeze on top of any blink to narrow the eyes.
      const squeeze = Math.round(blinkAmount * 2) + 1;

      // Shortened vertical bars (narrow eye)
      const vCol1 = isLeft ? 0 : 4;
      const vCol2 = isLeft ? 1 : 5;
      for (let r = squeeze; r < 5 - squeeze; r++) block(ax, ay, vCol1, r);
      for (let r = squeeze; r < 5 - squeeze; r++) block(ax, ay, vCol2, r);

      block(ax, ay, 2, squeeze);
      block(ax, ay, 3, squeeze);
      block(ax, ay, 2, 4 - squeeze);
      block(ax, ay, 3, 4 - squeeze);

      // Small centered pupil: single 1x1 block instead of 2x2.
      if (blinkAmount < 0.7) {
        const pCol = isLeft ? 3 : 1;
        block(ax, ay, pCol, 2);
      }
      // No eyebrows.
    } else {
      // Awake: mirrored bracket eyes
      //
      // Left eye:        Right eye:
      //  ####                ####
      //  ##                    ##
      //  ##  ##          ##  ##
      //  ##                    ##
      //  ####                ####

      const squeeze = Math.round(blinkAmount * 2);

      // Vertical bar (the spine of the bracket)
      const vCol1 = isLeft ? 0 : 4;
      const vCol2 = isLeft ? 1 : 5;
      for (let r = squeeze; r < 5 - squeeze; r++) block(ax, ay, vCol1, r);
      for (let r = squeeze; r < 5 - squeeze; r++) block(ax, ay, vCol2, r);

      // Top horizontal bar (extends inward from the spine)
      const hCol1 = isLeft ? 2 : 2;
      const hCol2 = isLeft ? 3 : 3;
      block(ax, ay, hCol1, squeeze);
      block(ax, ay, hCol2, squeeze);

      // Bottom horizontal bar
      block(ax, ay, hCol1, 4 - squeeze);
      block(ax, ay, hCol2, 4 - squeeze);

      // Pupil: 2x2 block on the open side of the bracket
      if (blinkAmount < 0.7) {
        const pCol = isLeft ? 3 : 1;
        block(ax, ay, pCol, 2);
        block(ax, ay, pCol + 1, 2);
        block(ax, ay, pCol, 3);
        block(ax, ay, pCol + 1, 3);
      }
    }
  }

  // --- MOUTH ---
  const mx = Math.round(S * MOUTH_REGION.cx);
  const my = Math.round(S * MOUTH_REGION.cy);
  const mAx = mx - b * 6; // anchor: 12 blocks wide
  const mAy = my - b * 2; // anchor: vertically centered
  const openRows = Math.round(mouthOpen * 3);

  if (expression === 'pondering' || expression === 'curious' || expression === 'contemplative') {
    // Thin straight horizontal line for all three thinking expressions.
    // No smile pillars, no curve. Reads as neutral / contemplative.
    // Sits at the same vertical position as the awake smile's bottom
    // bar so the transition between expressions doesn't shift the
    // mouth up or down.
    for (let c = 2; c < 10; c++) block(mAx, mAy, c, 3);
  } else {
    // Awake (and sleep) default: happy pixel smile, steep U shape.
    //
    //  #              #
    //  #              #
    //   #            #
    //    ############
    //

    // Left vertical pillar (2 blocks tall)
    block(mAx, mAy, 0, 0);
    block(mAx, mAy, 0, 1);

    // Left step down
    block(mAx, mAy, 1, 2);

    // Bottom horizontal bar (8 blocks wide)
    for (let c = 2; c < 10; c++) block(mAx, mAy, c, 3 + openRows);

    // Right step down
    block(mAx, mAy, 10, 2);

    // Right vertical pillar
    block(mAx, mAy, 11, 0);
    block(mAx, mAy, 11, 1);

    // When mouth is open, add vertical bars connecting pillars to bottom
    if (openRows > 0) {
      for (let r = 3; r < 3 + openRows; r++) {
        block(mAx, mAy, 1, r);
        block(mAx, mAy, 10, r);
      }
    }
  }

  // ------ ID map canvas: tag eye and mouth regions ------

  const faceHex = indexToHex(0);
  idCtx.fillStyle = faceHex;

  // Tag eye regions (slightly larger than visual to capture nearby dots)
  for (const eye of Object.values(EYE_REGIONS)) {
    idCtx.beginPath();
    idCtx.ellipse(S * eye.cx, S * eye.cy, S * eye.rx * 1.4, S * eye.ry * 1.4, 0, 0, Math.PI * 2);
    idCtx.fill();
  }

  // Tag mouth region
  idCtx.beginPath();
  idCtx.ellipse(S * MOUTH_REGION.cx, S * MOUTH_REGION.cy, S * MOUTH_REGION.rx * 1.3, S * MOUTH_REGION.ry * 2.5, 0, 0, Math.PI * 2);
  idCtx.fill();

  // Build legend
  const idLegend = new Map<string, IdEntry>();
  idLegend.set(faceHex, { nodeId: FACE_NODE_ID });

  // Phase template: uniform (all dots reveal together)
  const phaseTemplate = uniformPhaseTemplate(8);

  return { visual, idMap, idLegend, phaseTemplate };
}
