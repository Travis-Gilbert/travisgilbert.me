'use client';

/**
 * DrawOnIcon: Animated variant of SketchIcon.
 *
 * Uses the pathLength="1" technique per path to normalize stroke lengths,
 * then transitions strokeDashoffset from 1 (hidden) to 0 (fully drawn)
 * when the icon enters the viewport via IntersectionObserver.
 *
 * Multi-path icons (Iconoir standard) animate each path with a configurable
 * stagger so the icon draws stroke by stroke.
 *
 * Respects prefers-reduced-motion: shows all paths immediately without animation.
 *
 * Designed for section header icons (size=32).
 * Nav icons use SketchIcon (always visible, no animation).
 */

import { useRef, useEffect, useState } from 'react';
import { ICON_PATHS } from './SketchIcon';
import type { IconName } from './SketchIcon';

interface DrawOnIconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
  /** Duration of each individual path draw animation in ms */
  duration?: number;
  /** Delay before the FIRST path starts animating, in ms */
  delay?: number;
  /** Additional delay between each successive path, in ms */
  pathStaggerMs?: number;
}

export default function DrawOnIcon({
  name,
  size = 32,
  color = 'currentColor',
  className = '',
  strokeWidth = 1.5,
  duration = 800,
  delay = 0,
  pathStaggerMs = 60,
}: DrawOnIconProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(false);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    // Respect reduced motion: show all paths immediately
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReduced) {
      setSkipAnimation(true);
      setDrawn(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const paths = ICON_PATHS[name];

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      {paths.map((d, i) => {
        const pathDelay = delay + i * pathStaggerMs;

        return (
          <path
            key={i}
            d={d}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={drawn ? 0 : 1}
            style={
              skipAnimation
                ? undefined
                : {
                    transition: `stroke-dashoffset ${duration}ms ease-out ${pathDelay}ms`,
                  }
            }
          />
        );
      })}
    </svg>
  );
}
