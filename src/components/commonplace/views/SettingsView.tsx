'use client';

import { useGithubAppStatus } from '@/lib/commonplace-github-status';
import { GithubAppPanel } from './GithubAppPanel';
import { panel } from './desktopPanel';

export default function SettingsView() {
  const githubState = useGithubAppStatus();

  return (
    <div style={panel.wrap}>
      <div style={panel.title}>Settings</div>
      <div style={panel.sub}>
        Web integrations and product level connection status.
      </div>
      <GithubAppPanel state={githubState} />
    </div>
  );
}
