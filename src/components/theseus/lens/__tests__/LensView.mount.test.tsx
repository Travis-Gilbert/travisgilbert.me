/**
 * Mount integration test: verifies that LensView imports and renders all
 * 4 Tier 3 panel components (LensPropertiesStrip, LensDossier,
 * LensTimeline, LensNodeSwitcher).
 *
 * Because no jsdom or happy-dom environment is installed in this project,
 * we test the structural contract by inspecting the source text of
 * LensView.tsx directly. This is intentional: the test goes RED when the
 * imports are missing and GREEN once they are present. It catches exactly
 * the discipline failure described in the Stage 7 task brief — components
 * written but never mounted.
 *
 * A companion smoke test calls each panel module to confirm it exports a
 * default function, which catches typos in the import paths without a
 * full render pass.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LENS_DIR = resolve(__dirname, '..');
const lensViewSrc = readFileSync(resolve(LENS_DIR, 'LensView.tsx'), 'utf-8');

// ── Source-level import assertions ───────────────────────────────────────────

describe('LensView: panel imports are present', () => {
  it('imports LensPropertiesStrip', () => {
    expect(lensViewSrc).toMatch(/import\s+LensPropertiesStrip/);
  });

  it('imports LensDossier', () => {
    expect(lensViewSrc).toMatch(/import\s+LensDossier/);
  });

  it('imports LensTimeline', () => {
    expect(lensViewSrc).toMatch(/import\s+LensTimeline/);
  });

  it('imports LensNodeSwitcher', () => {
    expect(lensViewSrc).toMatch(/import\s+LensNodeSwitcher/);
  });
});

// ── Source-level JSX render assertions ──────────────────────────────────────

describe('LensView: panels are rendered in JSX', () => {
  it('renders <LensPropertiesStrip', () => {
    expect(lensViewSrc).toMatch(/<LensPropertiesStrip/);
  });

  it('renders <LensDossier', () => {
    expect(lensViewSrc).toMatch(/<LensDossier/);
  });

  it('renders <LensTimeline', () => {
    expect(lensViewSrc).toMatch(/<LensTimeline/);
  });

  it('renders <LensNodeSwitcher', () => {
    expect(lensViewSrc).toMatch(/<LensNodeSwitcher/);
  });
});

// ── Panel module smoke: each file exports a default function ─────────────────

describe('LensView: panel modules export a default component', () => {
  it('LensPropertiesStrip has a default export', async () => {
    const mod = await import('../LensPropertiesStrip');
    expect(typeof mod.default).toBe('function');
  });

  it('LensDossier has a default export', async () => {
    const mod = await import('../LensDossier');
    expect(typeof mod.default).toBe('function');
  });

  it('LensTimeline has a default export', async () => {
    const mod = await import('../LensTimeline');
    expect(typeof mod.default).toBe('function');
  });

  it('LensNodeSwitcher has a default export', async () => {
    const mod = await import('../LensNodeSwitcher');
    expect(typeof mod.default).toBe('function');
  });
});
