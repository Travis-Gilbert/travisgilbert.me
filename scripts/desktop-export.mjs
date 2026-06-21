// Build a static export for the Tauri desktop wrap (SPEC-9 D3).
//
// The API route handlers (src/app/api/*) are POST proxies the desktop bypasses
// (it calls the local engine directly per D2), and POST route handlers cannot be
// statically exported. So we move them aside for the export build and restore
// them after (always, even on failure). The export lands in `out/`, which the
// Tauri shell points `frontendDist` at.

import { execFileSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';

const API = 'src/app/api';
const PARKED = 'src/app/_api_parked';
const NEXT_BIN = 'node_modules/.bin/next';

function restore() {
  if (existsSync(PARKED) && !existsSync(API)) renameSync(PARKED, API);
}

// Restore on an abrupt interrupt too.
process.on('SIGINT', () => {
  restore();
  process.exit(1);
});

try {
  if (existsSync(API) && !existsSync(PARKED)) renameSync(API, PARKED);
  // No shell: the binary + args are passed directly (no injection surface).
  execFileSync(NEXT_BIN, ['build'], {
    stdio: 'inherit',
    env: { ...process.env, DESKTOP_EXPORT: '1' },
  });
} finally {
  restore();
}
