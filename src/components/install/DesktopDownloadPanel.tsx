'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, OpenNewWindow } from 'iconoir-react';
import { THEOREM_RELEASES_API_URL, THEOREM_RELEASES_URL } from '@/lib/install-surfaces';

type Platform = 'macos' | 'windows' | 'linux';

interface ReleaseAsset {
  readonly name: string;
  readonly browser_download_url: string;
}

interface ReleaseResponse {
  readonly tag_name: string;
  readonly html_url: string;
  readonly assets: ReleaseAsset[];
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'macos';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos';
  return 'linux';
}

function assetMatches(platform: Platform, asset: ReleaseAsset): boolean {
  const name = asset.name.toLowerCase();
  if (platform === 'macos') return name.endsWith('.dmg');
  if (platform === 'windows') return name.endsWith('.msi') || name.includes('setup.exe') || name.includes('nsis');
  return name.endsWith('.appimage') || name.endsWith('.deb');
}

export default function DesktopDownloadPanel() {
  const [platform, setPlatform] = useState<Platform>(() => detectPlatform());
  const [release, setRelease] = useState<ReleaseResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(THEOREM_RELEASES_API_URL, { headers: { Accept: 'application/vnd.github+json' } })
      .then((response) => {
        if (!response.ok) throw new Error('release lookup failed');
        return response.json() as Promise<ReleaseResponse>;
      })
      .then((payload) => {
        if (!cancelled) setRelease(payload);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAsset = useMemo(
    () => release?.assets.find((asset) => assetMatches(platform, asset)) ?? null,
    [platform, release],
  );

  const platformLabel = {
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
  }[platform];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Desktop platform">
        {(['macos', 'windows', 'linux'] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setPlatform(entry)}
            className={`min-h-[36px] rounded-md border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
              entry === platform
                ? 'border-gold bg-gold text-ink'
                : 'border-border-light bg-transparent text-ink-secondary hover:border-gold hover:text-gold'
            }`}
          >
            {entry === 'macos' ? 'macOS' : entry}
          </button>
        ))}
      </div>

      {selectedAsset ? (
        <a
          href={selectedAsset.browser_download_url}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-md bg-ink px-4 py-2 font-mono text-[12px] uppercase tracking-[0.08em] text-cream no-underline transition-transform hover:-translate-y-0.5"
        >
          <Download width={16} height={16} strokeWidth={2} />
          Download for {platformLabel}
        </a>
      ) : (
        <a
          href={release?.html_url ?? THEOREM_RELEASES_URL}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-md bg-ink px-4 py-2 font-mono text-[12px] uppercase tracking-[0.08em] text-cream no-underline transition-transform hover:-translate-y-0.5"
        >
          <OpenNewWindow width={16} height={16} strokeWidth={2} />
          Open latest release
        </a>
      )}

      <p className="m-0 text-sm text-ink-secondary">
        {release
          ? `${release.tag_name} is the latest GitHub Release. The selector uses the matching installer asset when it is present.`
          : error
            ? 'GitHub release lookup failed, so the release page is the fallback.'
            : 'Looking up the latest GitHub Release asset for this device.'}
      </p>
    </div>
  );
}
