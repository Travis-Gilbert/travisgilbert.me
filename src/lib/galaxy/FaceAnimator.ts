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

  for (let i = 0; i < tagged.length; i++) {
    const dot = tagged[i];
    const target = targets[dot.index];

    // Start from base position
    let y = dot.baseY;

    // Breathing: all face dots
    y += breathOffset;

    // Mouth displacement
    if (dot.region === 'mouth-upper') {
      y -= state.mouthOpen * 8;
    } else if (dot.region === 'mouth-lower') {
      y += state.mouthOpen * 12;
    }

    // Blink: squeeze eye dots toward the eye center Y in canvas space
    if ((dot.region === 'eye-left' || dot.region === 'eye-right') && dot.eyeCenterCanvasY !== undefined) {
      const pullStrength = state.blinkAmount * 0.85;
      y = y * (1 - pullStrength) + dot.eyeCenterCanvasY * pullStrength;
    }

    target.y = y;
    // X is not displaced (preserve horizontal position)
    target.x = dot.baseX;
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
  };
}
