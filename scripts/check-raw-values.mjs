#!/usr/bin/env node
/**
 * Raw-visual-literal gate (SPEC-PARAMETRIC-DESIGN-SYSTEM D4).
 *
 * Components consume tokens only: a raw color, pixel size, or duration
 * literal outside the generated token layer is a defect. This gate scans
 * source stylesheets and components and fails on violations, mirroring the
 * no-raw-hex rule the desktop tokens already stated.
 *
 * Usage: node scripts/check-raw-values.mjs [--staged] [--max N] [paths...]
 *   default paths: src
 *   --staged: only files staged in git (for a pre-commit hook)
 *   --max N: ratchet mode for legacy trees; fails only if the violation
 *            count EXCEEDS N. Lower N as debt burns down, never raise it.
 *
 * Allowed locations for raw values:
 *   - *.gen.css (generated tokens)
 *   - design/seeds/ (the seeds themselves)
 *   - anything in ALLOWLIST below (fixtures, third-party ports, svg data)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

const ALLOWLIST = [
  /\.gen\.css$/,
  /design\/seeds\//,
  /node_modules/,
  /\.test\.|\.spec\./,
  /public\//,
  // Legacy surfaces scheduled for their own migration passes keep raw values
  // until their token blocks are regenerated; new code cannot cite them as
  // precedent. Shrink this list, never grow it.
  /src\/styles\/theseus\.css$/,
  /src\/styles\/networks\.css$/,
  /src\/styles\/studio\.css$/,
  /src\/styles\/global\.css$/,
];

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const COLOR_FN_RE = /\b(?:rgba?|hsla?|oklch|oklab|color)\(\s*[\d.]/g;
const DURATION_RE = /(?<![\w-])\d{2,4}ms\b/g;

// Only these file types carry visual declarations worth gating.
const EXTS = new Set([".css", ".scss", ".tsx", ".jsx"]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      yield* walk(p);
    } else if (EXTS.has(extname(p))) {
      yield p;
    }
  }
}

const args = process.argv.slice(2);
const staged = args.includes("--staged");
const maxIndex = args.indexOf("--max");
const maxAllowed = maxIndex >= 0 ? Number(args[maxIndex + 1]) : 0;
// Only skip the value slot after --max when the flag is actually present;
// with maxIndex === -1 the old check dropped the first positional path.
const roots = args.filter((a, i) => !a.startsWith("--") && (maxIndex < 0 || i !== maxIndex + 1));

let files = [];
if (staged) {
  files = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => EXTS.has(extname(f)));
} else {
  for (const root of roots.length ? roots : ["src"]) files.push(...walk(root));
}

let violations = 0;
for (const file of files) {
  if (ALLOWLIST.some((re) => re.test(file))) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    // Skip comments and svg/image data URIs; fill="currentColor" etc is fine.
    const stripped = line.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "");
    if (/data:image|url\(/.test(stripped)) return;
    for (const re of [HEX_RE, COLOR_FN_RE, DURATION_RE]) {
      re.lastIndex = 0;
      const m = re.exec(stripped);
      if (m) {
        // Colors inside var() fallbacks still count; durations of 0ms do not.
        if (re === DURATION_RE && /^0+ms/.test(m[0])) continue;
        console.error(`${file}:${i + 1}: raw visual literal "${m[0]}"`);
        violations++;
      }
    }
  });
}

if (violations > maxAllowed) {
  console.error(`\n${violations} raw visual literal(s)${maxAllowed ? ` (ratchet allows ${maxAllowed})` : ""}. Move them into the seed/generator (tokens.gen.css) instead.`);
  process.exit(1);
}
if (maxAllowed && violations) {
  console.log(`ratchet holding: ${violations}/${maxAllowed} raw literals (shrink-only; lower --max as debt burns down).`);
} else {
  console.log(`raw-value gate clean (${files.length} files).`);
}
