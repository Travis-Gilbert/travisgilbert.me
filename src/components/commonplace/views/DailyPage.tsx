'use client';

import AutoOrganizeView from './AutoOrganizeView';
import IndexFloatingAssistant from './IndexFloatingAssistant';
import styles from './DailyPage.module.css';

/**
 * Index: the omnibar over the organizing surface.
 *
 * The 'daily' screen is Index (the route key predates the label, so it stays
 * stable). AutoOrganizeView is the inbox-replacement:
 * arriving items sort into place automatically and only the small set that needs
 * a decision is surfaced. The ambient HomeView remains in the tree for reuse.
 *
 * The floating assistant is the Index ask control. It keeps the graph-backed
 * Theorem/RustyWeb paths while using the neural access panel treatment.
 */
export default function DailyPage() {
  return (
    <div className={styles.dailyPage}>
      <div className={styles.content}>
        <AutoOrganizeView />
      </div>
      <IndexFloatingAssistant />
    </div>
  );
}
