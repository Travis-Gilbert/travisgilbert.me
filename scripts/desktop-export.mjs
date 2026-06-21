// Build a SLIM static export for the Tauri desktop wrap (SPEC-9 D3).
//
// travisgilbert.me is a full personal site; a whole-site `output: export` is
// blocked by site routes the desktop never uses (opengraph-image, sitemap,
// robots, manifest, rss, route handlers, force-dynamic studio pages, the other
// route groups). The desktop only needs the CommonPlace surface, so for the
// export build we PARK everything under src/app except the (commonplace) route
// group and the shared root files (layout, globals, fonts, not-found), build the
// static export into `out/`, then restore. The Tauri shell points frontendDist
// at `out/`. Restoration always runs (incl. on interrupt).

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const APP = 'src/app';
const PARK = 'src/app/_parked';
const NEXT_BIN = 'node_modules/.bin/next';

// Kept in the export: the CommonPlace surface + the shared root scaffold.
const KEEP = new Set([
  '(commonplace)',
  'layout.tsx',
  'globals.css',
  'fonts.ts',
  'not-found.tsx',
  '_parked',
]);

function park() {
  if (!existsSync(PARK)) mkdirSync(PARK);
  for (const entry of readdirSync(APP)) {
    if (KEEP.has(entry)) continue;
    renameSync(join(APP, entry), join(PARK, entry));
  }
}

function restore() {
  if (!existsSync(PARK)) return;
  for (const entry of readdirSync(PARK)) {
    renameSync(join(PARK, entry), join(APP, entry));
  }
  rmdirSync(PARK);
}

process.on('SIGINT', () => {
  restore();
  process.exit(1);
});

try {
  park();
  // No shell: binary + args passed directly (no injection surface).
  execFileSync(NEXT_BIN, ['build'], {
    stdio: 'inherit',
    env: { ...process.env, DESKTOP_EXPORT: '1' },
  });
  // The slim export has no root '/' (the homepage route group is parked), so the
  // CommonPlace surface lands at /commonplace.html. Tauri loads index.html by
  // default, so emit one that bounces to the CommonPlace entry.
  writeFileSync(
    'out/index.html',
    '<!doctype html><html><head><meta charset="utf-8"><title>CommonPlace</title>' +
      '<meta http-equiv="refresh" content="0; url=./commonplace.html"></head>' +
      '<body><script>location.replace("./commonplace.html")</script></body></html>\n',
  );
} finally {
  restore();
}
