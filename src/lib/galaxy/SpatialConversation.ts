/**
 * SpatialConversation.ts
 *
 * Manages spatial positions of conversation elements (responses, detail panels)
 * on the galaxy canvas. Each response is anchored near the most relevant node
 * cluster, with collision resolution to prevent overlapping messages.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const INLINE_MAX_CHARS = 300;
export const PANEL_MAX_WIDTH = 480;
export const COLLISION_PADDING = 16;

/** Offset from the centroid so the message sits slightly right and below. */
const ANCHOR_OFFSET_X = 40;
const ANCHOR_OFFSET_Y = 24;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpatialMessage {
  id: string;
  anchorX: number;
  anchorY: number;
  renderX: number;
  renderY: number;
  width: number;
  height: number;
  isPanel: boolean;
  text: string;
  complete: boolean;
}

// ---------------------------------------------------------------------------
// Anchor Computation
// ---------------------------------------------------------------------------

/**
 * Returns the centroid of referenced node positions, offset slightly right
 * and below so the message does not obscure the cluster itself.
 *
 * Falls back to center right of the canvas when no positions are provided.
 */
export function computeAnchor(
  relevantNodePositions: Array<{ x: number; y: number }>,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  if (relevantNodePositions.length === 0) {
    return {
      x: canvasWidth * 0.65,
      y: canvasHeight * 0.5,
    };
  }

  let sumX = 0;
  let sumY = 0;
  for (const pos of relevantNodePositions) {
    sumX += pos.x;
    sumY += pos.y;
  }

  const count = relevantNodePositions.length;
  return {
    x: sumX / count + ANCHOR_OFFSET_X,
    y: sumY / count + ANCHOR_OFFSET_Y,
  };
}

// ---------------------------------------------------------------------------
// Panel Detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the text exceeds the inline character threshold
 * (approximately three sentences), indicating the message should render
 * as a larger detail panel rather than a compact inline bubble.
 */
export function shouldBePanel(text: string): boolean {
  return text.length > INLINE_MAX_CHARS;
}

// ---------------------------------------------------------------------------
// Collision Resolution
// ---------------------------------------------------------------------------

/**
 * Sorts messages by Y position, then pushes any overlapping messages
 * downward so they no longer intersect. Mutates `renderY` in place.
 */
export function resolveMessageCollisions(messages: SpatialMessage[]): void {
  if (messages.length < 2) return;

  // Sort ascending by renderY so we process top to bottom.
  messages.sort((a, b) => a.renderY - b.renderY);

  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];

    const prevBottom = prev.renderY + prev.height + COLLISION_PADDING;

    if (curr.renderY < prevBottom) {
      curr.renderY = prevBottom;
    }
  }
}
