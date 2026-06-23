'use client';

import Omnibar from '@/components/island/Omnibar';
import AutoOrganizeView from './AutoOrganizeView';
import styles from './DailyPage.module.css';

/**
 * Home / Auto Organize: the omnibar over the auto-organize surface.
 *
 * The 'daily' screen is the Auto Organize home (the nav model renamed it once
 * the organizing primitive landed). AutoOrganizeView is the inbox-replacement:
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
      <Omnibar bottomOffset="5vh" />
    </div>
  );
}
