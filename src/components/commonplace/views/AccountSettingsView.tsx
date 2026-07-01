'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useOwner } from '@/components/OwnerProvider';
import { useGithubAppStatus } from '@/lib/commonplace-github-status';
import { GithubAppPanel } from './GithubAppPanel';

type BlobStyle = CSSProperties & Record<`--${string}`, string | number>;

const GOOEY_BLOBS = [
  { size: 260, x: '18%', y: '14%', color: 'rgba(219, 166, 93, 0.74)', duration: '16s', delay: '-2s', depth: 14 },
  { size: 230, x: '72%', y: '16%', color: 'rgba(64, 132, 144, 0.62)', duration: '18s', delay: '-9s', depth: -10 },
  { size: 320, x: '54%', y: '58%', color: 'rgba(140, 62, 58, 0.64)', duration: '22s', delay: '-5s', depth: 8 },
  { size: 210, x: '26%', y: '78%', color: 'rgba(88, 115, 158, 0.58)', duration: '19s', delay: '-13s', depth: -14 },
  { size: 180, x: '84%', y: '72%', color: 'rgba(244, 223, 183, 0.48)', duration: '15s', delay: '-6s', depth: 12 },
];

export default function AccountSettingsView() {
  const { isOwner } = useOwner();
  const githubState = useGithubAppStatus();
  const installUrl = githubState.kind === 'ready' ? githubState.status.installation.installUrl : null;
  const upstreamReady = githubState.kind === 'ready' && githubState.status.webhook.upstreamConfigured;

  return (
    <div className="cp-account-screen">
      <GooeyAccessBackground />

      <div className="cp-account-grid">
        <section className="cp-account-access-panel" aria-label="CommonPlace account access">
          <div className="cp-account-node">System Node: CommonPlace</div>
          <h1>Neural Access</h1>
          <p className="cp-account-copy">
            Owner authentication and connected ingestion channels for the CommonPlace surface.
          </p>

          <div className="cp-account-identity">
            <span>Owner Access</span>
            <strong>{isOwner ? 'verified' : 'locked'}</strong>
          </div>

          <div className="cp-account-actions">
            <a className="cp-account-primary" href={isOwner ? '/api/auth/signout' : '/api/auth/signin'}>
              {isOwner ? 'Sign out' : 'Sign in with GitHub'}
            </a>
            {installUrl ? (
              <a className="cp-account-secondary" href={installUrl} target="_blank" rel="noreferrer">
                GitHub App
              </a>
            ) : (
              <span className="cp-account-secondary cp-account-secondary--disabled">
                GitHub App
              </span>
            )}
          </div>

          <div className="cp-account-signal-grid" aria-label="Account status">
            <div>
              <span>Auth</span>
              <strong>{isOwner ? 'owner' : 'guest'}</strong>
            </div>
            <div>
              <span>Webhook</span>
              <strong>{upstreamReady ? 'ready' : 'setup'}</strong>
            </div>
            <div>
              <span>Install</span>
              <strong>{installUrl ? 'linked' : 'missing'}</strong>
            </div>
          </div>
        </section>

        <div className="cp-account-side-panel">
          <div className="cp-account-side-title">Connections</div>
          <GithubAppPanel state={githubState} />
        </div>
      </div>
    </div>
  );
}

function GooeyAccessBackground() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const blobRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    function handlePointerMove(event: PointerEvent) {
      const currentElement = rootRef.current;
      if (!currentElement) return;
      const bounds = currentElement.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      blobRefs.current.forEach((blob, index) => {
        if (!blob) return;
        const depth = GOOEY_BLOBS[index]?.depth ?? 0;
        blob.style.setProperty('--blob-shift-x', `${x * depth}px`);
        blob.style.setProperty('--blob-shift-y', `${y * depth}px`);
      });
    }

    function handlePointerLeave() {
      blobRefs.current.forEach((blob) => {
        blob?.style.setProperty('--blob-shift-x', '0px');
        blob?.style.setProperty('--blob-shift-y', '0px');
      });
    }

    element.addEventListener('pointermove', handlePointerMove, { passive: true });
    element.addEventListener('pointerleave', handlePointerLeave);
    return () => {
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return (
    <div ref={rootRef} className="cp-account-gooey" aria-hidden="true">
      <svg className="cp-account-gooey-filter" width="0" height="0" focusable="false">
        <filter id="cp-account-gooey-filter">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
            result="goo"
          />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </svg>
      <div className="cp-account-gooey-field">
        {GOOEY_BLOBS.map((blob, index) => (
          <div
            key={`${blob.x}-${blob.y}`}
            ref={(node) => {
              blobRefs.current[index] = node;
            }}
            className="cp-account-gooey-blob"
            style={{
              '--blob-size': `${blob.size}px`,
              '--blob-x': blob.x,
              '--blob-y': blob.y,
              '--blob-color': blob.color,
              '--blob-duration': blob.duration,
              '--blob-delay': blob.delay,
            } as BlobStyle}
          />
        ))}
      </div>
    </div>
  );
}
