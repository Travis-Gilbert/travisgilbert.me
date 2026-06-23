'use client';

import Omnibar from '@/components/island/Omnibar';
import AutoOrganizeView from './AutoOrganizeView';
import styles from './DailyPage.module.css';

/**
 * Auto Organize: the omnibar over the organizing surface.
 *
 * The 'daily' screen is Auto Organize (the nav model predates the label, so the
 * route key stays stable). AutoOrganizeView is the inbox-replacement:
 * arriving items sort into place automatically and only the small set that needs
 * a decision is surfaced. The ambient HomeView remains in the tree for reuse.
 *
 * The omnibar is the 21st.dev ai-input wired to CommonPlace ask. In the browser
 * it uses the graph-backed ask path; in Tauri it can hand graph context to the
 * configured desktop-local agent.
 */
export default function DailyPage() {
  return (
    <div className={styles.dailyPage}>
      <div className={styles.content}>
        <AutoOrganizeView />
      </div>
      {/* Floating omnibar, lowered on this surface so it sits near the bottom
          edge and leaves the auto-organize content more room. */}
      <Omnibar
        bottomOffset="0px"
        frameClassName={styles.omnibarFrame}
        shellClassName={styles.omnibarShell}
        inputSize="tall"
      />
    </div>
  );
}
