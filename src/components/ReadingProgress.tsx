'use client';

import { useState, useEffect } from 'react';

/**
 * ReadingProgress: thin terracotta line at the top of the viewport
 * that fills left-to-right as the reader scrolls through the article.
 * Pairs with ProgressTracker (production stage vs reading progress).
 */
export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 h-[2px] z-[60] transition-[width] duration-75 ease-linear"
      style={{
        width: `${progress}%`,
        background: 'var(--color-terracotta)',
      }}
      aria-hidden="true"
    />
  );
}
