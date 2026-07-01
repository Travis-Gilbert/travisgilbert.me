'use client';

import { useEffect, useState } from 'react';

export type GithubStatus = {
  ok: true;
  webhook: {
    proxyPath: string;
    publicUrl: string;
    upstreamConfigured: boolean;
  };
  installation: {
    configured: boolean;
    installUrl: string | null;
  };
};

export type GithubPanelState =
  | { kind: 'loading' }
  | { kind: 'ready'; status: GithubStatus }
  | { kind: 'error'; message: string };

export function useGithubAppStatus(): GithubPanelState {
  const [githubState, setGithubState] = useState<GithubPanelState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const response = await fetch('/api/theorem/github/status', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`GitHub status returned ${response.status}.`);
        }
        const status = (await response.json()) as GithubStatus;
        if (!status.webhook?.publicUrl) {
          throw new Error('GitHub status response was incomplete.');
        }
        if (active) setGithubState({ kind: 'ready', status });
      } catch (err) {
        if (active) {
          setGithubState({
            kind: 'error',
            message: err instanceof Error ? err.message : 'GitHub status unavailable.',
          });
        }
      }
    }

    void loadStatus();
    return () => {
      active = false;
    };
  }, []);

  return githubState;
}
