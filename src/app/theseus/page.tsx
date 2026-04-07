'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { AskExperience } from '@/components/theseus/AskExperience';
import { useGalaxy } from '@/components/theseus/TheseusShell';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const STARTER_QUERIES = [
  'What connects Shannon to Hamming?',
  'What unresolved tensions are active?',
  'What am I missing about GNNs?',
  'What new clusters formed this week?',
];

/**
 * Chrome overlay rendered above the AskExperience while the engine is
 * IDLE. Holds the THESEUS title, the "What are you curious about?"
 * subtitle, and the four starter pills. Fades out via opacity +
 * pointer-events when the state machine moves to THINKING so the
 * AskExperience visuals (traveling query, dot pulse, morph circle)
 * have the viewport to themselves. Fades back in if the user clears
 * their question and the state returns to IDLE.
 *
 * The starter pills navigate by pushing `/theseus?q=...` to the
 * router. The AskExperience reads searchParams via useSearchParams
 * and its existing useEffect picks up the new query and starts the
 * THINKING state machine in place — no full-page navigation.
 */
function HomepageChrome() {
  const { askState } = useGalaxy();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isIdle = askState === 'IDLE';

  return (
    <div
      aria-hidden={!isIdle}
      style={{
        position: 'fixed',
        top: '22vh',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(720px, calc(100vw - 32px))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: isIdle ? 1 : 0,
        pointerEvents: isIdle ? 'auto' : 'none',
        transition: prefersReducedMotion
          ? 'none'
          : 'opacity 500ms ease',
        zIndex: 11,
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-vollkorn-sc), Georgia, serif',
          fontSize: 28,
          fontWeight: 600,
          color: '#3D8A96',
          margin: 0,
          lineHeight: 1.1,
          letterSpacing: '0.08em',
          textAlign: 'center',
        }}
      >
        THESEUS
      </h1>
      <p
        style={{
          margin: '10px 0 0',
          fontFamily: 'var(--vie-font-body)',
          fontSize: 14,
          color: 'var(--vie-text-dim)',
          textAlign: 'center',
        }}
      >
        What are you curious about?
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          marginTop: 22,
        }}
      >
        {STARTER_QUERIES.map((starter) => (
          <Link
            key={starter}
            href={`/theseus?q=${encodeURIComponent(starter)}`}
            scroll={false}
            style={{
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--vie-text-muted)',
              fontFamily: 'var(--vie-font-body)',
              fontSize: 12,
              lineHeight: 1,
              padding: '8px 12px',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            {starter}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function TheseusHomepage() {
  return (
    <Suspense
      fallback={
        <div style={{ position: 'fixed', inset: 0 }} aria-busy="true" />
      }
    >
      <HomepageChrome />
      <AskExperience />
    </Suspense>
  );
}
