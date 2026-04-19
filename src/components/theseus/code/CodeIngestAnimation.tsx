'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/**
 * CodeStreamCanvas: atmospheric backdrop for the ingestion screen.
 *
 * Renders sparse horizontal lines of plausible Python and C code at three
 * depth tiers (near / mid / far), each with its own font size, alpha, and
 * drift speed. Lines type in left-to-right, hold briefly, then drift left
 * and fade out. The three tiers create a parallax feel: distant code is
 * small and quiet; near code is larger, brighter, and fleeting.
 *
 * Decorative only. The fragments are generic stdlib-adjacent patterns
 * (imports, function signatures, includes) — not pulled from any real
 * repo. Honest phase events still live in the DOM transmission log
 * above this layer.
 *
 * Honors prefers-reduced-motion: paints a single static frame and bails.
 * Offers a pause/play toggle pinned to the viewport corner.
 */
interface Props {
  /** True while the SSE stream is open. When false the canvas freezes
   *  on its last frame and the scan bar hides. */
  active: boolean;
  /** 0..1. Gently accelerates typing + spawn rate as phases complete. */
  progress?: number;
}

/** Depth tier. 0 = far (smallest, quietest), 2 = near (largest, brightest). */
type Depth = 0 | 1 | 2;

interface CodeLine {
  y: number;
  x: number;
  text: string;
  /** Characters revealed so far (continuous so typing feels analog). */
  revealed: number;
  depth: Depth;
  /** Frames since birth. Controls typing -> hold -> fade lifecycle. */
  age: number;
  /** Total lifespan in frames. */
  lifespan: number;
  /** Horizontal drift speed in px/frame. Near lines drift slightly more. */
  drift: number;
  /** Characters revealed per frame during the typing phase. */
  typeSpeed: number;
  /** Base alpha before age-based fade. */
  baseAlpha: number;
  /** Font size in px. Varies by depth. */
  fontSize: number;
  /** "py" or "c" — picked at spawn, carries a slight color shift. */
  lang: 'py' | 'c';
}

// Generic fragments. Chosen to read as plausible code at a glance without
// quoting anything specific: stdlib-adjacent idioms, canonical patterns.
const PY_FRAGMENTS = [
  'import ast',
  'from collections import defaultdict',
  'from dataclasses import dataclass',
  'from typing import Iterator, Optional',
  '@dataclass(frozen=True)',
  'class Symbol(NamedTuple):',
  'def walk(node, visited=None):',
  'def parse_tree(root):',
  'def resolve_imports(module):',
  'if node.type == "function_definition":',
  'for child in node.children:',
  'yield from walk(child)',
  'return [n for n in children if n.visible]',
  'raise ValueError(f"unexpected token at {pos}")',
  'with open(path, "r", encoding="utf-8") as f:',
  'queue: deque[str] = deque()',
  '# tokenize the source buffer',
  '# resolve import edges across modules',
  'self._symbols: dict[str, Symbol] = {}',
  'async def fetch(url: str) -> bytes:',
  'match token.kind:',
  '    case "ident":',
  '    case "number":',
  'assert isinstance(node, ast.FunctionDef)',
  'return tuple(sorted(out))',
];

const C_FRAGMENTS = [
  '#include <stdio.h>',
  '#include <stdlib.h>',
  '#include <string.h>',
  '#include "parser.h"',
  'typedef struct node node_t;',
  'typedef struct { int line; int col; } pos_t;',
  'static int hash_symbol(const char *s) {',
  'void *ptr = malloc(sizeof(node_t) * n);',
  'if (ptr == NULL) return -1;',
  'memcpy(dst, src, len);',
  'for (int i = 0; i < count; ++i) {',
  '    tokens[i] = next_token(&ctx);',
  'return node->children[idx];',
  'struct ast_node {',
  '    enum node_kind kind;',
  '    pos_t pos;',
  '};',
  '/* tokenize input stream */',
  'free(ctx->symbols);',
  'ctx->cursor += consumed;',
  'while ((c = getc(fp)) != EOF) {',
  'if (!strcmp(tok.text, "return")) {',
  'goto cleanup;',
  'uint32_t h = FNV_OFFSET;',
];

const DEPTH_STYLE: Record<Depth, {
  fontSize: number;
  baseAlpha: number;
  drift: number;
  typeSpeed: number;
  lifespan: number;
}> = {
  0: { fontSize: 10, baseAlpha: 0.26, drift: 0.15, typeSpeed: 0.5, lifespan: 1400 },
  1: { fontSize: 12, baseAlpha: 0.42, drift: 0.3, typeSpeed: 0.9, lifespan: 900 },
  2: { fontSize: 15, baseAlpha: 0.72, drift: 0.55, typeSpeed: 1.6, lifespan: 520 },
};

// Weighted depth distribution: most spawns are far (background), rarest
// are near (foreground highlights). Creates the sparse-but-layered feel.
function pickDepth(): Depth {
  const r = Math.random();
  if (r < 0.55) return 0;
  if (r < 0.85) return 1;
  return 2;
}

function pickFragment(lang: 'py' | 'c'): string {
  const pool = lang === 'py' ? PY_FRAGMENTS : C_FRAGMENTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function CodeStreamCanvas({
  active,
  progress = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);

  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = Math.max(0, Math.min(1, progress));
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    let logicalW = 0;
    let logicalH = 0;
    let lines: CodeLine[] = [];
    // Target number of lines on screen at once. Scales with viewport
    // area so the density reads the same on small and large monitors.
    let targetLineCount = 0;
    // Frame counter from the moment the animation starts, used to ease
    // the effective target from 0 up to `targetLineCount` over the
    // first several seconds so the screen fills in gradually rather
    // than arriving at full density.
    let rampFrames = 0;
    const RAMP_DURATION_FRAMES = 540; // ~9 s at 60 fps

    function spawnLine(): CodeLine {
      const depth = pickDepth();
      const style = DEPTH_STYLE[depth];
      const lang: 'py' | 'c' = Math.random() < 0.55 ? 'py' : 'c';
      // Random y within the canvas, snapped to a loose grid so lines
      // don't overlap too often. Avoid the extreme vertical center
      // where the card sits, so the stream reads as framing rather
      // than crowding the focal element.
      const band = Math.floor(Math.random() * 12);
      const y = Math.round((band / 12) * logicalH + 24 + Math.random() * 20);
      const xPad = 40 + Math.random() * 200;
      return {
        y,
        x: xPad,
        text: pickFragment(lang),
        revealed: 0,
        depth,
        age: 0,
        lifespan: style.lifespan + Math.floor(Math.random() * 200),
        drift: style.drift * (0.85 + Math.random() * 0.3),
        typeSpeed: style.typeSpeed,
        baseAlpha: style.baseAlpha,
        fontSize: style.fontSize,
        lang,
      };
    }

    function reseed() {
      // Area-based target: roughly 1 line per 42k square logical pixels,
      // clamped so we stay sparse.
      const area = logicalW * logicalH;
      targetLineCount = Math.max(5, Math.min(14, Math.round(area / 42000)));
      // Start empty. The RAF loop's ramp-driven spawn probability will
      // fill the screen over the first ~9 seconds so the user sees the
      // density build up instead of arriving all at once.
      lines = [];
      rampFrames = 0;
    }

    function resize() {
      if (!canvas || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(1, Math.min(2048, Math.floor(rect.width)));
      const h = Math.max(1, Math.min(2048, Math.floor(rect.height)));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      logicalW = w;
      logicalH = h;
      reseed();
    }

    function drawStaticFrame(c: CanvasRenderingContext2D) {
      c.clearRect(0, 0, logicalW, logicalH);
      // Render the currently-spawned lines once, no animation. Lines
      // keep their depth tiers so the static frame still reads as
      // layered code rather than a flat grid.
      for (const line of lines) {
        drawLine(c, line, 1, true);
      }
    }

    function drawLine(
      c: CanvasRenderingContext2D,
      line: CodeLine,
      fadeMultiplier: number,
      isStatic = false,
    ) {
      c.font = `${line.fontSize}px var(--font-jetbrains-mono), "JetBrains Mono", ui-monospace, "SF Mono", monospace`;
      c.textBaseline = 'middle';

      const revealedChars = Math.min(
        line.text.length,
        Math.floor(line.revealed),
      );
      const visibleText = line.text.slice(0, revealedChars);
      if (visibleText.length === 0) return;

      // Alpha lifecycle: 0 -> baseAlpha while typing, holds, then fades
      // over the last third of the lifespan.
      const lifeT = line.age / line.lifespan;
      let lifeAlpha: number;
      if (lifeT < 0.08) {
        lifeAlpha = lifeT / 0.08; // fast fade-in
      } else if (lifeT < 0.7) {
        lifeAlpha = 1;
      } else if (lifeT < 1) {
        lifeAlpha = (1 - lifeT) / 0.3;
      } else {
        lifeAlpha = 0;
      }
      const alpha = Math.max(0, line.baseAlpha * lifeAlpha * fadeMultiplier);
      if (alpha <= 0.01 && !isStatic) return;

      // Base line color: teal for Python, slightly cooler teal for C,
      // both anchored to the VIE teal palette.
      const trailColor =
        line.lang === 'py'
          ? `rgba(74, 138, 150, ${alpha})`
          : `rgba(90, 150, 160, ${alpha * 0.92})`;
      c.fillStyle = trailColor;
      c.fillText(visibleText, line.x, line.y);

      // Typing cursor: warm amber block at the current write position,
      // only while the line is still typing. Matches the card border
      // and the heat wash at the bottom of the page.
      if (!isStatic && revealedChars < line.text.length) {
        const metric = c.measureText(visibleText);
        const cursorX = line.x + metric.width + 1;
        const cursorH = line.fontSize * 0.95;
        c.fillStyle = `rgba(220, 200, 150, ${alpha * 1.2})`;
        c.fillRect(cursorX, line.y - cursorH / 2, 5, cursorH);
      }
    }

    function frame() {
      if (!ctx) return;

      if (paused || reducedMotion || !active) {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawStaticFrame(ctx);
        ctx.restore();
        return;
      }

      const p = progressRef.current;
      const speedBoost = 1 + 0.5 * p;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Full clear each frame (no ghost trail): lines manage their own
      // fade lifecycle so we want a clean canvas per tick.
      ctx.clearRect(0, 0, logicalW, logicalH);

      // Advance each line and draw.
      for (const line of lines) {
        line.age++;
        if (line.revealed < line.text.length) {
          line.revealed += line.typeSpeed * speedBoost;
        }
        line.x -= line.drift * speedBoost;
        drawLine(ctx, line, 1);
      }

      // Ramp the effective target from 0 up to the area-derived full
      // target over RAMP_DURATION_FRAMES using an ease-out curve, so
      // density builds gradually. After the ramp completes this is
      // just the full target.
      rampFrames++;
      const rampT = Math.min(1, rampFrames / RAMP_DURATION_FRAMES);
      const rampEased = 1 - Math.pow(1 - rampT, 2); // easeOutQuad
      const effectiveTarget = Math.ceil(targetLineCount * rampEased);

      // Retire expired lines and respawn to maintain the ramped target.
      lines = lines.filter((l) => l.age < l.lifespan && l.x + l.fontSize * l.text.length > -40);
      if (lines.length < effectiveTarget) {
        // Spawn probability also scales with the ramp so early frames
        // tick out lines at a pace the eye can follow (roughly one
        // every 1–2 seconds in the first few seconds) and later
        // frames refill slots as soon as they open.
        const spawnProb = 0.015 + 0.09 * rampEased + 0.04 * p;
        if (Math.random() < spawnProb) {
          lines.push(spawnLine());
        }
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(frame);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    if (paused || reducedMotion || !active) {
      frame();
    } else {
      rafRef.current = requestAnimationFrame(frame);
    }

    return () => {
      ro.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [paused, reducedMotion, active]);

  return (
    <div ref={wrapRef} className="cx-stream-wrap" aria-hidden="true">
      <canvas ref={canvasRef} className="cx-stream-canvas" />
      <button
        type="button"
        className="cx-stream-pause"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? 'Resume ingestion animation' : 'Pause ingestion animation'}
        title={paused ? 'Resume animation' : 'Pause animation'}
      >
        {paused ? (
          <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 2 L10 6 L3 10 Z" fill="currentColor" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
            <rect x="3" y="2" width="2.5" height="8" fill="currentColor" />
            <rect x="7" y="2" width="2.5" height="8" fill="currentColor" />
          </svg>
        )}
      </button>
    </div>
  );
}
