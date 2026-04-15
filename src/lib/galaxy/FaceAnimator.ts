/**
 * FaceAnimator.ts
 *
 * Post-stipple animation of face dots: breathing, blink, and mouth movement.
 * This module does NOT re-run the stippling engine. It directly displaces
 * tagged dot Y positions in the render loop for zero-allocation animation.
 *
 * Usage:
 *   1. After stippling, call tagFaceDots() once to classify face region dots
 *   2. Each frame, call tickIdleAnimation() to advance timers
 *   3. Each frame, call animateFaceDots() to mutate target positions in place
 */

import type { StippleTarget } from './StipplingEngine';
import { MOUTH_REGION, EYE_REGIONS, FACE_NODE_ID } from './TheseusAvatar';

// ---------------------------------------------------------------------------
// Expression system
// ---------------------------------------------------------------------------

/**
 * Expression parameters. Every expression is a point in this small parameter
 * space. Transitions between expressions are linear interpolations between
 * two parameter sets, applied to the already-tagged face dots via the same
 * displacement pass that handles breathing and blinking. No restippling,
 * no Lloyd relaxation per expression, no loss of dot identity.
 *
 * Conventions:
 *   browTiltL / browTiltR  0 = flat, 1 = raised ~6px. Negative = lowered.
 *   eyeShift               -1 = look left, 1 = look right (displaces eye dots horizontally).
 *   mouthSmile             -1 = frown, 0 = neutral, 1 = smile (curves lower lip corners).
 *   eyeNarrow              0 = open, 1 = squinted (persistent vertical squeeze, distinct
 *                          from blinkAmount which is a brief triangle-wave pulse).
 */
export interface FaceExpressionParams {
  browTiltL: number;
  browTiltR: number;
  eyeShift: number;
  mouthSmile: number;
  eyeNarrow: number;
}

export type FaceExpressionName =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'found'
  | 'done'
  | 'pondering'
  | 'curious';

export const EXPRESSION_PRESETS: Record<FaceExpressionName, FaceExpressionParams> = {
  idle:       { browTiltL: 0.0, browTiltR: 0.0, eyeShift:  0.0, mouthSmile:  0.0, eyeNarrow: 0.0 },
  thinking:   { browTiltL: 0.4, browTiltR: 0.0, eyeShift: -0.2, mouthSmile: -0.15, eyeNarrow: 0.3 },
  working:    { browTiltL: 0.3, browTiltR: 0.3, eyeShift:  0.0, mouthSmile:  0.0, eyeNarrow: 0.5 },
  found:      { browTiltL: 0.8, browTiltR: 0.8, eyeShift:  0.0, mouthSmile:  0.6, eyeNarrow: 0.0 },
  done:       { browTiltL: 0.0, browTiltR: 0.0, eyeShift:  0.0, mouthSmile:  0.5, eyeNarrow: 0.0 },
  pondering:  { browTiltL: 1.0, browTiltR: 0.0, eyeShift:  0.0, mouthSmile:  0.0, eyeNarrow: 0.0 },
  curious:    { browTiltL: 1.0, browTiltR: 1.0, eyeShift:  0.0, mouthSmile:  0.0, eyeNarrow: 0.0 },
};

/** Default transition duration between expressions (ms). Tuned for natural feel. */
export const EXPRESSION_TRANSITION_MS = 500;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function lerpExpression(
  a: FaceExpressionParams,
  b: FaceExpressionParams,
  rawT: number,
): FaceExpressionParams {
  const t = Math.max(0, Math.min(1, rawT));
  const eased = easeOutCubic(t);
  return {
    browTiltL: lerp(a.browTiltL, b.browTiltL, eased),
    browTiltR: lerp(a.browTiltR, b.browTiltR, eased),
    eyeShift:  lerp(a.eyeShift,  b.eyeShift,  eased),
    mouthSmile: lerp(a.mouthSmile, b.mouthSmile, eased),
    eyeNarrow: lerp(a.eyeNarrow, b.eyeNarrow, eased),
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaggedDot {
  /** Index into the StippleTarget[] array */
  index: number;
  /** Which face region this dot belongs to */
  region: 'mouth-upper' | 'mouth-lower' | 'eye-left' | 'eye-right' | 'face';
  /** Original X position (before any animation displacement) */
  baseX: number;
  /** Original Y position (before any animation displacement) */
  baseY: number;
  /** Eye center Y in canvas coords (only set for eye dots) */
  eyeCenterCanvasY?: number;
}

export interface FaceAnimationState {
  /** 0 = closed, 1 = fully open */
  mouthOpen: number;
  /** 0 = eyes open, 1 = eyes fully closed */
  blinkAmount: number;
  /** Sine phase for breathing oscillation (radians) */
  breathPhase: number;
  /**
   * Active expression parameters. At rest this matches an EXPRESSION_PRESET.
   * During a transition it's an interpolation (owner computes via
   * lerpExpression and writes the result each frame). Optional so existing
   * call sites that only use breathing/blink/mouthOpen don't break.
   */
  expression?: FaceExpressionParams;
}

export interface BlinkTimer {
  /** Timestamp (ms) when the next blink should start */
  nextBlink: number;
  /** Whether a blink is currently in progress */
  blinking: boolean;
  /** Timestamp (ms) when the current blink started */
  blinkStart: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Breathing cycle period in milliseconds (4 seconds) */
const BREATH_PERIOD_MS = 4000;

/** Blink duration in milliseconds */
const BLINK_DURATION_MS = 200;

/** Minimum interval between blinks (ms) */
const BLINK_MIN_INTERVAL_MS = 4000;

/** Maximum interval between blinks (ms) */
const BLINK_MAX_INTERVAL_MS = 8000;

// ---------------------------------------------------------------------------
// tagFaceDots
// ---------------------------------------------------------------------------

/**
 * Classify stipple targets that belong to the Theseus face into
 * tagged regions (mouth upper/lower, eye left/right, or general face).
 *
 * Call this once after stippling completes. The returned TaggedDot array
 * is reused every frame by animateFaceDots().
 */
export function tagFaceDots(
  targets: StippleTarget[],
  canvasWidth: number,
  canvasHeight: number,
): TaggedDot[] {
  const tagged: TaggedDot[] = [];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t.nodeId !== FACE_NODE_ID) continue;

    // Normalize position to 0..1 range
    const nx = canvasWidth > 0 ? t.x / canvasWidth : 0;
    const ny = canvasHeight > 0 ? t.y / canvasHeight : 0;

    let region: TaggedDot['region'] = 'face';

    // Check eye regions (ellipse hit test per eye)
    {
      const ldx = (nx - EYE_REGIONS.left.cx) / EYE_REGIONS.left.rx;
      const ldy = (ny - EYE_REGIONS.left.cy) / EYE_REGIONS.left.ry;
      if (ldx * ldx + ldy * ldy <= 1) {
        region = 'eye-left';
      } else {
        const rdx = (nx - EYE_REGIONS.right.cx) / EYE_REGIONS.right.rx;
        const rdy = (ny - EYE_REGIONS.right.cy) / EYE_REGIONS.right.ry;
        if (rdx * rdx + rdy * rdy <= 1) {
          region = 'eye-right';
        }
      }
    }

    // Check mouth region (ellipse hit test, split upper/lower at center Y)
    if (region === 'face') {
      const dx = (nx - MOUTH_REGION.cx) / MOUTH_REGION.rx;
      const dy = (ny - MOUTH_REGION.cy) / MOUTH_REGION.ry;
      if (dx * dx + dy * dy <= 1) {
        region = ny < MOUTH_REGION.cy ? 'mouth-upper' : 'mouth-lower';
      }
    }

    const eyeCenter = region === 'eye-left'
      ? EYE_REGIONS.left.cy * canvasHeight
      : region === 'eye-right'
        ? EYE_REGIONS.right.cy * canvasHeight
        : undefined;

    tagged.push({
      index: i,
      region,
      baseX: t.x,
      baseY: t.y,
      eyeCenterCanvasY: eyeCenter,
    });
  }

  return tagged;
}

// ---------------------------------------------------------------------------
// animateFaceDots
// ---------------------------------------------------------------------------

/**
 * Mutate stipple target positions in place based on current animation state.
 * Zero allocation per frame. Restores base positions then applies displacement.
 *
 * Displacement effects:
 *   - Breathing: all face dots shift vertically by sin(breathPhase) * 1.5
 *   - Mouth: upper lip dots displaced up by mouthOpen * 8,
 *            lower lip dots displaced down by mouthOpen * 12
 *   - Blink: eye dots squeezed toward eye center Y by blinkAmount * 0.8
 */
export function animateFaceDots(
  targets: StippleTarget[],
  tagged: TaggedDot[],
  state: FaceAnimationState,
): void {
  const breathOffset = Math.sin(state.breathPhase) * 1.5;
  const expr = state.expression;

  // Mouth center X in canvas coords (used for smile curve). Derived once so
  // the inner loop stays allocation-free.
  let mouthCenterX = 0;
  let mouthSpanX = 1;
  if (expr && expr.mouthSmile !== 0) {
    // Find the average baseX of mouth dots as a cheap center-of-mass.
    // In practice the stippler places mouth dots symmetrically so the
    // mean closely matches MOUTH_REGION.cx in canvas space.
    let sum = 0;
    let count = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < tagged.length; i++) {
      const t = tagged[i];
      if (t.region === 'mouth-upper' || t.region === 'mouth-lower') {
        sum += t.baseX;
        count++;
        if (t.baseX < minX) minX = t.baseX;
        if (t.baseX > maxX) maxX = t.baseX;
      }
    }
    if (count > 0) {
      mouthCenterX = sum / count;
      mouthSpanX = Math.max(1, (maxX - minX) / 2);
    }
  }

  for (let i = 0; i < tagged.length; i++) {
    const dot = tagged[i];
    const target = targets[dot.index];

    // Start from base position
    let x = dot.baseX;
    let y = dot.baseY;

    // Breathing: all face dots
    y += breathOffset;

    // Mouth openness (legacy channel for VU meter / speaking).
    if (dot.region === 'mouth-upper') {
      y -= state.mouthOpen * 8;
    } else if (dot.region === 'mouth-lower') {
      y += state.mouthOpen * 12;
    }

    // Blink: squeeze eye dots toward the eye center Y in canvas space.
    if ((dot.region === 'eye-left' || dot.region === 'eye-right') && dot.eyeCenterCanvasY !== undefined) {
      const pullStrength = state.blinkAmount * 0.85;
      y = y * (1 - pullStrength) + dot.eyeCenterCanvasY * pullStrength;
    }

    // Expression parameters: applied as additional displacements so dot
    // identity is preserved across transitions. An expression change is a
    // parameter lerp; animateFaceDots reads the current parameter vector
    // and moves each dot accordingly. No restippling.
    if (expr) {
      const isEyeLeft = dot.region === 'eye-left';
      const isEyeRight = dot.region === 'eye-right';
      const isEye = isEyeLeft || isEyeRight;

      // Horizontal glance: shift eye dots left/right.
      if (isEye && expr.eyeShift !== 0) {
        x += expr.eyeShift * 4;
      }

      // Brow tilt: for each eye, lift the upper half of that eye's dots.
      // "Upper half" = baseY above the eye center.
      if (isEye && dot.eyeCenterCanvasY !== undefined) {
        const isUpperHalf = dot.baseY < dot.eyeCenterCanvasY;
        if (isUpperHalf) {
          const tilt = isEyeLeft ? expr.browTiltL : expr.browTiltR;
          y -= tilt * 6;
        }
      }

      // Persistent eye-narrow: like blink but held. Additive on top of blink.
      if (isEye && dot.eyeCenterCanvasY !== undefined && expr.eyeNarrow > 0) {
        const narrow = expr.eyeNarrow * 0.35;
        y = y * (1 - narrow) + dot.eyeCenterCanvasY * narrow;
      }

      // Smile curve: lower-lip dots near the mouth corners lift (positive
      // smile) or drop (negative frown). Center stays near neutral. Using
      // |dx| normalized to mouthSpanX so the curve scales with mouth width.
      if (dot.region === 'mouth-lower' && expr.mouthSmile !== 0) {
        const dx = Math.abs(dot.baseX - mouthCenterX) / mouthSpanX;
        y -= expr.mouthSmile * dx * dx * 4;
      } else if (dot.region === 'mouth-upper' && expr.mouthSmile !== 0) {
        // Upper lip tracks subtly to keep the shape coherent.
        const dx = Math.abs(dot.baseX - mouthCenterX) / mouthSpanX;
        y -= expr.mouthSmile * dx * dx * 1.5;
      }
    }

    target.x = x;
    target.y = y;
  }
}

// ---------------------------------------------------------------------------
// tickIdleAnimation
// ---------------------------------------------------------------------------

/**
 * Advance the idle animation state by deltaMs.
 *
 * Updates:
 *   - breathPhase: continuous sine wave with a 4 second period
 *   - blinkAmount: randomized blinks (200ms triangle wave, 4 to 8 second interval)
 *
 * Returns a new FaceAnimationState (does not mutate the input).
 */
export function tickIdleAnimation(
  state: FaceAnimationState,
  deltaMs: number,
  blinkTimer: BlinkTimer,
): FaceAnimationState {
  // Advance breathing phase
  const breathPhase =
    state.breathPhase + (deltaMs / BREATH_PERIOD_MS) * Math.PI * 2;

  // Blink logic
  let blinkAmount = 0;
  const now = performance.now();

  if (blinkTimer.blinking) {
    const elapsed = now - blinkTimer.blinkStart;
    if (elapsed >= BLINK_DURATION_MS) {
      // Blink complete
      blinkTimer.blinking = false;
      blinkTimer.nextBlink =
        now +
        BLINK_MIN_INTERVAL_MS +
        Math.random() * (BLINK_MAX_INTERVAL_MS - BLINK_MIN_INTERVAL_MS);
      blinkAmount = 0;
    } else {
      // Triangle wave: ramp up first half, ramp down second half
      const t = elapsed / BLINK_DURATION_MS;
      blinkAmount = t < 0.5 ? t * 2 : (1 - t) * 2;
    }
  } else if (now >= blinkTimer.nextBlink) {
    // Start a new blink
    blinkTimer.blinking = true;
    blinkTimer.blinkStart = now;
    blinkAmount = 0;
  }

  return {
    mouthOpen: state.mouthOpen,
    blinkAmount,
    breathPhase,
    expression: state.expression,
  };
}
