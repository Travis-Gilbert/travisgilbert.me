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
 * The omnibar is the 21st.dev ai-input wired to the Theorem gateway -- plain
 * text asks Theorem's agent (gateway askAgent, grounded in the substrate with
 * the context that fed it), the search toggle runs RustyRed/Theseus retrieval.
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
