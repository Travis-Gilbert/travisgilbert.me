'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import { annotate } from 'rough-notation';
import { useThemeVersion, readCssVar } from '@/hooks/useThemeColor';

interface RoughUnderlineProps {
  children: ReactNode;
  type?: 'underline' | 'highlight' | 'circle' | 'box' | 'strike-through';
  color?: string;
  animate?: boolean;
  animationDuration?: number;
  strokeWidth?: number;
  show?: boolean;
}

export default function RoughUnderline({
  children,
  type = 'underline',
  color,
  animate = true,
  animationDuration = 400,
  strokeWidth = 1.5,
  show = true,
}: RoughUnderlineProps) {
  const themeVersion = useThemeVersion();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Resolve color from CSS (theme-aware), fall back to prop or terracotta
    const resolvedColor =
      color ?? (readCssVar('--color-terracotta') || '#B45A2D');

    const annotation = annotate(el, {
      type,
      color: resolvedColor,
      animate,
      animationDuration,
      strokeWidth,
    });

    if (show) {
      annotation.show();
    }

    return () => annotation.remove();
  }, [type, color, animate, animationDuration, strokeWidth, show, themeVersion]);

  return (
    <span ref={ref} className="inline">
      {children}
    </span>
  );
}
