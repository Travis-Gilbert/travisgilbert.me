'use client';

import Omnibar from '@/components/island/Omnibar';
import HomeView from './HomeView';
import styles from './DailyPage.module.css';

/**
 * Home: the omnibar over the ambient home view.
 *
 * The omnibar is the 21st.dev ai-input wired to the Theorem gateway -- plain
 * text asks Theorem's agent (gateway askAgent, grounded in the substrate with
 * the context that fed it), the search toggle runs RustyRed/Theseus retrieval
 * (gateway search). This replaces the old Theseus REST ask path.
 *
 * HomeView (the ambient activity/threads panel) still reads its data; it lights
 * up once that surface is federated through the gateway (Lane A).
 */
export default function DailyPage() {
  return (
    <div className={styles.dailyPage}>
      <div className={styles.content}>
        <HomeView />
      </div>
      {/* Floating omnibar, fixed in the bottom third (does not shift content). */}
      <Omnibar />
    </div>
  );
}
