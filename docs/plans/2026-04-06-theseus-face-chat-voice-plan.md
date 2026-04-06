# Theseus Face, Chat, and Voice: Implementation Plan

> **For Claude:** REQUIRED: Use /execute-plan to implement this plan task-by-task.

**Goal:** Add a stippled face as the galaxy idle state, a spatially-anchored conversation surface on the galaxy canvas, and bidirectional voice with sentence-level TTS streaming to the /ask page.

**Architecture:** The face is a density map rendered through the existing StipplingEngine pipeline (same dots, different target). Short responses render inline on the canvas via pretext; long responses bloom into DOM-backed spatial panels anchored to node positions. Voice uses Deepgram Nova-3 (browser-direct after token exchange) for STT and Cartesia Sonic (sentence-level streaming) for TTS, with AnalyserNode feeding mouth animation.

**Tech Stack:** Next.js 16, React 19, @chenglou/pretext, d3-delaunay, Web Audio API, Deepgram SDK, Cartesia API, assistant-ui primitives (ThreadPrimitive, ComposerPrimitive, MessagePrimitive)

**Design doc:** `docs/plans/2026-04-06-theseus-face-chat-voice.md`

---

## Phase 1: The Face (Idle State)

### Task 1: TheseusAvatar density map generator

**Files:**
- Create: `src/lib/galaxy/TheseusAvatar.ts`
- Reference: `src/lib/galaxy/renderers/types.ts` (OffscreenRenderResult, createCanvasPair, OFFSCREEN_SIZE, uniformPhaseTemplate)

**Context:** The face is a grayscale density map drawn on an OffscreenCanvas. Dark regions = more dots cluster there via stippling. The map uses the same `OffscreenRenderResult` interface as all other renderers so the StipplingEngine can consume it without changes.

**Step 1: Write the module**

```typescript
// src/lib/galaxy/TheseusAvatar.ts
//
// Generates a geometric face density map for the stippling engine.
// The face is 90s retro-futuristic: Tamagotchi/Happy Mac aesthetic.
// Dark pixels = high dot density. White pixels = no dots (ambient grid).

import { createCanvasPair, uniformPhaseTemplate, OFFSCREEN_SIZE } from './renderers/types';
import type { OffscreenRenderResult } from './renderers/types';

const FACE_ID = 'theseus-face';

/** Face feature relative coordinates (0-1 normalized) */
const FACE = {
  // Oval silhouette
  cx: 0.5,
  cy: 0.48,
  rx: 0.28,
  ry: 0.38,

  // Eyes
  eyeY: 0.38,
  eyeSpacing: 0.10,
  eyeRx: 0.045,
  eyeRy: 0.035,

  // Nose
  noseY: 0.50,
  noseWidth: 0.015,
  noseHeight: 0.06,

  // Mouth
  mouthY: 0.62,
  mouthWidth: 0.12,
  mouthHeight: 0.012,
} as const;

export interface AvatarOptions {
  /** Mouth openness 0-1 for speech animation. 0 = closed line. */
  mouthOpen?: number;
  /** Eye squeeze 0-1 for blink animation. 1 = fully closed. */
  blinkAmount?: number;
}

/**
 * Render the Theseus face density map.
 *
 * Returns an OffscreenRenderResult compatible with StipplingEngine.
 * The visual canvas contains grayscale brightness (dark = dense dots).
 * The idMap tags the entire face region with a single FACE_ID so
 * FaceAnimator can identify face dots post-stipple.
 */
export function renderFace(options: AvatarOptions = {}): OffscreenRenderResult {
  const { mouthOpen = 0, blinkAmount = 0 } = options;
  const S = OFFSCREEN_SIZE;
  const { visual, visualCtx, idMap, idCtx } = createCanvasPair();

  // Both canvases start black (from createCanvasPair).
  // We draw the face features as bright-on-dark for the visual canvas
  // (stippling treats dark = more dots, but we INVERT: face features
  // should attract dots, so we draw them as WHITE on BLACK visual canvas,
  // then the stippling engine's (1 - brightness) weighting puts dots
  // on the dark background. Wait: we want dots ON the face features.
  // StipplingEngine: dark pixels = more dots. So face features = dark.
  // Background (no face) = bright/white = fewer dots.
  //
  // Strategy: fill visual canvas WHITE, then draw face features as DARK.

  visualCtx.fillStyle = '#ffffff';
  visualCtx.fillRect(0, 0, S, S);

  // Draw face features as dark regions (will attract dots)
  const drawOval = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number, cy: number, rx: number, ry: number, fill: string,
  ) => {
    ctx.beginPath();
    ctx.ellipse(cx * S, cy * S, rx * S, ry * S, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };

  // Jawline/silhouette: medium gray (moderate dot density at edges)
  drawOval(visualCtx, FACE.cx, FACE.cy, FACE.rx, FACE.ry, '#666666');

  // Interior fill: lighter (sparse dots inside face, denser at features)
  drawOval(visualCtx, FACE.cx, FACE.cy, FACE.rx * 0.85, FACE.ry * 0.85, '#aaaaaa');

  // Eyes: dark circles (high dot density)
  const eyeRy = FACE.eyeRy * (1 - blinkAmount * 0.8);
  drawOval(visualCtx, FACE.cx - FACE.eyeSpacing, FACE.eyeY, FACE.eyeRx, eyeRy, '#222222');
  drawOval(visualCtx, FACE.cx + FACE.eyeSpacing, FACE.eyeY, FACE.eyeRx, eyeRy, '#222222');

  // Nose bridge: subtle dark line
  visualCtx.fillStyle = '#555555';
  visualCtx.fillRect(
    (FACE.cx - FACE.noseWidth / 2) * S,
    (FACE.noseY - FACE.noseHeight / 2) * S,
    FACE.noseWidth * S,
    FACE.noseHeight * S,
  );

  // Mouth: horizontal band, height scales with openness
  const mouthHeight = FACE.mouthHeight + mouthOpen * 0.04;
  const mouthY = FACE.mouthY - mouthOpen * 0.01;
  visualCtx.beginPath();
  visualCtx.ellipse(
    FACE.cx * S,
    mouthY * S,
    FACE.mouthWidth * S,
    mouthHeight * S,
    0, 0, Math.PI * 2,
  );
  visualCtx.fillStyle = '#333333';
  visualCtx.fill();

  // ID map: tag entire face oval so FaceAnimator can identify face dots
  idCtx.beginPath();
  idCtx.ellipse(FACE.cx * S, FACE.cy * S, FACE.rx * S, FACE.ry * S, 0, 0, Math.PI * 2);
  idCtx.fillStyle = '#000001'; // unique non-black color
  idCtx.fill();

  const idLegend = new Map([['#000001', { nodeId: FACE_ID }]]);

  return {
    visual,
    idMap,
    idLegend,
    phaseTemplate: uniformPhaseTemplate(8),
  };
}

/** Normalized coordinates for the mouth region (for FaceAnimator tagging) */
export const MOUTH_REGION = {
  cx: FACE.cx,
  cy: FACE.mouthY,
  rx: FACE.mouthWidth * 1.3,
  ry: 0.05,
} as const;

/** Normalized coordinates for each eye (for blink animation) */
export const EYE_REGIONS = [
  { cx: FACE.cx - FACE.eyeSpacing, cy: FACE.eyeY, rx: FACE.eyeRx * 1.5, ry: FACE.eyeRy * 2 },
  { cx: FACE.cx + FACE.eyeSpacing, cy: FACE.eyeY, rx: FACE.eyeRx * 1.5, ry: FACE.eyeRy * 2 },
] as const;

export const FACE_NODE_ID = FACE_ID;
```

**Step 2: Verify it produces a valid OffscreenRenderResult**

Run: `npx tsc --noEmit src/lib/galaxy/TheseusAvatar.ts`
Expected: No type errors. The return type matches `OffscreenRenderResult`.

**Step 3: Commit**

```bash
git add src/lib/galaxy/TheseusAvatar.ts
git commit -m "feat(galaxy): TheseusAvatar density map generator for stippled face"
```

---

### Task 2: FaceAnimator (breathing, blink, mouth)

**Files:**
- Create: `src/lib/galaxy/FaceAnimator.ts`
- Reference: `src/lib/galaxy/TheseusAvatar.ts` (MOUTH_REGION, EYE_REGIONS, FACE_NODE_ID)
- Reference: `src/lib/galaxy/StipplingEngine.ts` (StippleTarget interface)

**Context:** After stippling produces face dots, FaceAnimator tags mouth/eye dots and animates them per-frame. It does NOT re-run stippling. It directly displaces tagged dot Y positions in the render loop.

**Step 1: Write the module**

```typescript
// src/lib/galaxy/FaceAnimator.ts
//
// Post-stipple animation controller for the Theseus face.
// Tags dots in mouth/eye regions, then displaces their positions
// per-frame for breathing, blink, and speech mouth animation.
// Does NOT re-run the stippling engine.

import type { StippleTarget } from './StipplingEngine';
import { MOUTH_REGION, EYE_REGIONS, FACE_NODE_ID } from './TheseusAvatar';

export interface FaceAnimationState {
  /** 0-1 mouth openness from TTS amplitude */
  mouthOpen: number;
  /** 0-1 eye squeeze (1 = fully closed blink) */
  blinkAmount: number;
  /** Breathing phase in radians (incremented by caller) */
  breathPhase: number;
}

interface TaggedDot {
  index: number;
  region: 'mouth-upper' | 'mouth-lower' | 'eye-left' | 'eye-right' | 'face';
  baseX: number;
  baseY: number;
}

/**
 * Tag stipple targets that belong to face regions.
 * Call once after stippling completes. Returns tagged dot metadata
 * that FaceAnimator uses for per-frame displacement.
 *
 * @param targets - StippleTarget[] from the stippling engine
 * @param canvasWidth - Viewport canvas width (targets are in viewport coords)
 * @param canvasHeight - Viewport canvas height
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

    // Normalize to 0-1
    const nx = t.x / canvasWidth;
    const ny = t.y / canvasHeight;

    // Check mouth region
    const mDx = (nx - MOUTH_REGION.cx) / MOUTH_REGION.rx;
    const mDy = (ny - MOUTH_REGION.cy) / MOUTH_REGION.ry;
    if (mDx * mDx + mDy * mDy <= 1) {
      tagged.push({
        index: i,
        region: ny < MOUTH_REGION.cy ? 'mouth-upper' : 'mouth-lower',
        baseX: t.x,
        baseY: t.y,
      });
      continue;
    }

    // Check eye regions
    let isEye = false;
    for (let e = 0; e < EYE_REGIONS.length; e++) {
      const eye = EYE_REGIONS[e];
      const eDx = (nx - eye.cx) / eye.rx;
      const eDy = (ny - eye.cy) / eye.ry;
      if (eDx * eDx + eDy * eDy <= 1) {
        tagged.push({
          index: i,
          region: e === 0 ? 'eye-left' : 'eye-right',
          baseX: t.x,
          baseY: t.y,
        });
        isEye = true;
        break;
      }
    }

    if (!isEye) {
      tagged.push({ index: i, region: 'face', baseX: t.x, baseY: t.y });
    }
  }

  return tagged;
}

/**
 * Apply per-frame displacement to face dots.
 * Mutates the targets array in place for zero allocation.
 *
 * @param targets - The live StippleTarget array being rendered
 * @param tagged - Tagged dot metadata from tagFaceDots
 * @param state - Current animation state (mouth, blink, breathing)
 */
export function animateFaceDots(
  targets: StippleTarget[],
  tagged: TaggedDot[],
  state: FaceAnimationState,
): void {
  const breathOffset = Math.sin(state.breathPhase) * 1.5;

  for (const dot of tagged) {
    const t = targets[dot.index];
    if (!t) continue;

    // Breathing: subtle vertical sine wave on all face dots
    let dy = breathOffset;

    // Mouth animation
    if (dot.region === 'mouth-upper') {
      dy -= state.mouthOpen * 8;
    } else if (dot.region === 'mouth-lower') {
      dy += state.mouthOpen * 12;
    }

    // Blink animation: squeeze eye dots toward eye center Y
    if (dot.region === 'eye-left' || dot.region === 'eye-right') {
      const eyeIdx = dot.region === 'eye-left' ? 0 : 1;
      const eyeCenterY = EYE_REGIONS[eyeIdx].cy;
      // During blink, pull toward center
      const pullStrength = state.blinkAmount * 0.8;
      // eyeCenterY is normalized; convert to canvas coords
      // We stored baseY in canvas coords, so we need canvas height.
      // Instead, just compress the offset from base:
      dy += (dot.baseY - t.y) * pullStrength * -0.5;
    }

    t.x = dot.baseX;
    t.y = dot.baseY + dy;
  }
}

/**
 * Idle animation tick. Call from requestAnimationFrame.
 * Returns updated state with breathing and randomized blinks.
 */
export function tickIdleAnimation(
  state: FaceAnimationState,
  deltaMs: number,
  blinkTimer: { nextBlink: number; blinking: boolean; blinkStart: number },
): FaceAnimationState {
  const BREATH_SPEED = (2 * Math.PI) / 4000; // 4 second period
  const BLINK_DURATION = 200;
  const BLINK_MIN_INTERVAL = 4000;
  const BLINK_MAX_INTERVAL = 8000;

  const breathPhase = state.breathPhase + BREATH_SPEED * deltaMs;

  // Blink logic
  let blinkAmount = 0;
  const now = performance.now();

  if (blinkTimer.blinking) {
    const elapsed = now - blinkTimer.blinkStart;
    if (elapsed < BLINK_DURATION) {
      // Triangle wave: ramp up then down
      const t = elapsed / BLINK_DURATION;
      blinkAmount = t < 0.5 ? t * 2 : (1 - t) * 2;
    } else {
      blinkTimer.blinking = false;
      blinkTimer.nextBlink = now + BLINK_MIN_INTERVAL + Math.random() * (BLINK_MAX_INTERVAL - BLINK_MIN_INTERVAL);
    }
  } else if (now >= blinkTimer.nextBlink) {
    blinkTimer.blinking = true;
    blinkTimer.blinkStart = now;
    blinkAmount = 0;
  }

  return { ...state, breathPhase, blinkAmount };
}
```

**Step 2: Type check**

Run: `npx tsc --noEmit src/lib/galaxy/FaceAnimator.ts`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/lib/galaxy/FaceAnimator.ts
git commit -m "feat(galaxy): FaceAnimator for breathing, blink, and mouth animation"
```

---

### Task 3: Wire face as StipplingDirector idle target

**Files:**
- Modify: `src/lib/galaxy/StipplingDirector.ts` (add face mode)
- Reference: `src/lib/galaxy/TheseusAvatar.ts` (renderFace)
- Reference: `src/lib/galaxy/StipplingEngine.ts` (stipple function)

**Context:** The StipplingDirector currently only handles answer-mode stippling (from SceneDirective). We add a `stippleFace()` convenience function that renders the face density map and runs the stippling engine, returning targets ready for DotGrid consumption.

**Step 1: Add the face stipple function to StipplingDirector.ts**

Add at the end of the file, after the `identifyLoadBearingDots` function:

```typescript
// ---------------------------------------------------------------------------
// Face Idle Mode
// ---------------------------------------------------------------------------

import { renderFace } from './TheseusAvatar';
import { stipple } from './StipplingEngine';
import type { StippleResult } from './StipplingEngine';

const FACE_DOT_COUNT = 4000;

export interface FaceStippleOptions {
  /** Viewport width for output coordinate scaling */
  viewportWidth: number;
  /** Viewport height for output coordinate scaling */
  viewportHeight: number;
  /** Mouth openness 0-1 for speech (default 0) */
  mouthOpen?: number;
  /** Blink amount 0-1 (default 0) */
  blinkAmount?: number;
}

/**
 * Stipple the Theseus face for idle state display.
 *
 * Returns StippleResult with targets in viewport coordinates.
 * The face is centered in the viewport. Call once on page load
 * and on resize. FaceAnimator handles per-frame displacement
 * after this initial stipple.
 */
export function stippleFace(options: FaceStippleOptions): StippleResult {
  const { viewportWidth, viewportHeight, mouthOpen = 0, blinkAmount = 0 } = options;

  const render = renderFace({ mouthOpen, blinkAmount });

  return stipple(render, FACE_DOT_COUNT, {
    iterations: 12,
    snapshotInterval: 1,
    seed: 7,
    outputWidth: viewportWidth,
    outputHeight: viewportHeight,
  });
}
```

**Step 2: Type check**

Run: `npx tsc --noEmit src/lib/galaxy/StipplingDirector.ts`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/lib/galaxy/StipplingDirector.ts
git commit -m "feat(galaxy): add stippleFace idle mode to StipplingDirector"
```

---

### Task 4: Face idle state on the /ask page

**Files:**
- Modify: `src/app/theseus/ask/page.tsx` (replace StaticScreen idle with face)
- Reference: `src/lib/galaxy/StipplingDirector.ts` (stippleFace)
- Reference: `src/lib/galaxy/FaceAnimator.ts` (tagFaceDots, animateFaceDots, tickIdleAnimation)
- Reference: `src/lib/galaxy/pretextLabels.ts` (renderPretextLabels for greeting text)

**Context:** Currently when state is IDLE and there's no error, the page shows a static "No query provided" message. We replace this with the stippled face rendered on the galaxy canvas, with idle animations. The face is the hero of the page. The existing `composerQuery` input bar stays at the bottom.

This task is more complex because it involves wiring into the existing `useGalaxy()` context from `TheseusShell`. The galaxy canvas is managed by `GalaxyController` which is rendered by `TheseusShell`. We need to:

1. Expose a "face mode" signal through the galaxy context
2. Have GalaxyController render face dots when in face mode
3. Run the idle animation loop

**Step 1: Check the TheseusShell/GalaxyController interface**

Before writing code, read these files to understand how to add face mode:
- `src/components/theseus/TheseusShell.tsx` (galaxy context provider)
- `src/components/theseus/GalaxyController.tsx` (canvas rendering loop)

This step requires reading the actual files. The implementation engineer should:
1. Read `TheseusShell.tsx` to find the context shape and `setAskState` pattern
2. Read `GalaxyController.tsx` to find the render loop where dot positions are drawn
3. Add `faceTargets: StippleTarget[] | null` and `faceTagged: TaggedDot[] | null` to the galaxy context
4. In GalaxyController, when `askState === 'IDLE'` and `faceTargets` exists, render those dots instead of the normal galaxy
5. In the AskContent component, call `stippleFace()` on mount and pass results to context

**Step 2: Update the IDLE state in AskContent**

Replace the early return for idle state:

```typescript
// Before:
if (state === 'IDLE' && !error) {
  return <StaticScreen title="No query provided" subtitle="..." />;
}

// After: remove this block entirely. The face renders on the galaxy canvas
// via GalaxyController when askState is IDLE. The composer input bar
// renders at the bottom in all states.
```

The existing `renderBottomDock()` already handles the input bar. Make it always visible (not just when `showComposer` is true), and update the placeholder text to "Ask Theseus anything..." when in IDLE state.

**Step 3: Run the dev server and verify**

Run: `npm run dev`
Navigate to `/theseus/ask` (no query param)
Expected: Face made of dots visible in center of screen, breathing animation active, input bar at bottom.

**Step 4: Commit**

```bash
git add src/app/theseus/ask/page.tsx src/components/theseus/TheseusShell.tsx src/components/theseus/GalaxyController.tsx
git commit -m "feat(ask): render stippled face as idle state on /ask page"
```

---

### Task 5: Face construction animation

**Files:**
- Modify: `src/components/theseus/GalaxyController.tsx` (animate dot convergence)
- Reference: `src/lib/galaxy/StipplingEngine.ts` (StippleResult.snapshots)

**Context:** When the page loads, dots should converge from random positions to the face shape over ~2 seconds. The StippleResult already contains snapshots (position arrays captured during Lloyd's iterations). The construction animation interpolates between snapshots.

**Step 1: Implement snapshot interpolation**

In GalaxyController, when face mode activates:
1. Start with snapshot[0] (scattered positions)
2. Interpolate through snapshots over 2000ms using ease-out timing
3. Land on the final `targets` positions
4. Then hand off to FaceAnimator for idle breathing/blink

**Step 2: Verify visually**

Run: `npm run dev`, navigate to `/theseus/ask`
Expected: Dots converge from scattered positions into the face shape over ~2 seconds.

**Step 3: Commit**

```bash
git add src/components/theseus/GalaxyController.tsx
git commit -m "feat(ask): face construction animation using stipple snapshots"
```

---

## Phase 2: Spatial Conversation Surface

### Task 6: SpatialConversation position manager

**Files:**
- Create: `src/lib/galaxy/SpatialConversation.ts`

**Context:** Manages the spatial positions of inline text responses and panel blooms on the galaxy canvas. Tracks where each message is anchored, handles collision avoidance between messages, and decides when to graduate from inline to panel mode.

**Step 1: Write the module**

```typescript
// src/lib/galaxy/SpatialConversation.ts
//
// Manages spatial positions of conversation elements on the galaxy canvas.
// Each response is anchored near the most relevant node cluster.
// Handles collision avoidance and inline-to-panel graduation.

export interface SpatialMessage {
  id: string;
  /** Anchor position (where the relevant node cluster center is) */
  anchorX: number;
  anchorY: number;
  /** Current rendered position (may differ from anchor due to collision avoidance) */
  renderX: number;
  renderY: number;
  /** Width/height of the rendered content */
  width: number;
  height: number;
  /** Whether this has graduated from inline to panel mode */
  isPanel: boolean;
  /** The streaming text content */
  text: string;
  /** Whether streaming is complete */
  complete: boolean;
}

const INLINE_MAX_CHARS = 300; // ~3 sentences
const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 480;
const COLLISION_PADDING = 16;

/**
 * Compute the anchor position for a response based on relevant node IDs.
 * Places the message near the centroid of the referenced nodes.
 */
export function computeAnchor(
  relevantNodePositions: Array<{ x: number; y: number }>,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  if (relevantNodePositions.length === 0) {
    // Default: center-right area
    return { x: canvasWidth * 0.6, y: canvasHeight * 0.4 };
  }

  let sumX = 0;
  let sumY = 0;
  for (const pos of relevantNodePositions) {
    sumX += pos.x;
    sumY += pos.y;
  }
  const cx = sumX / relevantNodePositions.length;
  const cy = sumY / relevantNodePositions.length;

  // Offset slightly right and below the cluster center
  return {
    x: Math.min(canvasWidth - PANEL_MAX_WIDTH, cx + 40),
    y: Math.min(canvasHeight - 200, cy + 20),
  };
}

/**
 * Determine if a message should graduate to panel mode.
 */
export function shouldBePanel(text: string): boolean {
  return text.length > INLINE_MAX_CHARS;
}

/**
 * Resolve collisions between spatial messages.
 * Pushes overlapping messages downward.
 */
export function resolveMessageCollisions(messages: SpatialMessage[]): void {
  // Sort by Y position
  const sorted = [...messages].sort((a, b) => a.renderY - b.renderY);

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const other = sorted[j];
      const overlapX = Math.abs(current.renderX - other.renderX) < (current.width + other.width) / 2 + COLLISION_PADDING;
      const overlapY = other.renderY < current.renderY + current.height + COLLISION_PADDING;

      if (overlapX && overlapY) {
        other.renderY = current.renderY + current.height + COLLISION_PADDING;
      }
    }
  }
}
```

**Step 2: Type check**

Run: `npx tsc --noEmit src/lib/galaxy/SpatialConversation.ts`

**Step 3: Commit**

```bash
git add src/lib/galaxy/SpatialConversation.ts
git commit -m "feat(galaxy): SpatialConversation position manager for canvas messages"
```

---

### Task 7: Extend pretextLabels for inline response text

**Files:**
- Modify: `src/lib/galaxy/pretextLabels.ts` (add renderInlineResponse function)

**Context:** The existing `renderPretextLabels` handles short uppercase labels. We need a new function for rendering multi-line streaming response text in body font (IBM Plex Sans 14px) with word wrap, at arbitrary canvas positions. This is the "galaxy as conversation surface" rendering path for short responses.

**Step 1: Add the inline response renderer**

Add after the existing `renderClickCard` function:

```typescript
// ---------------------------------------------------------------------------
// Inline Response: streaming text rendered on the galaxy canvas
// ---------------------------------------------------------------------------

const RESPONSE_FONT = '400 14px "IBM Plex Sans", sans-serif';
const RESPONSE_LINE_HEIGHT = 22;
const RESPONSE_MAX_WIDTH = 360;
const RESPONSE_PADDING_X = 14;
const RESPONSE_PADDING_Y = 10;
const RESPONSE_BORDER_RADIUS = 12;

export interface InlineResponseData {
  canvasX: number;
  canvasY: number;
  text: string;
  alpha: number;
  /** Character count to render (for streaming animation) */
  visibleChars?: number;
}

/**
 * Render a streaming inline response on the galaxy canvas.
 * Uses pretext for proper word wrapping. Streams character by character
 * when visibleChars is set.
 */
export function renderInlineResponse(
  ctx: CanvasRenderingContext2D,
  response: InlineResponseData,
  viewportWidth: number,
  viewportHeight: number,
): { width: number; height: number } {
  if (response.alpha < 0.01) return { width: 0, height: 0 };

  const a = response.alpha;
  const displayText = response.visibleChars !== undefined
    ? response.text.slice(0, response.visibleChars)
    : response.text;

  if (displayText.length === 0) return { width: 0, height: 0 };

  const prepared = getPrepared(displayText, RESPONSE_FONT);
  const result = layoutWithLines(prepared, RESPONSE_MAX_WIDTH - RESPONSE_PADDING_X * 2, RESPONSE_LINE_HEIGHT);
  const lines = result.lines;

  let maxLineWidth = 0;
  ctx.font = RESPONSE_FONT;
  for (const line of lines) {
    const w = ctx.measureText(line.text).width;
    if (w > maxLineWidth) maxLineWidth = w;
  }

  const blockWidth = maxLineWidth + RESPONSE_PADDING_X * 2;
  const blockHeight = result.height + RESPONSE_PADDING_Y * 2;

  // Position: try to stay within viewport
  let cx = response.canvasX;
  let cy = response.canvasY;
  if (cx + blockWidth > viewportWidth) cx = viewportWidth - blockWidth - 16;
  if (cy + blockHeight > viewportHeight) cy = viewportHeight - blockHeight - 16;
  if (cx < 16) cx = 16;
  if (cy < 16) cy = 16;

  // Background
  ctx.beginPath();
  ctx.roundRect(cx, cy, blockWidth, blockHeight, RESPONSE_BORDER_RADIUS);
  ctx.fillStyle = `rgba(15, 16, 18, ${0.72 * a})`;
  ctx.fill();

  // Border
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.06 * a})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Text
  ctx.font = RESPONSE_FONT;
  ctx.fillStyle = `rgba(232, 229, 224, ${a})`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(
      lines[i].text,
      cx + RESPONSE_PADDING_X,
      cy + RESPONSE_PADDING_Y + i * RESPONSE_LINE_HEIGHT,
    );
  }

  return { width: blockWidth, height: blockHeight };
}
```

**Step 2: Type check**

Run: `npx tsc --noEmit src/lib/galaxy/pretextLabels.ts`

**Step 3: Commit**

```bash
git add src/lib/galaxy/pretextLabels.ts
git commit -m "feat(galaxy): inline response rendering via pretext for canvas conversation"
```

---

### Task 8: SpatialPanel component (DOM overlay for focused panels)

**Files:**
- Create: `src/components/ask/SpatialPanel.tsx`
- Reference: `src/styles/theseus.css` (VIE tokens)

**Context:** When a response exceeds the inline threshold (~3 sentences), it graduates into a DOM element positioned at the same canvas coordinates. This panel supports text selection, links, code blocks, and scrolling. It uses VIE tokens but with improved contrast (not the muddy `rgba(15,16,18,0.76)` panels).

**Step 1: Write the component**

```tsx
// src/components/ask/SpatialPanel.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

interface SpatialPanelProps {
  /** Canvas X coordinate to anchor to */
  anchorX: number;
  /** Canvas Y coordinate to anchor to */
  anchorY: number;
  /** Streaming markdown text */
  text: string;
  /** Whether streaming is complete */
  complete: boolean;
  /** Callback when panel is dismissed */
  onDismiss?: () => void;
}

export default function SpatialPanel({
  anchorX,
  anchorY,
  text,
  complete,
  onDismiss,
}: SpatialPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.92);

  // Bloom animation on mount
  useEffect(() => {
    requestAnimationFrame(() => setScale(1));
  }, []);

  return (
    <div
      ref={panelRef}
      className="theseus-spatial-panel"
      style={{
        position: 'absolute',
        left: anchorX,
        top: anchorY,
        maxWidth: 480,
        minWidth: 320,
        maxHeight: 400,
        overflowY: 'auto',
        padding: '16px 18px',
        borderRadius: 16,
        background: 'rgba(20, 21, 25, 0.88)',
        border: '1px solid rgba(74, 138, 150, 0.15)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        pointerEvents: 'auto',
        zIndex: 15,
      }}
    >
      <div
        style={{
          color: 'var(--vie-text)',
          fontFamily: 'var(--vie-font-body)',
          fontSize: 14,
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
        }}
      >
        {text}
        {!complete && (
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 14,
              background: 'var(--vie-teal)',
              marginLeft: 2,
              animation: 'vie-cursor-blink 1s step-end infinite',
              verticalAlign: 'text-bottom',
            }}
          />
        )}
      </div>
    </div>
  );
}
```

**Step 2: Type check**

Run: `npx tsc --noEmit src/components/ask/SpatialPanel.tsx`

**Step 3: Commit**

```bash
git add src/components/ask/SpatialPanel.tsx
git commit -m "feat(ask): SpatialPanel DOM overlay for focused conversation responses"
```

---

### Task 9: Wire spatial conversation into the /ask page

**Files:**
- Modify: `src/app/theseus/ask/page.tsx`
- Reference: `src/lib/galaxy/SpatialConversation.ts`
- Reference: `src/components/ask/SpatialPanel.tsx`

**Context:** This wires everything together. When a response streams in:
1. Compute anchor position from referenced object positions
2. Start rendering inline on the canvas (via pretextLabels)
3. If text exceeds threshold, spawn a SpatialPanel at the same position
4. Previous messages collapse into spatial cards

This is the most integration-heavy task. The implementation engineer should:
1. Read the current ask page flow (THINKING -> MODEL -> CONSTRUCTING -> EXPLORING)
2. During EXPLORING, stream the narrative sections spatially
3. Use the galaxy context to get node positions for anchor computation
4. Render SpatialPanel components for long responses

**Step 1: Implement spatial response rendering**

In AskContent, replace the fixed-position InsightPanel with spatial rendering:
- Short narratives render inline on the galaxy canvas (via GalaxyController)
- Long narratives render as SpatialPanel DOM overlays

**Step 2: Verify**

Run: `npm run dev`, ask a question at `/theseus/ask?q=test`
Expected: Response text appears anchored near relevant nodes, not in a fixed bottom-left panel.

**Step 3: Commit**

```bash
git add src/app/theseus/ask/page.tsx
git commit -m "feat(ask): spatial conversation surface with inline and panel modes"
```

---

## Phase 3: Voice

### Task 10: Deepgram token endpoint

**Files:**
- Create: `src/app/api/voice/token/route.ts`

**Context:** Issues a short-lived Deepgram API key for browser-direct STT. The browser calls this once, gets a token, then opens a WebSocket directly to Deepgram. No Django WebSocket proxy needed.

**Step 1: Write the route handler**

```typescript
// src/app/api/voice/token/route.ts
import { NextResponse } from 'next/server';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

export async function POST() {
  if (!DEEPGRAM_API_KEY) {
    return NextResponse.json({ error: 'Deepgram not configured' }, { status: 500 });
  }

  // Request a temporary API key from Deepgram
  const response = await fetch('https://api.deepgram.com/v1/manage/keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
    },
    body: JSON.stringify({
      comment: 'Theseus STT temporary key',
      time_to_live_in_seconds: 300,
      scopes: ['usage:write'],
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to create Deepgram key' }, { status: 502 });
  }

  const data = await response.json();
  return NextResponse.json({ key: data.key, expires_at: data.expires_at });
}
```

Note: The exact Deepgram key provisioning API may differ. The implementation engineer should check Deepgram's docs for the correct temporary key endpoint. An alternative approach is to use Deepgram's browser SDK which handles token management.

**Step 2: Commit**

```bash
git add src/app/api/voice/token/route.ts
git commit -m "feat(voice): Deepgram temporary token endpoint for browser-direct STT"
```

---

### Task 11: DeepgramSTT client

**Files:**
- Create: `src/lib/voice/DeepgramSTT.ts`

**Context:** Browser-side STT client. Gets a token from the endpoint, opens a WebSocket to Deepgram Nova-3, streams microphone audio, returns interim and final transcripts.

**Step 1: Write the module**

```typescript
// src/lib/voice/DeepgramSTT.ts
//
// Browser-direct Deepgram STT. Gets a temporary key from our API,
// then opens a WebSocket directly to Deepgram Nova-3.

export interface STTCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: Error) => void;
}

export class DeepgramSTT {
  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private audioContext: AudioContext | null = null;

  async start(callbacks: STTCallbacks): Promise<void> {
    // Get temporary key
    const tokenRes = await fetch('/api/voice/token', { method: 'POST' });
    if (!tokenRes.ok) {
      callbacks.onError(new Error('Failed to get Deepgram token'));
      return;
    }
    const { key } = await tokenRes.json();

    // Open WebSocket to Deepgram
    const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-3&language=en&smart_format=true&interim_results=true`;
    this.ws = new WebSocket(wsUrl, ['token', key]);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const transcript = data?.channel?.alternatives?.[0]?.transcript;
        if (!transcript) return;

        if (data.is_final) {
          callbacks.onFinal(transcript);
        } else {
          callbacks.onInterim(transcript);
        }
      } catch {
        // Ignore parse errors
      }
    };

    this.ws.onerror = () => callbacks.onError(new Error('Deepgram WebSocket error'));

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error('No WebSocket'));
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error('WebSocket connection failed'));
    });

    // Start microphone capture
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Use ScriptProcessorNode to get raw PCM data
    // (AudioWorklet is better but more complex to set up)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      const float32 = e.inputBuffer.getChannelData(0);
      // Convert to 16-bit PCM
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32768)));
      }
      this.ws.send(int16.buffer);
    };

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stop(): void {
    this.processor?.disconnect();
    this.audioContext?.close();
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.ws = null;
    this.mediaStream = null;
    this.processor = null;
    this.audioContext = null;
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/voice/DeepgramSTT.ts
git commit -m "feat(voice): DeepgramSTT browser-direct client with Nova-3"
```

---

### Task 12: CartesiaTTS client with sentence-level streaming

**Files:**
- Create: `src/lib/voice/CartesiaTTS.ts`

**Context:** Sentence-level TTS streaming. As soon as the LLM generates a sentence, send it to Cartesia Sonic and start playing. The AnalyserNode provides amplitude data for face mouth animation.

**Step 1: Write the module**

```typescript
// src/lib/voice/CartesiaTTS.ts
//
// Sentence-level TTS via Cartesia Sonic.
// Streams audio sentence by sentence for minimal time-to-first-audio.
// Provides AnalyserNode amplitude data for face mouth animation.

export interface TTSCallbacks {
  /** Called per animation frame with mouth openness 0-1 */
  onAmplitude: (amplitude: number) => void;
  /** Called when all audio has finished playing */
  onComplete: () => void;
  onError: (error: Error) => void;
}

export class CartesiaTTS {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private queue: ArrayBuffer[] = [];
  private playing = false;
  private animFrameId = 0;
  private callbacks: TTSCallbacks | null = null;
  private amplitudeData: Uint8Array | null = null;
  private smoothedAmplitude = 0;

  async init(callbacks: TTSCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.6;
    this.amplitudeData = new Uint8Array(this.analyser.frequencyBinCount);

    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    this.startAmplitudeLoop();
  }

  /**
   * Queue a sentence for TTS. Call this as soon as each sentence
   * is generated by the LLM. Audio starts playing immediately
   * for the first sentence; subsequent sentences queue.
   */
  async speak(sentence: string): Promise<void> {
    if (!this.audioContext) return;

    try {
      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sentence }),
      });

      if (!response.ok) {
        this.callbacks?.onError(new Error('TTS request failed'));
        return;
      }

      const audioData = await response.arrayBuffer();
      this.queue.push(audioData);

      if (!this.playing) {
        this.playNext();
      }
    } catch (err) {
      this.callbacks?.onError(err instanceof Error ? err : new Error('TTS error'));
    }
  }

  private async playNext(): Promise<void> {
    if (!this.audioContext || !this.gainNode) return;

    const data = this.queue.shift();
    if (!data) {
      this.playing = false;
      this.callbacks?.onComplete();
      return;
    }

    this.playing = true;
    try {
      const buffer = await this.audioContext.decodeAudioData(data);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode);
      source.onended = () => this.playNext();
      source.start();
    } catch {
      // If decode fails, skip to next
      this.playNext();
    }
  }

  private startAmplitudeLoop(): void {
    const tick = () => {
      if (!this.analyser || !this.amplitudeData || !this.callbacks) return;

      this.analyser.getByteFrequencyData(this.amplitudeData);

      // Average amplitude across frequency bins
      let sum = 0;
      for (let i = 0; i < this.amplitudeData.length; i++) {
        sum += this.amplitudeData[i];
      }
      const raw = sum / this.amplitudeData.length / 255;

      // Smooth with lerp
      this.smoothedAmplitude += (raw - this.smoothedAmplitude) * 0.3;

      // Map to mouth openness 0-1 (with threshold to avoid jitter on silence)
      const mouthOpen = this.smoothedAmplitude > 0.02
        ? Math.min(1, this.smoothedAmplitude * 3)
        : 0;

      this.callbacks.onAmplitude(mouthOpen);
      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.animFrameId);
    this.queue = [];
    this.playing = false;
    this.audioContext?.close();
    this.audioContext = null;
    this.analyser = null;
    this.gainNode = null;
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/voice/CartesiaTTS.ts
git commit -m "feat(voice): CartesiaTTS with sentence-level streaming and amplitude analysis"
```

---

### Task 13: TTS proxy endpoint

**Files:**
- Create: `src/app/api/voice/tts/route.ts`

**Context:** Proxies text to Cartesia Sonic API, streams audio back. This keeps the Cartesia API key server-side.

**Step 1: Write the route handler**

```typescript
// src/app/api/voice/tts/route.ts
import { NextRequest, NextResponse } from 'next/server';

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const CARTESIA_VOICE_ID = process.env.CARTESIA_VOICE_ID ?? 'a0e99841-438c-4a64-b679-ae501e7d6091';

export async function POST(request: NextRequest) {
  if (!CARTESIA_API_KEY) {
    return NextResponse.json({ error: 'Cartesia not configured' }, { status: 500 });
  }

  const { text, voice } = await request.json();
  if (!text) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 });
  }

  const response = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CARTESIA_API_KEY,
      'Cartesia-Version': '2024-06-10',
    },
    body: JSON.stringify({
      transcript: text,
      model_id: 'sonic-2',
      voice: { mode: 'id', id: voice ?? CARTESIA_VOICE_ID },
      output_format: { container: 'mp3', sample_rate: 44100, encoding: 'mp3' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: `Cartesia error: ${err}` }, { status: 502 });
  }

  // Stream the audio bytes back
  return new NextResponse(response.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache',
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/voice/tts/route.ts
git commit -m "feat(voice): TTS proxy endpoint for Cartesia Sonic"
```

---

### Task 14: VoiceManager and VoiceControls

**Files:**
- Create: `src/lib/voice/VoiceManager.ts`
- Create: `src/components/ask/VoiceControls.tsx`

**Context:** VoiceManager coordinates STT and TTS state. VoiceControls renders the microphone button and voice settings. The amplitude from TTS feeds into FaceAnimator via a callback.

**Step 1: Write VoiceManager**

VoiceManager is a simple state coordinator:
- `startListening()` -> activates DeepgramSTT
- `stopListening()` -> stops STT, returns transcript
- `speakSentence(text)` -> queues sentence in CartesiaTTS
- `onAmplitude` callback -> feeds FaceAnimator

**Step 2: Write VoiceControls**

A microphone button with:
- Click to start/stop listening
- Visual feedback (pulsing ring when listening)
- Interim transcript preview in the input field
- Voice settings dropdown (auto-speak toggle, voice selection)

**Step 3: Commit**

```bash
git add src/lib/voice/VoiceManager.ts src/components/ask/VoiceControls.tsx
git commit -m "feat(voice): VoiceManager coordinator and VoiceControls UI"
```

---

### Task 15: Wire voice into /ask page with face animation

**Files:**
- Modify: `src/app/theseus/ask/page.tsx`
- Modify: `src/components/theseus/GalaxyController.tsx` (pass amplitude to FaceAnimator)

**Context:** Connect VoiceManager to the ask page. When TTS plays, the amplitude callback feeds into FaceAnimator to animate the mouth. When STT is active, show interim transcript in the input field.

**Step 1: Wire TTS amplitude to FaceAnimator**

In the galaxy context, add a `mouthOpen` value. VoiceManager sets it via callback. GalaxyController reads it and passes to `animateFaceDots`.

**Step 2: Wire STT to the composer input**

When listening, interim transcripts update the `composerQuery` state in lighter color. Final transcript solidifies.

**Step 3: Verify**

Run: `npm run dev`, navigate to `/theseus/ask`
Expected: Click mic, speak, see transcript appear. Ask a question, hear TTS response, see face mouth animate.

**Step 4: Commit**

```bash
git add src/app/theseus/ask/page.tsx src/components/theseus/GalaxyController.tsx
git commit -m "feat(ask): wire voice to face animation and composer input"
```

---

### Task 16: Pre-generated greeting

**Files:**
- Create: `public/audio/greeting.mp3` (generated via Cartesia API or manual)
- Modify: `src/app/theseus/ask/page.tsx`

**Context:** On first visit, after the face construction animation (~2s), play a pre-generated greeting. The mouth animates in sync. The greeting text also appears inline below the face.

**Step 1: Generate the greeting audio**

Use the Cartesia API (or a script) to generate:
"Hi, I'm Theseus. I'm an epistemic engine. How can I help you think today?"

Save as `public/audio/greeting.mp3`.

**Step 2: Wire greeting playback**

In AskContent, after face construction completes:
1. Load `greeting.mp3` via Web Audio API
2. Play through the same AnalyserNode pipeline as regular TTS
3. Render greeting text inline below the face via pretextLabels
4. Set a sessionStorage flag to skip on subsequent visits

**Step 3: Commit**

```bash
git add public/audio/greeting.mp3 src/app/theseus/ask/page.tsx
git commit -m "feat(ask): proactive greeting with pre-generated audio and face animation"
```

---

## Phase 4: Polish

### Task 17: Face-to-answer transition

**Files:**
- Modify: `src/components/theseus/GalaxyController.tsx`

**Context:** When user submits a question, the face dots should smoothly transition into the answer visualization. This means: face stipple targets interpolate toward the answer stipple targets. The dots that formed the face become the dots that form the answer.

**Step 1: Implement target interpolation**

When state transitions from IDLE to THINKING:
1. Record current face dot positions as "from" positions
2. When answer stipple targets arrive (CONSTRUCTING), use these as "to" positions
3. Animate from -> to over the answer construction duration
4. Use theatricality from StipplingDirector to control the flight path drama

**Step 2: Verify**

Expected: Face gracefully dissolves as dots fly to form the answer model.

**Step 3: Commit**

```bash
git add src/components/theseus/GalaxyController.tsx
git commit -m "feat(ask): face-to-answer dot transition animation"
```

---

### Task 18: Listening state (sonar pulse)

**Files:**
- Modify: `src/components/theseus/GalaxyController.tsx`

**Context:** When STT is active, a sonar pulse radiates outward from the face. Dots in concentric rings briefly brighten.

**Step 1: Implement sonar pulse**

When `isListening` is true:
1. Every 800ms, start a ring expanding outward from face center
2. Dots within the ring's current radius get a brightness boost
3. Ring expands at ~200px/s with fade-out over 600ms
4. Maximum 2 concurrent rings

**Step 2: Commit**

```bash
git add src/components/theseus/GalaxyController.tsx
git commit -m "feat(ask): sonar pulse effect during voice listening"
```

---

### Task 19: Corner voice avatar during exploration

**Files:**
- Modify: `src/components/theseus/GalaxyController.tsx`

**Context:** When TTS is playing during EXPLORING state (answer is visible), render a small ~80x80px stippled face in the bottom-left corner with mouth animation. This uses a scaled-down face stipple with fewer dots.

**Step 1: Implement mini-avatar**

When state is EXPLORING and `mouthOpen > 0` (TTS playing):
1. Render a small face density map at 80x80 region
2. Use ~200 dots (scaled down from 4000)
3. Apply the same mouth animation from FaceAnimator
4. Fade in over 300ms, fade out when TTS stops

**Step 2: Commit**

```bash
git add src/components/theseus/GalaxyController.tsx
git commit -m "feat(ask): corner mini-avatar during answer exploration with TTS"
```

---

### Task 20: Improved panel surface tokens

**Files:**
- Modify: `src/styles/theseus.css`
- Modify: `src/components/ask/SpatialPanel.tsx`

**Context:** Replace the muddy `rgba(15,16,18,0.76)` panel backgrounds with better contrast. The new surface should feel like frosted glass with a subtle warm tint, distinguishable from the `#0f1012` background.

**Step 1: Add new surface tokens**

```css
/* In .theseus-root: */
--vie-surface-panel: rgba(28, 30, 36, 0.88);
--vie-surface-panel-border: rgba(74, 138, 150, 0.12);
--vie-surface-panel-glow: 0 4px 24px rgba(0, 0, 0, 0.3), 0 0 1px rgba(74, 138, 150, 0.08);
```

**Step 2: Apply to SpatialPanel and existing panels**

Update SpatialPanel and the existing ask page panels to use the new tokens.

**Step 3: Commit**

```bash
git add src/styles/theseus.css src/components/ask/SpatialPanel.tsx src/app/theseus/ask/page.tsx
git commit -m "fix(theseus): improved panel surface tokens for better contrast"
```

---

### Task 21: Mobile layout

**Files:**
- Modify: `src/app/theseus/ask/page.tsx`
- Modify: `src/components/ask/SpatialPanel.tsx`

**Context:** On mobile:
- Face renders as a compact banner (~120px tall) at top
- Conversation is full-width below
- SpatialPanels are full-width drawers from bottom (via Vaul)
- Voice controls are prominent (large mic button)

**Step 1: Implement responsive breakpoints**

Use the existing `useIsMobile()` hook. When mobile:
1. Face stipple uses smaller canvas region (top 120px)
2. SpatialPanels render as Vaul drawers instead of positioned overlays
3. Inline responses render below the face banner, not spatially anchored

**Step 2: Commit**

```bash
git add src/app/theseus/ask/page.tsx src/components/ask/SpatialPanel.tsx
git commit -m "feat(ask): mobile responsive layout with compact face and drawer panels"
```

---

## Environment Variables Required

Add to `.env.local` (and Vercel dashboard for production):

```
DEEPGRAM_API_KEY=       # Deepgram API key for STT token provisioning
CARTESIA_API_KEY=       # Cartesia API key for Sonic TTS
CARTESIA_VOICE_ID=      # Optional: specific Cartesia voice ID
```

## Dependencies to Install

```bash
npm install @assistant-ui/react @assistant-ui/react-ai-sdk  # assistant-ui primitives
# Deepgram browser SDK is optional; we use raw WebSocket
# Cartesia is server-side only (proxied through our API)
```

Note: assistant-ui is listed here but may not be needed in Phase 1-2. Install when wiring the chat threading primitives in Phase 2 Task 9.
