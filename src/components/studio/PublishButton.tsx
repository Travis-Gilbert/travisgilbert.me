'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

type PublishState = 'idle' | 'saving' | 'publishing' | 'success' | 'error';

const CONFETTI_COUNT = 28;
const CONFETTI_COLORS = [
  '#B45A2D', // terracotta
  '#D4743A', // terracotta bright
  '#D4AA4A', // gold
  '#3A8A9A', // teal
  '#6A9A5A', // green
  '#8A6A9A', // purple
  '#F0EAE0', // cream
];

/**
 * Simple seeded PRNG (same LCG pattern used in HeroAccents and PatternImage).
 * Ensures the confetti pattern is visually varied but reproducible per render.
 */
function createPRNG(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateParticles(seed: number) {
  const rand = createPRNG(seed);
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const angle = rand() * Math.PI * 2;
    const distance = 60 + rand() * 100;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance - 30; // bias upward
    const rotation = rand() * 720 - 360;
    const scale = 0.5 + rand() * 0.8;
    const delay = rand() * 0.15;
    const color = CONFETTI_COLORS[Math.floor(rand() * CONFETTI_COLORS.length)];
    const shape = rand() > 0.5 ? 'square' : 'circle';
    return { id: i, x, y, rotation, scale, delay, color, shape };
  });
}

/**
 * Publish button with confetti burst animation.
 * Calls onPublish() which should save + publish via the Studio API.
 * Shows a multi-phase state: idle -> saving -> publishing -> success (confetti) -> idle.
 */
export default function PublishButton({
  onPublish,
  disabled = false,
}: {
  onPublish: () => Promise<void>;
  disabled?: boolean;
}) {
  const [state, setState] = useState<PublishState>('idle');
  const [showConfetti, setShowConfetti] = useState(false);
  const [particles, setParticles] = useState<ReturnType<typeof generateParticles>>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (state !== 'idle' || disabled) return;

    setState('saving');

    try {
      setState('publishing');
      await onPublish();

      setState('success');
      setParticles(generateParticles(Date.now()));
      setShowConfetti(true);

      successTimerRef.current = setTimeout(() => {
        setShowConfetti(false);
        setState('idle');
      }, 2400);
    } catch {
      setState('error');
      successTimerRef.current = setTimeout(() => {
        setState('idle');
      }, 2500);
    }
  }, [state, disabled, onPublish]);

  const label =
    state === 'saving'
      ? 'Saving...'
      : state === 'publishing'
        ? 'Publishing...'
        : state === 'success'
          ? 'Published!'
          : state === 'error'
            ? 'Failed'
            : 'Publish';

  const isWorking = state === 'saving' || state === 'publishing';

  return (
    <div className="studio-publish-wrapper">
      <button
        ref={buttonRef}
        type="button"
        className={`studio-publish-btn ${state === 'success' ? 'is-success' : ''} ${state === 'error' ? 'is-error' : ''} ${isWorking ? 'is-working' : ''}`}
        onClick={handleClick}
        disabled={disabled || state !== 'idle'}
        aria-label={label}
      >
        <span className="studio-publish-icon" aria-hidden="true">
          {state === 'success' ? '\u2714' : state === 'error' ? '\u2717' : '\u2191'}
        </span>
        <span className="studio-publish-label">{label}</span>

        {isWorking && (
          <span className="studio-publish-spinner" aria-hidden="true" />
        )}
      </button>

      {showConfetti && (
        <div className="studio-confetti-container" aria-hidden="true">
          {particles.map((p) => (
            <span
              key={p.id}
              className={`studio-confetti-particle ${p.shape === 'circle' ? 'is-circle' : ''}`}
              style={{
                '--confetti-x': `${p.x}px`,
                '--confetti-y': `${p.y}px`,
                '--confetti-rotation': `${p.rotation}deg`,
                '--confetti-scale': String(p.scale),
                '--confetti-delay': `${p.delay}s`,
                '--confetti-color': p.color,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  );
}
