'use client';

import { useReducedMotion } from 'motion/react';

export const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 400, damping: 30 },
  natural: { type: 'spring' as const, stiffness: 300, damping: 25 },
  gentle: { type: 'spring' as const, stiffness: 200, damping: 20 },
  critical: { type: 'spring' as const, stiffness: 400, damping: 40 },
};

/** Fade + slide left exit for dismissed items */
export const DISMISS_EXIT = { opacity: 0, x: -40 };

/** Scale-down exit for promoted/applied items */
export const SHRINK_EXIT = { opacity: 0, scale: 0.8 };

/** Crossfade for workshop card swap */
export const CROSSFADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Hook: returns spring config respecting reduced motion */
export function useSpring(preset: keyof typeof SPRING) {
  const reduced = useReducedMotion();
  if (reduced) return { duration: 0 };
  return SPRING[preset];
}
