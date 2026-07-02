#!/usr/bin/env node
/**
 * Token migration coverage oracle (SPEC-PARAMETRIC-DESIGN-SYSTEM D4).
 *
 * For each legacy token file being retired, every custom property it DEFINED
 * must still be defined after migration, either by the generated tokens file
 * or by a surviving stylesheet. A dangling var() reference renders as unset,
 * which is exactly the silent breakage this gate exists to catch.
 *
 * Usage: node scripts/check-token-coverage.mjs <legacy.css>... --against <gen.css>[,<other.css>...]
 * Exits 1 and lists missing property names if coverage is incomplete.
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const sep = args.indexOf("--against");
if (sep < 0) {
  console.error("usage: check-token-coverage.mjs <legacy.css>... --against <gen.css>,<more.css>");
  process.exit(2);
}
const legacyFiles = args.slice(0, sep);
const againstFiles = args[sep + 1].split(",");

const DEF_RE = /(^|[\s{;])(--[a-zA-Z0-9-]+)\s*:/gm;

function definedProps(file) {
  const css = readFileSync(file, "utf8");
  const props = new Set();
  for (const m of css.matchAll(DEF_RE)) props.add(m[2]);
  return props;
}

const provided = new Set();
for (const f of againstFiles) for (const p of definedProps(f)) provided.add(p);

let missingTotal = 0;
for (const f of legacyFiles) {
  const missing = [...definedProps(f)].filter((p) => !provided.has(p));
  if (missing.length) {
    console.error(`${f}: ${missing.length} properties not covered:`);
    for (const p of missing) console.error(`  ${p}`);
    missingTotal += missing.length;
  } else {
    console.log(`${f}: fully covered`);
  }
}
process.exit(missingTotal ? 1 : 0);
