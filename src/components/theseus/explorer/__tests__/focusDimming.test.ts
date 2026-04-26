/**
 * Pins the Tier-1 focus dimming tier semantics ported from
 * references/atlas-explorer.jsx onto the cosmos.gl canvas. The
 * helpers compute alpha and size multipliers per point given a
 * focused id, hover id, and 1-hop neighbor set; they are pure data
 * and trivially unit-testable independent of cosmos.gl.
 */

import { describe, expect, it } from 'vitest';
import {
  focusOpacityFor,
  focusSizeMultFor,
  linkTierFor,
  EDGE_TIER_COLORS,
  TIER_OPACITIES,
  TIER_SIZE_MULT,
} from '../focusDimming';

describe('focusOpacityFor', () => {
  it('returns defaultNoFocus when no focus is set', () => {
    const nbrs = new Set<string>();
    expect(focusOpacityFor('a', null, null, nbrs)).toBe(TIER_OPACITIES.defaultNoFocus);
    expect(focusOpacityFor('b', null, 'a', nbrs)).toBe(TIER_OPACITIES.defaultNoFocus);
  });

  it('returns the focused tier on the focused id', () => {
    const nbrs = new Set<string>(['b', 'c']);
    expect(focusOpacityFor('a', 'a', null, nbrs)).toBe(TIER_OPACITIES.focused);
  });

  it('returns the hover tier on the hover id when not focused', () => {
    const nbrs = new Set<string>();
    expect(focusOpacityFor('b', 'a', 'b', nbrs)).toBe(TIER_OPACITIES.hover);
  });

  it('returns the neighbor tier for 1-hop neighbors', () => {
    const nbrs = new Set<string>(['b', 'c']);
    expect(focusOpacityFor('b', 'a', null, nbrs)).toBe(TIER_OPACITIES.neighbor);
    expect(focusOpacityFor('c', 'a', null, nbrs)).toBe(TIER_OPACITIES.neighbor);
  });

  it('returns the dimmed tier for non-focus / non-neighbor / non-hover points', () => {
    const nbrs = new Set<string>(['b']);
    expect(focusOpacityFor('z', 'a', null, nbrs)).toBe(TIER_OPACITIES.dimmed);
  });

  it('focused beats hover when ids match', () => {
    const nbrs = new Set<string>();
    // hover === focused: focused tier wins (full opacity).
    expect(focusOpacityFor('a', 'a', 'a', nbrs)).toBe(TIER_OPACITIES.focused);
  });
});

describe('linkTierFor', () => {
  it('returns defaultNoFocus when no focus is set', () => {
    const incident = new Set<string>();
    expect(linkTierFor('a', 'b', null, null, incident)).toBe('defaultNoFocus');
  });

  it('returns incident when the link key matches either orientation', () => {
    const incident = new Set<string>(['a|b']);
    expect(linkTierFor('a', 'b', 'a', null, incident)).toBe('incident');
    expect(linkTierFor('b', 'a', 'a', null, incident)).toBe('incident');
  });

  it('returns hovered when neither endpoint is incident but one is hovered', () => {
    const incident = new Set<string>();
    expect(linkTierFor('z', 'h', 'a', 'h', incident)).toBe('hovered');
  });

  it('returns dimmed for non-incident, non-hovered links when focus is set', () => {
    const incident = new Set<string>();
    expect(linkTierFor('z', 'y', 'a', null, incident)).toBe('dimmed');
  });

  it('exposes RGBA tuples and a width per tier', () => {
    expect(EDGE_TIER_COLORS.incident.a).toBe(0.85);
    expect(EDGE_TIER_COLORS.dimmed.a).toBe(0.10);
    expect(EDGE_TIER_COLORS.incident.width).toBeGreaterThan(EDGE_TIER_COLORS.dimmed.width);
  });
});

describe('focusSizeMultFor', () => {
  it('returns the defaultNoFocus multiplier when no focus is set', () => {
    const nbrs = new Set<string>();
    expect(focusSizeMultFor('a', null, null, nbrs)).toBe(TIER_SIZE_MULT.defaultNoFocus);
  });

  it('returns 4.6x on the focused id (ports atlas-explorer baseR * 4.6)', () => {
    const nbrs = new Set<string>(['b']);
    expect(focusSizeMultFor('a', 'a', null, nbrs)).toBe(4.6);
    expect(focusSizeMultFor('a', 'a', null, nbrs)).toBe(TIER_SIZE_MULT.focused);
  });

  it('returns 3.0x on neighbors (ports atlas-explorer baseR * 3.0)', () => {
    const nbrs = new Set<string>(['b', 'c']);
    expect(focusSizeMultFor('b', 'a', null, nbrs)).toBe(3.0);
    expect(focusSizeMultFor('b', 'a', null, nbrs)).toBe(TIER_SIZE_MULT.neighbor);
  });

  it('returns 3.6x on hover (between neighbor and focus)', () => {
    const nbrs = new Set<string>();
    expect(focusSizeMultFor('b', 'a', 'b', nbrs)).toBe(3.6);
    expect(focusSizeMultFor('b', 'a', 'b', nbrs)).toBe(TIER_SIZE_MULT.hover);
  });

  it('returns 2.4x for dimmed points (smallest tier)', () => {
    const nbrs = new Set<string>();
    expect(focusSizeMultFor('z', 'a', null, nbrs)).toBe(2.4);
    expect(focusSizeMultFor('z', 'a', null, nbrs)).toBe(TIER_SIZE_MULT.dimmed);
  });
});
