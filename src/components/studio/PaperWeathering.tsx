'use client';

import { useMemo } from 'react';
import { djb2, createPRNG } from '@/lib/studio-prng';

const STAGE_ORDER = ['idea', 'research', 'drafting', 'revising', 'production', 'published'];

/**
 * Progressive paper distress marks that accumulate with stage progression.
 *
 * Early stages (idea, research) look pristine. Later stages accumulate
 * corner folds, coffee rings, ink spots, and edge darkening. Effects are
 * deterministic per slug so the same content always shows the same marks.
 */
export default function PaperWeathering({ stage, slug }: { stage: string; slug: string }) {
  const stageIndex = STAGE_ORDER.indexOf(stage);

  const effects = useMemo(() => {
    const items: React.ReactNode[] = [];
    const r = createPRNG(djb2(slug));

    // Stage 2+ (drafting): corner fold triangle
    if (stageIndex >= 2) {
      items.push(
        <div
          key="corner"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 24,
            height: 24,
            background: 'linear-gradient(135deg, transparent 50%, rgba(42,36,32,0.06) 50%)',
            zIndex: 3,
            pointerEvents: 'none',
          }}
        />,
      );
    }

    // Stage 3+ (revising): subtle coffee ring
    if (stageIndex >= 3) {
      const cx = 70 + r() * 20;
      const cy = 80 + r() * 15;
      items.push(
        <div
          key="coffee"
          style={{
            position: 'absolute',
            left: `${cx}%`,
            top: `${cy}%`,
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '1.5px solid rgba(180,90,45,0.07)',
            transform: `translate(-50%, -50%) rotate(${r() * 360}deg)`,
            zIndex: 3,
            pointerEvents: 'none',
          }}
        />,
      );
    }

    // Stage 4+ (production): ink dot cluster
    if (stageIndex >= 4) {
      const dots = Array.from({ length: 3 }, () => ({
        x: 8 + r() * 12,
        y: 20 + r() * 60,
        size: 2 + r() * 3,
      }));
      dots.forEach((d, i) =>
        items.push(
          <div
            key={`ink-${i}`}
            style={{
              position: 'absolute',
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: d.size,
              height: d.size,
              borderRadius: '50%',
              background: 'rgba(42,36,32,0.08)',
              zIndex: 3,
              pointerEvents: 'none',
            }}
          />,
        ),
      );
    }

    // Stage 5 (published): edge darkening
    if (stageIndex >= 5) {
      items.push(
        <div
          key="edge"
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 30px rgba(42,36,32,0.04)',
            zIndex: 3,
            pointerEvents: 'none',
            borderRadius: 'inherit',
          }}
        />,
      );
    }

    return items;
  }, [slug, stageIndex]);

  if (stageIndex < 2) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
      {effects}
    </div>
  );
}
