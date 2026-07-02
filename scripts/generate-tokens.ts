/**
 * Parametric design-system generator (SPEC-PARAMETRIC-DESIGN-SYSTEM D2).
 *
 * Reads a product seed (design/seeds/*.seed.json) and emits one tokens.gen.css.
 * Every visual value in the output is derived from the seed: fluid type via
 * clamp() (Utopia method), a space scale commensurable with the type ratio,
 * OKLCH ramps from hue anchors through fixed lightness steps with a chroma
 * curve peaking mid-scale, semantic aliases, the strata canvas recipe, and
 * per-product legacy alias bridges so components keep rendering while the
 * hand-authored token files are deleted.
 *
 * Usage:
 *   node --experimental-strip-types scripts/generate-tokens.ts <seed.json> <out.css> [flags]
 * Flags:
 *   --tailwind          emit a Tailwind v4 @theme block (omit for plain-CSS apps)
 *   --dark attr|media   dark-theme selector strategy (default attr = html[data-theme="dark"])
 *   --aliases a,b,c     legacy alias groups: cp,reader,theseus,networks,studio,console,desktop
 *   --check             run invariant self-checks against the generated output and exit
 *
 * No dependencies. Erasable TS syntax only (runs under node type stripping).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ---------------------------------------------------------------------------
// Seed schema
// ---------------------------------------------------------------------------

type Anchor = { name: string; hue: number; chroma: number };

type Seed = {
  product: string;
  type: {
    base_size_px: number;
    ratio_min: number;
    ratio_max: number;
    viewport_min_px: number;
    viewport_max_px: number;
    steps: number;
  };
  space: { unit_px: number };
  color: {
    anchors: Anchor[];
    neutral_hue: number;
    neutral_chroma: number;
    lightness_steps: number[]; // fixed across products
  };
  shape: { radius_base_px: number; hairline_px: number };
  motion: { fast_ms: number; base_ms: number; slow_ms: number; ease: string };
  font: {
    display_family: string;
    body_family: string;
    mono_family: string;
    density: number; // 0 airy .. 1 dense; drives display wdth axis
  };
  strata: { contrast: number }; // lightness delta between strata bands
};

// ---------------------------------------------------------------------------
// OKLCH color math (Ottosson OKLab; forward + inverse for contrast checks)
// ---------------------------------------------------------------------------

type Lch = { L: number; C: number; H: number };

function oklchToLinearSrgb({ L, C, H }: Lch): [number, number, number] {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function inGamut(c: Lch): boolean {
  return oklchToLinearSrgb(c).every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}

/** Reduce chroma until the color fits sRGB, so emitted values match rendering. */
function fitChroma(c: Lch): Lch {
  if (inGamut(c)) return c;
  let lo = 0;
  let hi = c.C;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut({ ...c, C: mid })) lo = mid;
    else hi = mid;
  }
  return { ...c, C: lo };
}

function relativeLuminance(c: Lch): number {
  const [r, g, b] = oklchToLinearSrgb(fitChroma(c)).map((v) =>
    Math.min(1, Math.max(0, v)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: Lch, b: Lch): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function css(c: Lch, alpha?: number): string {
  const f = fitChroma(c);
  const body = `${f.L.toFixed(4)} ${f.C.toFixed(4)} ${f.H.toFixed(1)}`;
  return alpha === undefined ? `oklch(${body})` : `oklch(${body} / ${alpha})`;
}

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

type Step = { n: number; min: number; max: number; clamp: string };

/** Utopia-method fluid type scale. Sizes emitted in rem for zoom accessibility. */
function typeScale(t: Seed["type"]): Step[] {
  const out: Step[] = [];
  for (let n = -2; n <= t.steps; n++) {
    const min = t.base_size_px * t.ratio_min ** n;
    const max = t.base_size_px * t.ratio_max ** n;
    const slope = (max - min) / (t.viewport_max_px - t.viewport_min_px);
    const intercept = min - slope * t.viewport_min_px;
    const clamp = `clamp(${rem(Math.min(min, max))}, ${rem(intercept)} + ${(
      slope * 100
    ).toFixed(4)}vw, ${rem(Math.max(min, max))})`;
    out.push({ n, min, max, clamp });
  }
  return out;
}

function rem(px: number): string {
  return `${(px / 16).toFixed(4).replace(/\.?0+$/, "")}rem`;
}

/** Space scale: walk the type ratio from the base size, snap to the unit grid. */
function spaceScale(seed: Seed): number[] {
  const { unit_px } = seed.space;
  const { base_size_px, ratio_max } = seed.type;
  const snapped = new Set<number>([unit_px]);
  for (let k = -4; k <= 9; k++) {
    const raw = base_size_px * ratio_max ** k;
    const snap = Math.max(unit_px, Math.round(raw / unit_px) * unit_px);
    snapped.add(snap);
  }
  return [...snapped].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Ramps
// ---------------------------------------------------------------------------

/** Chroma curve peaking mid-scale so ramps stay perceptually even. */
function ramp(anchor: Anchor, lightness: number[]): Lch[] {
  const n = lightness.length;
  return lightness.map((L, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const bell = Math.sin(Math.PI * t) ** 0.9;
    const C = anchor.chroma * (0.14 + 0.86 * bell);
    return fitChroma({ L, C, H: anchor.hue });
  });
}

/**
 * Neutral ramp: constant chroma (the paper warmth), gamut-fitted per step.
 * Unlike accent ramps, warmth must survive at the light end where paper lives.
 */
function neutralRamp(seed: Seed): Lch[] {
  return seed.color.lightness_steps.map((L) =>
    fitChroma({ L, C: seed.color.neutral_chroma, H: seed.color.neutral_hue }),
  );
}

/** Index of the ramp step whose lightness is nearest the target. */
function nearestL(steps: Lch[], targetL: number): number {
  let best = 0;
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(steps[i].L - targetL) < Math.abs(steps[best].L - targetL))
      best = i;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Semantic model shared by every product
// ---------------------------------------------------------------------------

type Theme = {
  surface0: Lch;
  surface1: Lch;
  surface2: Lch;
  surface3: Lch;
  text: Lch;
  textDim: Lch;
  textFaint: Lch;
  border: Lch;
  borderStrong: Lch;
};

function themeOf(neutral: Lch[], dark: boolean): Theme {
  // Light: page sits one step below the palest step so raised cards lift
  // lighter. Dark: page is the deepest step and cards lift lighter too.
  // Adjacent chrome surfaces are exactly one lightness step apart (the
  // surface step rule from HANDOFF-CODE-SURFACE-UI).
  const n = neutral.length;
  if (!dark) {
    return {
      surface0: neutral[2],
      surface1: neutral[1],
      surface2: neutral[0],
      surface3: neutral[3],
      text: neutral[n - 1],
      textDim: neutral[n - 3],
      textFaint: neutral[n - 5],
      border: neutral[4],
      borderStrong: neutral[5],
    };
  }
  return {
    surface0: neutral[n - 1],
    surface1: neutral[n - 2],
    surface2: neutral[n - 3],
    surface3: neutral[n - 4],
    text: neutral[1],
    textDim: neutral[3],
    textFaint: neutral[5],
    border: neutral[n - 4],
    borderStrong: neutral[n - 5],
  };
}

function anchorByName(seed: Seed, name: string): Anchor {
  const a = seed.color.anchors.find((x) => x.name === name);
  if (!a) throw new Error(`seed ${seed.product}: missing anchor "${name}"`);
  return a;
}

/** Accent picked from a ramp at a target lightness per theme. */
function accentFor(seed: Seed, name: string, dark: boolean): Lch {
  const steps = ramp(anchorByName(seed, name), seed.color.lightness_steps);
  return steps[nearestL(steps, dark ? 0.62 : 0.5)];
}

// ---------------------------------------------------------------------------
// Strata canvas (HANDOFF-CODE-SURFACE-UI D1)
// ---------------------------------------------------------------------------

const GRAIN_OPACITY = 0.03; // fixed and small, per the handoff

function grainDataUri(): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>` +
    `<feColorMatrix type='saturate' values='0'/></filter>` +
    `<rect width='128' height='128' filter='url(%23n)' opacity='${GRAIN_OPACITY}'/></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/#/g, "%23")}")`;
}

function strataVars(seed: Seed, theme: Theme, dark: boolean): string[] {
  const period = seed.space.unit_px * 24; // band period from the spacing unit
  const delta = seed.strata.contrast;
  const base = theme.surface0;
  const band = fitChroma({ ...base, L: base.L + (dark ? delta : -delta) });
  const sheenAlpha = dark ? 0.05 : 0.35;
  return [
    `--strata-period: ${period}px;`,
    `--strata-band: ${css(band)};`,
    `--strata-sheen: ${css({ L: dark ? 0.98 : 1, C: 0, H: base.H }, sheenAlpha)};`,
    `--grain-opacity: ${GRAIN_OPACITY};`,
    `--grain-url: ${grainDataUri()};`,
    // Layered canvas: grain, top sheen, repeating bands, base neutral.
    `--canvas-strata: var(--grain-url), radial-gradient(120% 60% at 50% 0%, var(--strata-sheen), transparent 70%), repeating-linear-gradient(180deg, var(--strata-band) 0px, var(--strata-band) 1px, transparent 1px, transparent var(--strata-period));`,
  ];
}

// ---------------------------------------------------------------------------
// Emission
// ---------------------------------------------------------------------------

function emitScales(seed: Seed): string[] {
  const out: string[] = [];
  const steps = typeScale(seed.type);
  for (const s of steps) {
    const label = s.n < 0 ? `-${Math.abs(s.n)}` : `${s.n}`;
    out.push(`--text-${label}: ${s.clamp};`);
  }
  out.push(`--space-unit: ${seed.space.unit_px}px;`);
  spaceScale(seed).forEach((px, i) => out.push(`--space-${i + 1}: ${px}px;`));
  out.push(`--radius-sm: ${Math.round(seed.shape.radius_base_px * 0.75)}px;`);
  out.push(`--radius: ${seed.shape.radius_base_px}px;`);
  out.push(`--radius-lg: ${Math.round(seed.shape.radius_base_px * 1.5)}px;`);
  out.push(`--hairline-w: ${seed.shape.hairline_px}px;`);
  // Running-text measure: fixed across products (45-75ch rule), like the
  // lightness steps. Reading columns clamp to this.
  out.push(`--measure: 68ch;`);
  return out;
}

// Fixed overshoot curve, shared across products like the lightness steps:
// the seed's ease covers settling motion; snap covers arrival emphasis.
const EASE_SNAP = "cubic-bezier(0.34, 1.56, 0.64, 1)";

function emitMotion(seed: Seed): string[] {
  return [
    `--motion-fast: ${seed.motion.fast_ms}ms;`,
    `--motion: ${seed.motion.base_ms}ms;`,
    `--motion-slow: ${seed.motion.slow_ms}ms;`,
    `--ease: ${seed.motion.ease};`,
    `--ease-snap: ${EASE_SNAP};`,
    `--stagger: ${Math.round(seed.motion.fast_ms / 3)}ms;`,
  ];
}

function emitFonts(seed: Seed): string[] {
  const out: string[] = [];
  const f = seed.font;
  // Apps that load fonts through next/font expose hashed family names via
  // --font-*-src on <html>; Fontsource apps get the real family names below.
  out.push(
    `--font-display: var(--font-display-src, "${f.display_family} Variable"), "${f.display_family}", Georgia, serif;`,
  );
  out.push(
    `--font-body: var(--font-body-src, "${f.body_family}"), -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;`,
  );
  out.push(
    `--font-mono: var(--font-mono-src, "${f.mono_family}"), ui-monospace, SFMono-Regular, Menlo, monospace;`,
  );
  // Display axes: opsz follows the type-scale step, wdth follows density.
  // Bricolage Grotesque axes verified: opsz 12..96, wdth 75..100, wght 200..800.
  const steps = typeScale(seed.type);
  const maxPx = Math.max(...steps.map((s) => s.max));
  for (const s of steps) {
    const label = s.n < 0 ? `-${Math.abs(s.n)}` : `${s.n}`;
    const t = Math.min(
      1,
      Math.max(0, (s.max - seed.type.base_size_px) / (maxPx - seed.type.base_size_px)),
    );
    const opsz = 12 + t * (96 - 12);
    out.push(`--font-display-opsz-${label}: ${opsz.toFixed(1)};`);
  }
  const wdth = 100 - seed.font.density * 25; // density 0 -> 100, 1 -> 75
  out.push(`--font-display-wdth: ${wdth.toFixed(1)};`);
  return out;
}

function emitRamps(seed: Seed): string[] {
  const out: string[] = [];
  const neutral = neutralRamp(seed);
  neutral.forEach((c, i) => out.push(`--neutral-${i + 1}: ${css(c)};`));
  for (const a of seed.color.anchors) {
    ramp(a, seed.color.lightness_steps).forEach((c, i) =>
      out.push(`--${a.name}-${i + 1}: ${css(c)};`),
    );
  }
  return out;
}

function emitSemantics(seed: Seed, dark: boolean): string[] {
  const neutral = neutralRamp(seed);
  const th = themeOf(neutral, dark);
  const brand = accentFor(seed, seed.color.anchors[0].name, dark);
  const memory = hasAnchor(seed, "memory") ? accentFor(seed, "memory", dark) : brand;
  const agent = hasAnchor(seed, "agent") ? accentFor(seed, "agent", dark) : brand;
  const out: string[] = [
    `--surface-0: ${css(th.surface0)};`,
    `--surface-1: ${css(th.surface1)};`,
    `--surface-2: ${css(th.surface2)};`,
    `--surface-3: ${css(th.surface3)};`,
    `--surface-translucent: ${css(th.surface1, 0.82)};`,
    `--text: ${css(th.text)};`,
    `--text-dim: ${css(th.textDim)};`,
    `--text-faint: ${css(th.textFaint)};`,
    `--border: ${css(th.border)};`,
    `--border-strong: ${css(th.borderStrong)};`,
    `--hairline: var(--hairline-w) solid var(--border);`,
    `--accent: ${css(brand)};`,
    `--accent-soft: ${css(brand, 0.15)};`,
    `--accent-strong: ${css({ ...brand, L: Math.max(0.2, brand.L - 0.07) })};`,
    `--accent-memory: ${css(memory)};`,
    `--accent-memory-soft: ${css(memory, 0.15)};`,
    `--accent-agent: ${css(agent)};`,
    `--accent-agent-soft: ${css(agent, 0.15)};`,
    `--focus-ring: 2px solid var(--accent);`,
    `--focus-ring-offset: 2px;`,
  ];
  if (hasAnchor(seed, "danger")) {
    const danger = accentFor(seed, "danger", dark);
    out.push(`--danger: ${css(danger)};`, `--danger-soft: ${css(danger, 0.15)};`);
  }
  out.push(...strataVars(seed, th, dark));
  return out;
}

function hasAnchor(seed: Seed, name: string): boolean {
  return seed.color.anchors.some((a) => a.name === name);
}

/** Pick a ramp color for alias emission: anchor name + target lightness. */
function pick(seed: Seed, name: string, targetL: number, alpha?: number): string {
  const steps =
    name === "neutral"
      ? neutralRamp(seed)
      : ramp(anchorByName(seed, name), seed.color.lightness_steps);
  return css(steps[nearestL(steps, targetL)], alpha);
}

// ---------------------------------------------------------------------------
// Legacy alias bridges. Every value is a seed derivation (ramp step lookup),
// so deleting the hand-authored token files keeps components rendering.
// Target lightness values come from the retired files' measured OKLCH.
// ---------------------------------------------------------------------------

type AliasEmitter = (seed: Seed, dark: boolean) => string[];

const ALIAS_GROUPS: Record<string, AliasEmitter> = {
  // commonplace-tokens.css (warm parchment, the light branch) +
  // commonplace-tokens-neutral.css (cool charcoal, the DARK commonplace
  // variant). Colors are ramp picks at the legacy value's measured OKLCH
  // lightness. The legacy `R, G, B` triples (composed via rgba(var(--*-rgb),a)
  // at call sites) are the same ramp picks decoded to sRGB.
  // Names already covered by the core layers (--font-*, --accent, --radius*)
  // are intentionally not re-emitted here.
  cp: (seed, dark) => {
    const u = (n: number) => `calc(var(--space-unit) * ${n})`;
    const p = (name: string, L: number, a?: number) => pick(seed, name, L, a);
    // sRGB triple of a ramp pick, for legacy rgba(var(--*-rgb), a) call sites.
    const triple = (name: string, targetL: number): string => {
      const steps =
        name === "neutral"
          ? neutralRamp(seed)
          : ramp(anchorByName(seed, name), seed.color.lightness_steps);
      const enc = (v: number) => {
        const c = Math.min(1, Math.max(0, v));
        return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
      };
      return oklchToLinearSrgb(steps[nearestL(steps, targetL)]).map(enc).join(", ");
    };
    // [name, warm/light value, neutral/dark value]; null dark = light cascades.
    const rows: Array<[string, string, string | null]> = [
      // The legacy commonplace file pinned --color-paper light for both
      // themes, but the site treats it as theme-swapping (global.css @theme):
      // route it through the live semantic so both consumers agree.
      ["--color-paper", "var(--surface-0)", "var(--surface-0)"],
      // Chrome shell
      ["--cp-chrome", p("neutral", 0.228), p("neutral", 0.219)],
      ["--cp-chrome-mid", p("neutral", 0.254), p("neutral", 0.253)],
      ["--cp-chrome-raise", p("neutral", 0.287), p("neutral", 0.291)],
      ["--cp-chrome-line", p("neutral", 0.332), p("neutral", 0.35)],
      ["--cp-chrome-text", p("neutral", 0.879), null],
      ["--cp-chrome-muted", p("neutral", 0.636), p("neutral", 0.624)],
      ["--cp-chrome-dim", p("neutral", 0.597), null],
      // Sidebar
      ["--cp-sidebar", p("neutral", 0.331), p("neutral", 0.197)],
      ["--cp-sidebar-surface", p("neutral", 0.906, 0.045), p("neutral", 1, 0.025)],
      ["--cp-sidebar-surface-hover", p("neutral", 0.906, 0.075), p("neutral", 1, 0.05)],
      ["--cp-sidebar-text", p("neutral", 0.906), p("neutral", 0.928)],
      ["--cp-sidebar-text-muted", p("neutral", 0.782), p("neutral", 0.684)],
      ["--cp-sidebar-text-faint", p("neutral", 0.733), p("neutral", 0.577)],
      ["--cp-sidebar-border", p("neutral", 0.906, 0.08), p("neutral", 1, 0.05)],
      ["--cp-sidebar-border-strong", p("neutral", 0.906, 0.13), p("neutral", 1, 0.08)],
      ["--cp-sidebar-edge", p("neutral", 0.906, 0.1), p("neutral", 1, 0.05)],
      // Content surfaces
      ["--cp-bg", p("neutral", 0.932), p("neutral", 0.219)],
      ["--cp-surface", p("neutral", 0.96), p("neutral", 0.253)],
      ["--cp-surface-hover", p("neutral", 0.891), p("neutral", 0.291)],
      ["--cp-card", p("neutral", 0.96), p("neutral", 0.237)],
      ["--cp-card-hover", p("neutral", 0.923), p("neutral", 0.274)],
      // Text
      ["--cp-text", p("neutral", 0.266), p("neutral", 0.958)],
      ["--cp-text-muted", p("neutral", 0.49), p("neutral", 0.795)],
      ["--cp-text-faint", p("neutral", 0.519), p("neutral", 0.67)],
      ["--cp-text-ghost", p("neutral", 0.519), null],
      // Accent: burnt-orange pencil (light) / oxblood (dark)
      ["--cp-burnt-orange", p("brand", 0.536), null],
      ["--cp-burnt-orange-rgb", triple("brand", 0.536), null],
      ["--cp-burnt-orange-light", p("brand", 0.55), null],
      ["--cp-oxblood", "var(--cp-burnt-orange)", p("brand", 0.437)],
      ["--cp-oxblood-rgb", "var(--cp-burnt-orange-rgb)", triple("brand", 0.437)],
      ["--cp-oxblood-light", "var(--cp-burnt-orange-light)", p("brand", 0.437)],
      ["--cp-oxblood-light-rgb", "var(--cp-burnt-orange-rgb)", triple("brand", 0.437)],
      ["--cp-red", "var(--cp-burnt-orange)", "var(--cp-oxblood)"],
      ["--cp-red-rgb", "var(--cp-burnt-orange-rgb)", "var(--cp-oxblood-rgb)"],
      ["--cp-red-soft", p("brand", 0.536, 0.07), p("brand", 0.233)],
      ["--cp-red-line", p("brand", 0.536, 0.24), p("brand", 0.437, 0.28)],
      ["--cp-red-glow", p("brand", 0.536, 0.16), p("brand", 0.437, 0.18)],
      ["--cp-accent", "var(--cp-red)", null],
      ["--cp-terracotta", "var(--cp-red)", null],
      ["--cp-terracotta-light", "var(--cp-oxblood)", null],
      ["--cp-terracotta-glow", "var(--cp-red-soft)", null],
      ["--cp-cream", p("neutral", 0.976), p("neutral", 0.97)],
      // Secondary palette (unchanged across variants)
      ["--cp-teal", p("teal", 0.456), null],
      ["--cp-teal-light", p("teal", 0.543), null],
      ["--cp-gold", p("agent", 0.71), null],
      ["--cp-gold-light", p("agent", 0.808), null],
      ["--cp-green", p("memory", 0.542), null],
      ["--cp-purple", p("teal", 0.587), null],
      ["--cp-blue", p("teal", 0.559), null],
      ["--cp-pink", p("brand", 0.591), null],
      ["--cp-amber", p("agent", 0.71), null],
      ["--cp-orange", p("brand", 0.647), null],
      ["--cp-steel", p("teal", 0.573), null],
      // Auto-organize card type tints (rgb triples)
      ["--cp-tint-email", triple("teal", 0.524), null],
      ["--cp-tint-task", triple("teal", 0.456), null],
      ["--cp-tint-note", triple("agent", 0.71), null],
      ["--cp-tint-event", triple("teal", 0.542), null],
      // Object type colors
      ["--cp-type-note", p("neutral", 0.515), p("neutral", 0.957)],
      ["--cp-type-source", p("teal", 0.456), null],
      ["--cp-type-person", "var(--cp-red)", null],
      ["--cp-type-place", p("agent", 0.71), null],
      ["--cp-type-organization", p("memory", 0.542), null],
      ["--cp-type-concept", p("teal", 0.587), null],
      ["--cp-type-quote", p("agent", 0.71), null],
      ["--cp-type-hunch", p("brand", 0.591), null],
      ["--cp-type-script", p("teal", 0.573), null],
      ["--cp-type-task", p("brand", 0.647), null],
      // Tab bar
      ["--cp-tab-bg", "var(--cp-chrome)", null],
      ["--cp-tab-border", "var(--cp-chrome-line)", null],
      // Terminal / card surfaces
      ["--cp-term", p("neutral", 0.923), p("neutral", 0.209)],
      ["--cp-term-elevated", p("neutral", 0.96), p("neutral", 0.227)],
      ["--cp-term-hover", p("neutral", 0.891), p("neutral", 0.249)],
      ["--cp-term-border", p("neutral", 0.266, 0.1), p("neutral", 1, 0.05)],
      ["--cp-term-border-hover", "rgba(var(--cp-red-rgb), 0.22)", p("brand", 0.437, 0.18)],
      ["--cp-term-text", p("neutral", 0.266), p("neutral", 0.933)],
      ["--cp-term-text-secondary", p("neutral", 0.49), p("neutral", 0.755)],
      ["--cp-term-muted", p("neutral", 0.49), p("neutral", 0.617)],
      ["--cp-term-green", p("memory", 0.678), null],
      ["--cp-term-amber", p("agent", 0.749), null],
      ["--cp-term-red", p("brand", 0.625), null],
      ["--cp-term-cyan", p("teal", 0.693), null],
      [
        "--cp-term-glow",
        `inset 0 1px 0 ${p("neutral", 1, 0.02)}, 0 10px ${u(7)} ${p("neutral", 0, 0.198)}`,
        null,
      ],
      // Borders
      ["--cp-border", p("neutral", 0.266, 0.12), p("neutral", 0.958, 0.14)],
      ["--cp-border-faint", p("neutral", 0.266, 0.08), p("neutral", 0.958, 0.08)],
      // Shadows (legacy geometry, ramp-derived colors)
      ["--cp-shadow-sm", `0 1px 2px ${p("neutral", 0.266, 0.05)}`, `0 1px 3px ${p("neutral", 0, 0.3)}`],
      [
        "--cp-shadow",
        `0 2px ${u(2)} ${p("neutral", 0.266, 0.07)}, 0 1px 3px ${p("neutral", 0.266, 0.04)}`,
        `0 2px ${u(2)} ${p("neutral", 0.21, 0.08)}`,
      ],
      [
        "--cp-shadow-lg",
        `0 ${u(1)} ${u(4)} ${p("neutral", 0.266, 0.1)}, 0 2px 6px ${p("neutral", 0.266, 0.05)}`,
        `0 ${u(2)} ${u(6)} ${p("neutral", 0.21, 0.12)}`,
      ],
      // Construction grid
      ["--cp-grid-color", p("neutral", 0.266, 0.04), p("neutral", 1, 0.012)],
      // Typography
      ["--cp-font-title", "var(--font-display)", null],
      ["--cp-font-body", "var(--font-body)", null],
      ["--cp-font-mono", "var(--font-mono)", null],
      ["--cp-font-code", "var(--font-mono)", null],
      // 14.5px UI base: 1.5px off-grid and load-bearing, so unit-derived calc.
      ["--cp-ui-font-size", "calc(var(--space-unit) * 4 - 1.5px)", null],
      ["--cp-ui-line-height", "1.45", null],
      // Font feature settings (verbatim: OpenType flags, no seed axis)
      ["--cp-kern-title", "'kern' 1, 'liga' 1, 'calt' 1, 'onum' 1", null],
      ["--cp-kern-body", "'kern' 1, 'liga' 1, 'calt' 1", null],
      ["--cp-kern-mono", "'kern' 1, 'liga' 1, 'calt' 1, 'zero' 1, 'ss01' 1, 'ss02' 1", null],
      // Spacing scale
      ["--cp-space-0", "0px", null],
      ["--cp-space-px", "var(--hairline-w)", null],
      ...[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map(
        (n) => [`--cp-space-${n}`, u(n), null] as [string, string, string | null],
      ),
      // Layout constants
      ["--cp-sidebar-width", u(64), null],
      ["--cp-shell-join-radius", "var(--cp-space-8)", null],
      ["--cp-shell-sidebar-underlay", u(58), null],
      ["--cp-shell-rail-underlay", u(13), null],
      ["--cp-shell-join-underlap", "var(--cp-shell-sidebar-underlay)", null],
      ["--cp-shell-join-border", "color-mix(in srgb, var(--cp-chrome) 12%, transparent)", null],
      [
        "--cp-shell-join-shadow",
        `${u(3)} 0 ${u(8)} color-mix(in srgb, var(--cp-chrome) 12%, transparent), 2px 0 7px color-mix(in srgb, var(--cp-chrome) 7%, transparent)`,
        null,
      ],
      [
        "--cp-shell-sidebar-shadow",
        `inset -1px 0 0 ${p("neutral", 1, 0.02)}, var(--cp-shell-join-shadow)`,
        null,
      ],
      ["--cp-grid-size", u(10), null],
      ["--cp-grid-opacity", "0.055", null],
      ["--cp-pane-gap", "var(--hairline-w)", null],
      ["--cp-tab-height", u(10), null],
      // 5px drag handle: 1px off-grid, interaction-critical hit size.
      ["--cp-drag-handle-size", "calc(var(--space-unit) + 1px)", null],
      ["--cp-safe-area-top", "env(safe-area-inset-top, 0px)", null],
      ["--cp-safe-area-bottom", "env(safe-area-inset-bottom, 0px)", null],
      ["--cp-mobile-topbar-height", u(13), null],
      ["--cp-mobile-tab-height", u(14), null],
      // Mobile shell overrides (same values in both legacy variants; the
      // networks legacy copies are covered by these emissions too)
      ["--mobile-shell-surface", p("neutral", 0.976, 0.96), null],
      ["--mobile-shell-surface-solid", "var(--cp-surface)", null],
      ["--mobile-shell-border", "var(--cp-border)", null],
      ["--mobile-shell-text", "var(--cp-text)", null],
      ["--mobile-shell-text-muted", "var(--cp-text-muted)", null],
      // Interaction tokens
      ["--cp-focus-ring", "var(--cp-red)", null],
      ["--cp-focus-ring-offset", "var(--focus-ring-offset)", null],
      ["--cp-focus-ring-width", "calc(var(--hairline-w) * 2)", null],
      ["--cp-focus-ring-sidebar", p("neutral", 0.906, 0.62), p("brand", 0.437, 0.55)],
      // Timing (trio mapped by role to keep fast < base < slow monotonic)
      ["--cp-transition-fast", "var(--motion-fast)", null],
      ["--cp-transition-base", "var(--motion)", null],
      ["--cp-transition-slow", "var(--motion-slow)", null],
      // Verbatim: overshoot spring from commonplace-tokens.css; the seed ease
      // cannot express the >1 overshoot.
      ["--cp-spring-ease", "cubic-bezier(0.34, 1.56, 0.64, 1)", null],
      ["--cp-ease-out", "var(--ease)", null],
      // Skeleton
      ["--cp-skeleton-base", "var(--cp-surface)", null],
      ["--cp-skeleton-shine", "color-mix(in srgb, var(--cp-red) 6%, var(--cp-surface))", null],
      // Discovery edge
      ["--cp-discovery-score-bg", "var(--cp-red)", null],
      ["--cp-discovery-score-text", p("neutral", 1), null],
      // Search bar
      ["--cp-search-bg", p("neutral", 0.266, 0.03), p("neutral", 1, 0.015)],
      ["--cp-search-border", p("neutral", 0.266, 0.1), "var(--cp-border-faint)"],
      ["--cp-search-focus-border", p("brand", 0.536, 0.3), p("brand", 0.437, 0.3)],
      ["--cp-search-placeholder", "var(--cp-text-faint)", null],
      // Ask Theseus
      ["--cp-ask-bg", "var(--cp-card)", null],
      ["--cp-ask-border", "var(--cp-border)", null],
      ["--cp-ask-glyph", "var(--cp-red)", null],
      ["--cp-ask-positive", p("memory", 0.542), null],
      ["--cp-ask-positive-bg", p("memory", 0.542, 0.08), null],
      ["--cp-ask-negative", p("brand", 0.576), null],
      ["--cp-ask-negative-bg", p("brand", 0.576, 0.08), null],
      ["--cp-ask-save", "var(--cp-red)", null],
      ["--cp-ask-save-bg", p("brand", 0.536, 0.1), p("brand", 0.437, 0.1)],
      // State
      ["--cp-disabled-opacity", "0.35", null],
    ];
    return rows.flatMap(([name, lightVal, darkVal]) => {
      const v = dark ? darkVal : lightVal;
      return v === null ? [] : [`${name}: ${v};`];
    });
  },
  // reader-tokens.css (--r-*): a single parchment palette at :root with no
  // dark variant, so the dark pass emits nothing and light values cascade.
  reader: (seed, dark) => {
    if (dark) return [];
    const u = (n: number) => `calc(var(--space-unit) * ${n})`;
    const p = (name: string, L: number, a?: number) => pick(seed, name, L, a);
    const rows: Array<[string, string]> = [
      // Parchment palette
      ["--r-bg", p("neutral", 0.941)],
      ["--r-bg-light", p("neutral", 0.957)],
      ["--r-cream", p("neutral", 0.98)],
      ["--r-card", p("neutral", 1)],
      ["--r-card-border", p("neutral", 0, 0.06)],
      ["--r-card-shadow", `0 1px 3px ${p("neutral", 0, 0.04)}, 0 ${u(1)} ${u(3)} ${p("neutral", 0, 0.03)}`],
      // Text hierarchy
      ["--r-text", p("neutral", 0.287)],
      ["--r-text-body", p("neutral", 0.363)],
      ["--r-text-muted", p("neutral", 0.53)],
      ["--r-text-faint", p("neutral", 0.691)],
      ["--r-text-ghost", p("neutral", 0.784)],
      // Accents
      ["--r-teal", p("teal", 0.456)],
      ["--r-teal-bg", p("teal", 0.456, 0.07)],
      ["--r-red", p("brand", 0.589)],
      ["--r-red-bg", p("brand", 0.589, 0.07)],
      ["--r-gold", p("agent", 0.71)],
      ["--r-gold-bg", p("agent", 0.71, 0.1)],
      ["--r-gold-hl", p("agent", 0.71, 0.22)],
      ["--r-purple", p("teal", 0.587)],
      ["--r-purple-bg", p("teal", 0.587, 0.07)],
      ["--r-green", p("memory", 0.542)],
      ["--r-green-bg", p("memory", 0.542, 0.07)],
      // Chrome and rules
      ["--r-rule", p("neutral", 0, 0.08)],
      ["--r-rule-light", p("neutral", 0, 0.04)],
      ["--r-focus-bg", p("teal", 0.456, 0.06)],
      ["--r-focus-border", p("teal", 0.456, 0.35)],
      // Typography
      ["--r-font-read", "var(--font-body)"],
      ["--r-font-title", "var(--font-display)"],
      ["--r-font-ui", "var(--font-mono)"],
      // 18px reading size: 2px off-grid and load-bearing for measure/rhythm.
      ["--r-font-size", "calc(var(--space-unit) * 4 + 2px)"],
    ];
    return rows.map(([name, v]) => `${name}: ${v};`);
  },
  // theseus.css .theseus-root token block (Atlas fork). Single locked palette:
  // no data-theme swap inside Theseus, so the dark pass emits nothing.
  // --accent and --font-body/--font-display/--font-mono are already emitted by
  // the core semantic/font layers and are not re-emitted here.
  theseus: (seed, dark) => {
    if (dark) return [];
    const u = (n: number) => `calc(var(--space-unit) * ${n})`;
    const p = (name: string, L: number, a?: number) => pick(seed, name, L, a);
    const rows: Array<[string, string]> = [
      // Atlas surfaces
      ["--app-base", p("neutral", 0.211)],
      ["--top-chrome", p("neutral", 0.233)],
      ["--sidebar", p("neutral", 0.185)],
      ["--panel", p("neutral", 0.275)],
      ["--panel-2", p("neutral", 0.305)],
      ["--panel-3", p("neutral", 0.341)],
      // Iridescent washes
      ["--tone-brass", p("agent", 0.681, 0.07)],
      ["--tone-rose", p("brand", 0.621, 0.05)],
      ["--tone-plum", p("teal", 0.51, 0.05)],
      ["--tone-blue", p("teal", 0.488, 0.1)],
      ["--tone-ink", p("teal", 0.35, 0.14)],
      ["--tone-bone", p("neutral", 0.905, 0.05)],
      // Patina'd solids
      ["--brass", p("agent", 0.681)],
      ["--rose", p("brand", 0.621)],
      ["--plum", p("teal", 0.51)],
      ["--blue", p("teal", 0.536)],
      ["--bone", p("neutral", 0.905)],
      // Ink (type)
      ["--ink", p("neutral", 0.901)],
      ["--ink-2", p("neutral", 0.751)],
      ["--ink-3", p("neutral", 0.579)],
      ["--ink-4", p("neutral", 0.421)],
      ["--rule", p("neutral", 0.905, 0.06)],
      ["--rule-strong", p("neutral", 0.905, 0.14)],
      // Accent roles (the semantic --accent stays with the core layer)
      ["--pencil", "var(--brass)"],
      ["--accent-color", "var(--brass)"],
      // Paper palette (Ask Correspondence surface)
      ["--paper", p("neutral", 0.953)],
      ["--paper-2", p("neutral", 0.929)],
      ["--paper-3", p("neutral", 0.894)],
      ["--paper-ink", p("neutral", 0.171)],
      ["--paper-ink-2", p("neutral", 0.27)],
      ["--paper-ink-3", p("neutral", 0.418)],
      ["--paper-rule", p("neutral", 0.753)],
      ["--paper-pencil", p("brand", 0.491)],
      // Kind colors
      ["--sage", p("memory", 0.677)],
      ["--indigo", p("teal", 0.732)],
      ["--ochre", "var(--brass)"],
      ["--teal", p("teal", 0.741)],
      ["--mauve", "var(--rose)"],
      ["--lilac", "var(--plum)"],
      // Tweakables
      ["--sidebar-w", u(55)],
      ["--grid-size", u(7)],
      ["--grid-opacity", "0.10"],
      ["--font-ui", "var(--font-body)"],
      // Legacy --vie-* aliases (re-pointed at the tokens above)
      ["--vie-bg", "var(--app-base)"],
      ["--vie-bg-subtle", "var(--panel)"],
      ["--vie-card", "var(--panel)"],
      ["--vie-code", "var(--panel-3)"],
      ["--vie-chrome-bg", "var(--sidebar)"],
      ["--vie-panel-bg", "var(--panel)"],
      ["--vie-hero-ground", "var(--app-base)"],
      ["--vie-hero-text", "var(--ink)"],
      ["--vie-text", "var(--ink)"],
      ["--vie-text-muted", "var(--ink-2)"],
      ["--vie-text-dim", "var(--ink-3)"],
      ["--vie-text-ghost", "var(--ink-4)"],
      ["--vie-border", "var(--rule-strong)"],
      ["--vie-border-light", "var(--rule)"],
      ["--vie-border-active", "color-mix(in srgb, var(--brass) 40%, transparent)"],
      ["--vie-border-focus", "var(--brass)"],
      ["--vie-shadow-sm", `0 2px 6px ${p("neutral", 0, 0.25)}`],
      ["--vie-shadow", `0 ${u(2)} ${u(5)} -6px ${p("neutral", 0, 0.38)}`],
      ["--vie-shadow-lg", `0 ${u(6)} ${u(12)} -14px ${p("neutral", 0, 0.55)}`],
      ["--vie-terra", "var(--rose)"],
      ["--vie-terra-hover", p("brand", 0.658)],
      ["--vie-terra-light", "color-mix(in srgb, var(--rose) 65%, transparent)"],
      ["--vie-teal", "var(--teal)"],
      ["--vie-teal-light", "color-mix(in srgb, var(--teal) 80%, transparent)"],
      ["--vie-amber", "var(--brass)"],
      ["--vie-amber-light", "color-mix(in srgb, var(--brass) 80%, transparent)"],
      ["--vie-purple", "var(--plum)"],
      ["--vie-success", "var(--sage)"],
      ["--vie-error", p("brand", 0.65)],
      ["--vie-type-source", "var(--teal)"],
      ["--vie-type-person", "var(--rose)"],
      ["--vie-type-concept", "var(--indigo)"],
      ["--vie-type-hunch", "var(--brass)"],
      ["--vie-type-note", "var(--lilac)"],
      ["--vie-type-claim", "var(--plum)"],
      ["--vie-type-tension", "var(--vie-error)"],
      ["--vie-engine-idle", "color-mix(in srgb, var(--teal) 70%, transparent)"],
      ["--vie-engine-active", "var(--teal)"],
      ["--vie-panel-card", "var(--panel)"],
      ["--vie-panel-hover", "var(--panel-2)"],
      ["--vie-panel-border", "var(--rule-strong)"],
      ["--vie-panel-shadow", p("neutral", 0, 0.28)],
      ["--vie-ink-1", "var(--ink)"],
      ["--vie-ink-2", "var(--ink-2)"],
      ["--vie-ink-3", "var(--ink-3)"],
      ["--vie-ink-4", "var(--ink-4)"],
      ["--vie-teal-ink", "var(--teal)"],
      ["--vie-amber-ink", "var(--brass)"],
      ["--vie-terra-ink", "var(--rose)"],
      ["--vie-surface-panel", "var(--panel)"],
      ["--vie-surface-panel-border", "var(--rule-strong)"],
      ["--vie-surface-panel-glow", "var(--vie-shadow-lg)"],
      ["--vie-font-title", "var(--font-display)"],
      ["--vie-font-body", "var(--font-body)"],
      ["--vie-font-mono", "var(--font-mono)"],
      ["--vie-font-code", "var(--font-mono)"],
    ];
    return rows.map(([name, v]) => `${name}: ${v};`);
  },
  // networks.css .networks-theme token block (--nw-*): single dark-purple
  // palette, so the dark pass emits nothing. Purples map to the cool teal
  // anchor at measured lightness (no purple anchor in the seed); the
  // --mobile-shell-* names it also defined are covered by the cp group.
  networks: (seed, dark) => {
    if (dark) return [];
    const p = (name: string, L: number, a?: number) => pick(seed, name, L, a);
    const rows: Array<[string, string]> = [
      // Backgrounds
      ["--nw-bg", p("teal", 0.215)],
      ["--nw-sidebar", p("neutral", 0.187)],
      ["--nw-surface", p("teal", 0.25)],
      ["--nw-surface-hover", p("teal", 0.28)],
      ["--nw-card", p("teal", 0.267)],
      ["--nw-card-hover", p("teal", 0.295)],
      // Text
      ["--nw-text", p("neutral", 0.957)],
      ["--nw-text-muted", p("teal", 0.666)],
      ["--nw-text-faint", p("teal", 0.503)],
      // Accent
      ["--nw-terracotta", p("brand", 0.599)],
      ["--nw-terracotta-light", p("brand", 0.694)],
      ["--nw-terracotta-glow", p("brand", 0.599, 0.15)],
      // Secondary palette
      ["--nw-teal", p("teal", 0.456)],
      ["--nw-teal-light", p("teal", 0.543)],
      ["--nw-gold", p("agent", 0.753)],
      ["--nw-gold-light", p("agent", 0.808)],
      ["--nw-green", p("memory", 0.542)],
      ["--nw-purple", p("teal", 0.587)],
      ["--nw-blue", p("teal", 0.559)],
      ["--nw-pink", p("brand", 0.591)],
      ["--nw-amber", p("agent", 0.71)],
      ["--nw-orange", p("brand", 0.647)],
      ["--nw-yellow", p("agent", 0.737)],
      // Borders
      ["--nw-border", p("neutral", 0.957, 0.08)],
      ["--nw-border-strong", p("neutral", 0.957, 0.15)],
      // Shadows (colors only in the legacy file)
      ["--nw-shadow", p("neutral", 0, 0.3)],
      ["--nw-shadow-lg", p("neutral", 0, 0.5)],
      // Typography
      ["--nw-font-title", "var(--font-display)"],
      ["--nw-font-body", "var(--font-body)"],
      ["--nw-font-mono", "var(--font-mono)"],
      ["--nw-font-code", "var(--font-mono)"],
    ];
    return rows.map(([name, v]) => `${name}: ${v};`);
  },
  // publishing_api studio-tokens.css: single light palette, so the dark pass
  // emits nothing. --font-body/--font-mono/--font-display come from the core
  // font layer; --radius/--radius-lg come from the core shape scale.
  studio: (seed, dark) => {
    if (dark) return [];
    const u = (n: number) => `calc(var(--space-unit) * ${n})`;
    const p = (name: string, L: number, a?: number) => pick(seed, name, L, a);
    const rows: Array<[string, string]> = [
      // Brand primaries
      ["--color-terracotta", p("brand", 0.569)],
      ["--color-terracotta-hover", p("brand", 0.503)],
      ["--color-terracotta-light", p("brand", 0.694)],
      ["--color-teal", p("teal", 0.456)],
      ["--color-teal-light", p("teal", 0.543)],
      ["--color-gold", p("agent", 0.71)],
      ["--color-gold-light", p("agent", 0.76)],
      // Surfaces
      ["--color-parchment", p("neutral", 0.948)],
      ["--color-parchment-alt", p("neutral", 0.91)],
      ["--color-cream", p("neutral", 0.975)],
      ["--color-dark-ground", p("neutral", 0.211)],
      ["--color-dark-surface", p("neutral", 0.272)],
      // Ink
      ["--color-ink", p("neutral", 0.266)],
      ["--color-ink-secondary", p("neutral", 0.49)],
      ["--color-ink-muted", p("neutral", 0.654)],
      // Borders
      ["--color-border", p("neutral", 0.849)],
      ["--color-border-light", p("neutral", 0.91)],
      ["--color-border-dark", p("neutral", 0.336)],
      // Sidebar (deep purple: cool teal anchor at measured lightness)
      ["--color-sidebar-purple", p("teal", 0.215)],
      // Status
      ["--color-success", p("memory", 0.542)],
      ["--color-error", p("brand", 0.522)],
      // Fonts (role-mapped onto the seed families)
      ["--font-title", "var(--font-display)"],
      ["--font-title-alt", "var(--font-display)"],
      ["--font-title-display", "var(--font-display)"],
      ["--font-body-alt", "var(--font-body)"],
      ["--font-mono-alt", "var(--font-mono)"],
      ["--font-input", "var(--font-body)"],
      // Shadows (legacy geometry, ramp-derived warm ink color)
      ["--shadow-warm-sm", `0 1px 2px ${p("neutral", 0.266, 0.05)}`],
      [
        "--shadow-warm",
        `0 2px ${u(2)} ${p("neutral", 0.266, 0.07)}, 0 1px 3px ${p("neutral", 0.266, 0.04)}`,
      ],
      [
        "--shadow-warm-lg",
        `0 ${u(1)} ${u(4)} ${p("neutral", 0.266, 0.1)}, 0 2px 6px ${p("neutral", 0.266, 0.05)}`,
      ],
      // Section color mapping
      ["--section-essays", "var(--color-terracotta)"],
      ["--section-field-notes", "var(--color-teal)"],
      ["--section-projects", "var(--color-gold)"],
      ["--section-toolkit", "var(--color-teal)"],
      ["--section-shelf", "var(--color-gold)"],
      ["--section-video", "var(--color-success)"],
      // Layout. Verbatim: 65ch measure from studio-tokens.css (ch has no seed
      // axis). --radius/--radius-lg stay with the core shape scale.
      ["--max-prose", "65ch"],
      ["--grid-unit", u(5)],
    ];
    return rows.map(([name, v]) => `${name}: ${v};`);
  },
  // harness-console globals.css token block (extracted :root + [data-theme="dark"]
  // + .rail-shell palette + --ctx-* + shell geometry + elevation + depth layers).
  console: (seed, dark) => {
    const l = !dark;
    // Neutral ramp pick as an "r, g, b" triplet: the DotGrid canvas composes
    // rgba(var(--dot-color), alpha), so these two tokens cannot be oklch().
    const rgbTriplet = (targetL: number): string => {
      const steps = neutralRamp(seed);
      const c = fitChroma(steps[nearestL(steps, targetL)]);
      const enc = (v: number): number => {
        const x = Math.min(1, Math.max(0, v));
        return Math.round(
          255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055),
        );
      };
      return oklchToLinearSrgb(c).map(enc).join(", ");
    };
    // Elevation ink: near-black neutral in light, the deepest ramp step standing
    // in for the legacy pure black in dark (deepest seed-derivable neutral).
    const shadowInk = (alpha: number) => pick(seed, "neutral", 0.19, alpha);
    const out = [
      // Measured console grounds: white page, 0.955 surface, 0.925 surface-2
      `--bg: ${l ? pick(seed, "neutral", 0.985) : "var(--surface-0)"};`,
      `--surface: ${l ? pick(seed, "neutral", 0.955) : "var(--surface-1)"};`,
      `--surface-2: ${l ? pick(seed, "neutral", 0.925) : "var(--surface-2)"};`,
      `--ink: var(--text);`,
      `--muted: var(--text-dim);`,
      `--faint: var(--text-faint);`,
      `--line: ${l ? pick(seed, "neutral", 0.22, 0.16) : pick(seed, "neutral", 0.96, 0.16)};`,
      `--line-strong: ${l ? pick(seed, "neutral", 0.22, 0.28) : pick(seed, "neutral", 0.96, 0.28)};`,
      `--ox: var(--accent);`,
      `--ox-hover: var(--accent-strong);`,
      `--ox-tint: ${pick(seed, "brand", l ? 0.49 : 0.62, l ? 0.08 : 0.12)};`,
      `--ox-ring: ${pick(seed, "brand", l ? 0.49 : 0.62, l ? 0.4 : 0.5)};`,
      `--live: ${pick(seed, "memory", l ? 0.55 : 0.7)};`,
      `--warn: ${pick(seed, "agent", l ? 0.56 : 0.72)};`,
      // Depth Layer 3: the quantized elevation scale (dark alphas from the
      // legacy dark block; the legacy pure-black casts map to the deepest step).
      `--elev-0: none;`,
      `--elev-1: 0 1px 2px ${shadowInk(l ? 0.08 : 0.4)}, 0 2px 8px ${shadowInk(l ? 0.06 : 0.3)};`,
      `--elev-2: 0 6px 24px ${shadowInk(l ? 0.12 : 0.5)}, 0 2px 8px ${shadowInk(l ? 0.08 : 0.4)};`,
      `--elev-3: 0 18px 56px ${shadowInk(l ? 0.2 : 0.6)}, 0 8px 24px ${shadowInk(l ? 0.12 : 0.5)};`,
      // Depth Layer 1: the ambient DotGrid field (RGB triplets, see rgbTriplet).
      `--dot-color: ${rgbTriplet(l ? 0.64 : 0.55)};`,
      `--dot-ink: ${rgbTriplet(l ? 0.225 : 0.955)};`,
      // The always-dark rail shell palette, top-level --rail-* names. The
      // .rail-shell scoped override in globals.css remaps its semantic names
      // (--bg, --ink, ...) onto these. Theme-stable: same values both themes.
      `--rail-bg: ${pick(seed, "neutral", 0.19)};`,
      `--rail-bg-2: ${pick(seed, "neutral", 0.225)};`,
      `--rail-bg-3: ${pick(seed, "neutral", 0.255)};`,
      `--rail-ink: ${pick(seed, "neutral", 0.955)};`,
      `--rail-muted: ${pick(seed, "neutral", 0.73)};`,
      `--rail-faint: ${pick(seed, "neutral", 0.64)};`,
      `--rail-line: ${pick(seed, "neutral", 0.955, 0.16)};`,
      `--rail-line-strong: ${pick(seed, "neutral", 0.955, 0.26)};`,
      `--rail-accent: ${pick(seed, "brand", 0.62)};`,
      `--rail-accent-hover: ${pick(seed, "brand", 0.5)};`,
      `--rail-accent-tint: ${pick(seed, "brand", 0.62, 0.16)};`,
      `--rail-accent-ring: ${pick(seed, "brand", 0.62, 0.55)};`,
      `color-scheme: ${l ? "light" : "dark"};`,
    ];
    if (l) {
      out.push(
        // Fonts resolve through the next/font source variables set on <html>
        // (--font-*-src), falling back to the real family names.
        `--font-display: var(--font-display-src, "Bricolage Grotesque"), "Bricolage Grotesque Variable", Georgia, serif;`,
        `--font-body: var(--font-body-src, "IBM Plex Sans Condensed"), -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;`,
        `--font-mono: var(--font-mono-src, "IBM Plex Mono"), ui-monospace, SFMono-Regular, Menlo, monospace;`,
        // Context-Theorem-UI tokens (ported Theseus paper palette for /browser),
        // consolidated onto the console neutral + brand ramps. Theme-stable.
        `--ctx-paper: ${pick(seed, "neutral", 0.955)};`,
        `--ctx-paper-soft: ${pick(seed, "neutral", 0.925)};`,
        `--ctx-ink: ${pick(seed, "neutral", 0.255)};`,
        `--ctx-ink-soft: ${pick(seed, "neutral", 0.37)};`,
        `--ctx-ink-mute: ${pick(seed, "neutral", 0.55)};`,
        `--ctx-rule: ${pick(seed, "neutral", 0.81)};`,
        `--ctx-rule-soft: ${pick(seed, "neutral", 0.88)};`,
        `--ctx-accent: ${pick(seed, "brand", 0.55)};`,
        `--ctx-font-mono: var(--font-mono);`,
        // Running-text measure and depth-layer constants (theme-stable).
        `--measure: 68ch;`,
        `--backdrop-blur: calc(var(--space-unit) * 2);`,
        `--glow-border-width: calc(var(--hairline-w) * 1.5);`,
        `--blueprint-opacity: 0.05;`,
        `--blueprint-size: calc(var(--space-unit) * 10);`,
        `--hover-lift: calc(var(--hairline-w) * -1);`,
        // Shell geometry on the space grid.
        `--rail-w: calc(var(--space-unit) * 57);`,
        `--topbar-h: calc(var(--space-unit) * 14);`,
      );
    }
    return out;
  },
  // apps/desktop tokens.css names. Note: the desktop app predates the
  // semantic surface convention, so --surface-2/--surface-3 here override
  // the semantic layer with the legacy (darker-tertiary) meaning its
  // components expect. Alias groups always emit after semantics on purpose.
  desktop: (seed, dark) => {
    const l = !dark;
    // Warm shadow ink: rgba(30,22,18)/rgba(20,14,12) in the legacy file, the
    // deepest neutral steps here. Dark casts/alphas come from the legacy dark
    // block; the light inset highlight is the paper-edge near-white.
    const shadowInk = (alpha: number) =>
      pick(seed, "neutral", l ? 0.2 : 0.19, alpha);
    return [
      `--bg: var(--surface-0);`,
      `--surface: var(--surface-1);`,
      `--surface-2: ${l ? pick(seed, "neutral", 0.88) : pick(seed, "neutral", 0.255)};`,
      `--surface-3: ${l ? pick(seed, "neutral", 0.81) : pick(seed, "neutral", 0.3)};`,
      `--rule: var(--border);`,
      `--grid-rule: ${pick(seed, "neutral", l ? 0.8 : 0.3, l ? 0.4 : 0.25)};`,
      `--grid-size: calc(var(--space-unit) * 6);`,
      `--font-ui: var(--font-body);`,
      `--font-ui-condensed: var(--font-body);`,
      // Legacy rhythm bridge: the hand-authored scale jumped 16 -> 24 at step
      // 5; the parametric scale inserts 20 there. Desktop chrome geometry is
      // fixed (not fluid), so step 5 keeps its legacy 24px meaning, same as
      // the --surface-2/--surface-3 overrides above.
      `--space-5: calc(var(--space-unit) * 6);`,
      // Memory/grounding is the oxblood pencil in the desktop story (the seed's
      // green memory anchor is reserved for the categorical hues below).
      `--accent-memory: var(--accent);`,
      `--accent-memory-soft: var(--accent-soft);`,
      `--ease-emphasized: cubic-bezier(0.2, 0, 0, 1);`,
      ...(l
        ? [
            `--shadow-1: 0 1px 2px ${shadowInk(0.08)}, 0 1px 1px ${shadowInk(0.06)};`,
            `--shadow-2: 0 4px 16px ${shadowInk(0.12)};`,
            `--shadow-pop: 0 18px 44px -18px ${shadowInk(0.3)}, inset 0 1px 0 ${pick(seed, "neutral", 0.98, 0.45)};`,
          ]
        : [
            `--shadow-1: 0 1px 2px ${shadowInk(0.42)};`,
            `--shadow-2: 0 6px 20px ${shadowInk(0.54)};`,
            `--shadow-pop: 0 18px 40px -16px ${shadowInk(0.62)}, inset 0 1px 0 ${pick(seed, "neutral", 0.9, 0.1)};`,
          ]),
      // Reserve categorical hues. Purples consolidate onto the teal anchor
      // (the same move as theseus --plum); with no blue-purple anchor in the
      // seed, indigo/teal/lilac stay distinguishable by lightness step.
      `--cat-sage: ${pick(seed, "memory", 0.68)};`,
      `--cat-indigo: ${pick(seed, "teal", 0.81)};`,
      `--cat-teal: ${pick(seed, "teal", 0.74)};`,
      `--cat-mauve: ${pick(seed, "brand", 0.62)};`,
      `--cat-lilac: ${pick(seed, "teal", 0.51)};`,
      `--cat-ochre: ${pick(seed, "agent", 0.68)};`,
      `--sidebar-w: calc(var(--space-unit) * 62);`,
      `--rail-w: calc(var(--space-unit) * 90);`,
      `--omnibox-h: calc(var(--space-unit) * 14 + 2px);`,
      `--titlebar-h: calc(var(--space-unit) * 9 + 2px);`,
    ];
  },
};

// ---------------------------------------------------------------------------
// Tailwind v4 @theme bridge
// ---------------------------------------------------------------------------

function emitTailwindTheme(seed: Seed): string {
  const lines: string[] = [];
  // Plain @theme, not `@theme inline`: inline resolves var() references at
  // build time, freezing the light values into utilities and breaking the
  // dark swap. Plain @theme emits live references.
  lines.push(`@theme {`);
  lines.push(`  --color-surface-0: var(--surface-0);`);
  lines.push(`  --color-surface-1: var(--surface-1);`);
  lines.push(`  --color-surface-2: var(--surface-2);`);
  lines.push(`  --color-ink: var(--text);`);
  lines.push(`  --color-ink-dim: var(--text-dim);`);
  lines.push(`  --color-ink-faint: var(--text-faint);`);
  lines.push(`  --color-accent: var(--accent);`);
  lines.push(`  --color-accent-memory: var(--accent-memory);`);
  lines.push(`  --color-accent-agent: var(--accent-agent);`);
  lines.push(`  --color-hairline: var(--border);`);
  const steps = typeScale(seed.type);
  for (const s of steps) {
    const label = s.n < 0 ? `n${Math.abs(s.n)}` : `${s.n}`;
    const varLabel = s.n < 0 ? `-${Math.abs(s.n)}` : `${s.n}`;
    lines.push(`  --text-step-${label}: var(--text-${varLabel});`);
  }
  lines.push(`  --font-cp-display: var(--font-display);`);
  lines.push(`  --font-cp-body: var(--font-body);`);
  lines.push(`  --font-cp-mono: var(--font-mono);`);
  lines.push(`  --radius-token: var(--radius);`);
  lines.push(`  --ease-token: var(--ease);`);
  lines.push(`}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// File assembly
// ---------------------------------------------------------------------------

function block(selector: string, vars: string[], indent = "  "): string {
  return `${selector} {\n${vars.map((v) => indent + v).join("\n")}\n}`;
}

function generate(seed: Seed, opts: { tailwind: boolean; dark: string; aliases: string[] }): string {
  const parts: string[] = [];
  parts.push(
    `/* GENERATED by generate-tokens.ts from ${seed.product}.seed.json.\n` +
      ` * Do not edit by hand: change the seed and regenerate.\n` +
      ` * SPEC-PARAMETRIC-DESIGN-SYSTEM: every value below derives from the seed. */`,
  );

  const lightVars = [
    ...emitScales(seed),
    ...emitMotion(seed),
    ...emitFonts(seed),
    ...emitRamps(seed),
    ...emitSemantics(seed, false),
    ...opts.aliases.flatMap((g) => aliasGroup(g)(seed, false)),
  ];
  parts.push(block(":root", lightVars));

  const darkVars = [
    ...emitSemantics(seed, true),
    ...opts.aliases.flatMap((g) => aliasGroup(g)(seed, true)),
  ];
  if (opts.dark === "media") {
    parts.push(`@media (prefers-color-scheme: dark) {\n${block("  :root", darkVars, "    ")}\n}`);
  } else {
    parts.push(block(`html[data-theme="dark"]`, darkVars));
  }

  // Reduced motion is not optional: the trio and stagger resolve to zero.
  parts.push(
    `@media (prefers-reduced-motion: reduce) {\n` +
      block(
        "  :root",
        ["--motion-fast: 0ms;", "--motion: 0ms;", "--motion-slow: 0ms;", "--stagger: 0ms;"],
        "    ",
      ) +
      `\n}`,
  );

  if (opts.tailwind) parts.push(emitTailwindTheme(seed));
  return parts.join("\n\n") + "\n";
}

function aliasGroup(name: string): AliasEmitter {
  const g = ALIAS_GROUPS[name];
  if (!g) throw new Error(`unknown alias group "${name}" (have: ${Object.keys(ALIAS_GROUPS).join(", ")})`);
  return g;
}

// ---------------------------------------------------------------------------
// Self-check: prove the invariants instead of eyeballing them
// ---------------------------------------------------------------------------

function check(seed: Seed, output: string): string[] {
  const failures: string[] = [];
  const assert = (cond: boolean, msg: string) => {
    if (!cond) failures.push(msg);
  };

  const steps = typeScale(seed.type);
  for (let i = 1; i < steps.length; i++)
    assert(steps[i].min > steps[i - 1].min && steps[i].max > steps[i - 1].max, `type scale not monotonic at step ${steps[i].n}`);
  const base = steps.find((s) => s.n === 0);
  assert(!!base && base.max >= 15, `body base below 15px at max viewport`);

  const spaces = spaceScale(seed);
  for (let i = 1; i < spaces.length; i++) assert(spaces[i] > spaces[i - 1], `space scale not monotonic at ${i}`);
  for (const s of spaces) assert(s % seed.space.unit_px === 0, `space ${s}px off the ${seed.space.unit_px}px grid`);

  for (const dark of [false, true]) {
    const th = themeOf(neutralRamp(seed), dark);
    const label = dark ? "dark" : "light";
    assert(contrastRatio(th.text, th.surface1) >= 4.5, `${label}: text on surface-1 below 4.5:1 (${contrastRatio(th.text, th.surface1).toFixed(2)})`);
    assert(contrastRatio(th.textDim, th.surface1) >= 4.5, `${label}: text-dim on surface-1 below 4.5:1 (${contrastRatio(th.textDim, th.surface1).toFixed(2)})`);
    assert(contrastRatio(th.textFaint, th.surface1) >= 3, `${label}: text-faint on surface-1 below 3:1 (${contrastRatio(th.textFaint, th.surface1).toFixed(2)})`);
    // Surface step rule: surface-0/1/2 sit on adjacent ramp steps.
    const ls = seed.color.lightness_steps;
    const idx = (c: Lch) => ls.findIndex((L) => Math.abs(L - c.L) < 1e-6);
    const [i0, i1, i2] = [idx(th.surface0), idx(th.surface1), idx(th.surface2)];
    assert(
      Math.abs(i0 - i1) === 1 && Math.abs(i1 - i2) === 1,
      `${label}: surface step rule broken (ramp indices ${i0}, ${i1}, ${i2})`,
    );
  }

  assert(output.includes("prefers-reduced-motion"), "missing reduced-motion zeroing block");
  assert(!/NaN|undefined|Infinity/.test(output), "output contains NaN/undefined/Infinity");
  assert(output.includes("--focus-ring:"), "missing focus ring");
  assert((seed.motion.fast_ms >= 100 && seed.motion.slow_ms <= 500), "motion trio outside 100-500ms");
  return failures;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);

  const [seedPath, outPath] = positional;
  if (!seedPath) {
    console.error("usage: generate-tokens.ts <seed.json> <out.css> [--tailwind] [--dark attr|media] [--aliases a,b] [--check]");
    process.exit(2);
  }
  const seed: Seed = JSON.parse(readFileSync(seedPath, "utf8"));
  const opts = {
    tailwind: has("tailwind"),
    dark: flag("dark") ?? "attr",
    aliases: (flag("aliases") ?? "").split(",").filter(Boolean),
  };
  const output = generate(seed, opts);

  const failures = check(seed, output);
  if (failures.length) {
    console.error(`design-seed check FAILED for ${seed.product}:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  if (has("check")) {
    console.log(`design-seed check PASSED for ${seed.product} (type, space, contrast, surface-step, motion, focus).`);
    return;
  }
  if (!outPath) {
    console.error("missing <out.css>");
    process.exit(2);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output);
  console.log(`wrote ${outPath} (${output.length} bytes) from ${seedPath}`);
}

main();
