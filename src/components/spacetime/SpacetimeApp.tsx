'use client';

/**
 * <SpacetimeApp />: page shell for /spacetime.
 *
 * Composes Globe + YearTicker + two InfoCards + SearchRow + TimelinePane.
 * Owns: which topics are active (A and optional B), current scrub year,
 * paused state, hovered cluster, search-feedback hint.
 *
 * Data flows through `useTopic(key)`. Without `?mock=1`, every topic
 * comes back null and the page renders an honest empty state.
 */

import { useState, useEffect, useMemo } from 'react';
import styles from '@/app/(spacetime)/spacetime/spacetime.module.css';
import Globe, { type HoveredId } from './Globe';
import YearTicker from './YearTicker';
import InfoCard from './InfoCard';
import SearchRow from './SearchRow';
import TimelinePane from './TimelinePane';
import PrwnBackdrop from './PrwnBackdrop';
import {
  COLOR_TOPIC_A,
  COLOR_TOPIC_B,
  COLOR_TOPIC_A_TEXT,
  COLOR_TOPIC_B_TEXT,
  type SpacetimeTopic,
  type SpacetimeMode,
} from '@/lib/spacetime/types';
import { useTopic, useIsMockMode } from '@/lib/spacetime/use-topic';
import {
  DEMO_TOPIC_KEYS_ALL,
  DEMO_TOPICS,
  findDemoTopicKey,
} from '@/lib/spacetime/demo-data';

/** Default keys per mode for the suggested-topic chips and the comparison
 *  fallback. Empty when no backend and no mock. */
const DEFAULT_TOPIC_KEY_MOCK = 'sickle-cell-anemia';

function eraFor(year: number, mode: SpacetimeMode): string {
  if (mode === 'prehistory') {
    if (year < -250) return 'Late Permian';
    if (year < -201) return 'Triassic';
    if (year < -145) return 'Jurassic';
    if (year < -66) return 'Cretaceous';
    if (year < -23) return 'Paleogene';
    return 'Neogene';
  }
  if (year < 1945) return 'Pre-WWII';
  if (year < 1990) return 'Cold-War era';
  if (year < 2010) return 'Genomics turn';
  return 'Early 21st Century';
}

export default function SpacetimeApp() {
  const isMock = useIsMockMode();

  const [topicAKey, setTopicAKey] = useState<string | null>(
    isMock ? DEFAULT_TOPIC_KEY_MOCK : null,
  );
  const [topicBKey, setTopicBKey] = useState<string | null>(null);
  const [year, setYear] = useState(2026);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState<HoveredId | null>(null);
  const [searchHint, setSearchHint] = useState<string | null>(
    isMock ? null : 'No backend connected yet. Append ?mock=1 to the URL to preview the prototype with seeded data.',
  );

  // Hydrate the default once `?mock=1` resolves on the client. (When SSR
  // is disabled, useIsMockMode is fine; this still handles edge cases
  // where the URL param toggles via client-side navigation.)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isMock && !topicAKey) setTopicAKey(DEFAULT_TOPIC_KEY_MOCK);
    if (!isMock && topicAKey) setTopicAKey(null);
    if (!isMock && topicBKey) setTopicBKey(null);
  }, [isMock]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const { topic: topicA } = useTopic(topicAKey);
  const { topic: topicB } = useTopic(topicBKey);

  const mode: SpacetimeMode = topicA?.mode ?? 'modern';
  const compareMode = !!topicB;

  // Combined timeline span across both topics (or the active one alone).
  const [tlMin, tlMax] = useMemo<[number, number]>(() => {
    if (!topicA && !topicB) {
      return mode === 'prehistory' ? [-260, -60] : [1900, 2026];
    }
    if (topicA && !topicB) return topicA.span;
    if (!topicA && topicB) return topicB.span;
    return [
      Math.min(topicA!.span[0], topicB!.span[0]),
      Math.max(topicA!.span[1], topicB!.span[1]),
    ];
  }, [topicA, topicB, mode]);

  // Snap the playhead into range whenever the span changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setYear(y => (y > tlMax || y < tlMin ? tlMax : y));
  }, [tlMin, tlMax]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const era = useMemo(() => eraFor(year, mode), [year, mode]);

  // Cross-topic linkage count (same city OR within 5 years).
  const linkageCount = useMemo(() => {
    if (!topicA || !topicB) return 0;
    let n = 0;
    topicA.events.forEach(a => {
      if (a.year > year) return;
      topicB.events.forEach(b => {
        if (b.year > year) return;
        if (a.city === b.city || Math.abs(a.year - b.year) <= 5) n++;
      });
    });
    return n;
  }, [topicA, topicB, year]);

  function setHintTransiently(message: string) {
    setSearchHint(message);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        setSearchHint(prev => (prev === message ? null : prev));
      }, 4500);
    }
  }

  function handleSubmitA(query: string) {
    if (!isMock) {
      setHintTransiently('Spacetime backend not yet wired. Append ?mock=1 to preview seeded data.');
      return;
    }
    const match = findDemoTopicKey(query);
    if (match) {
      setTopicAKey(match);
    } else {
      setHintTransiently(`No topic matches "${query}". Try one of: ${DEMO_TOPIC_KEYS_ALL.map(k => DEMO_TOPICS[k].title).slice(0, 3).join(', ')}…`);
    }
  }

  function handleSubmitB(query: string) {
    if (!isMock) return;
    const match = findDemoTopicKey(query);
    if (match) {
      setTopicBKey(match);
    } else {
      setHintTransiently(`No second topic matches "${query}".`);
    }
  }

  function handleAddCompare() {
    if (!isMock) {
      setHintTransiently('Comparison needs at least one topic loaded. Append ?mock=1.');
      return;
    }
    // Prefer a different key from Topic A, in the same mode.
    const sameMode = DEMO_TOPIC_KEYS_ALL
      .filter(k => DEMO_TOPICS[k].mode === mode && k !== topicAKey);
    const next = sameMode[0] ?? DEMO_TOPIC_KEYS_ALL.find(k => k !== topicAKey) ?? null;
    if (next) setTopicBKey(next);
  }

  const wrapperMode: SpacetimeMode = mode;
  const yearLabelMode = wrapperMode === 'prehistory' ? `${Math.abs(year).toFixed(2)} Mya` : `≤ ${Math.round(year)}`;

  return (
    <div className={styles.page} data-mode={wrapperMode}>
      <PrwnBackdrop />
      <YearTicker year={year} era={era} prehistory={wrapperMode === 'prehistory'} />

      {/* Upper-left: Topic A details */}
      <InfoCard side="left">
        <div className={styles.eyebrow} style={{ color: COLOR_TOPIC_A_TEXT }}>
          Topic A · DyGFormer GNN
        </div>
        <h1 className={styles.topicTitle}>{topicA?.title ?? '- No topic loaded -'}</h1>
        <div className={styles.topicSub}>
          {topicA?.sub ?? (isMock ? '' : 'Backend coming soon · search to begin')}
        </div>

        <div className={styles.rule} />

        <div className={styles.metaRow}>
          <span>Sources</span>
          <b>{topicA?.sources.toLocaleString() ?? '-'}</b>
        </div>
        <div className={styles.metaRow}>
          <span>Clusters</span>
          <b>{topicA?.events.length ?? '-'}</b>
        </div>
        <div className={styles.metaRow}>
          <span>Span</span>
          <b>
            {topicA
              ? wrapperMode === 'prehistory'
                ? `${Math.abs(topicA.span[0])} → ${Math.abs(topicA.span[1])} Mya`
                : `${topicA.span[0]}-${topicA.span[1]}`
              : '-'}
          </b>
        </div>
        <div className={styles.metaRow}>
          <span>Showing</span>
          <b style={{ color: COLOR_TOPIC_A_TEXT }}>{topicA ? yearLabelMode : '-'}</b>
        </div>

        {compareMode && topicB && topicA && (
          <>
            <div className={styles.rule} />
            <div className={styles.eyebrow} style={{ color: COLOR_TOPIC_B_TEXT }}>
              Topic B
            </div>
            <h1 className={styles.topicTitle} style={{ fontSize: '1.05rem' }}>
              {topicB.title}
            </h1>
            <div className={styles.metaRow}>
              <span>Sources</span>
              <b>{topicB.sources.toLocaleString()}</b>
            </div>
            <div className={styles.metaRow}>
              <span>Clusters</span>
              <b>{topicB.events.length}</b>
            </div>
            <div className={styles.rule} />
            <div className={styles.metaRow}>
              <span>Linkages</span>
              <b style={{ color: '#7A4A8A' }}>● {linkageCount}</b>
            </div>
            <div className={styles.caption}>
              where {topicA.title.toLowerCase()} and {topicB.title.toLowerCase()} touch: same city or within 5 years.
            </div>
          </>
        )}

        {!compareMode && topicA && (
          <>
            <div className={styles.rule} />
            <div className={styles.metaRow}>
              <span>Era</span><b>{era}</b>
            </div>
            <div className={styles.metaRow}>
              <span>Status</span>
              <b style={{ color: 'var(--color-success)' }}>● Live</b>
            </div>
          </>
        )}

        {!isMock && !topicA && (
          <>
            <div className={styles.rule} />
            <div className={styles.caption}>
              The /spacetime route is wired. The backend that turns a topic
              into geo-temporal clusters is queued for the next session.
              Append <code>?mock=1</code> to the URL to preview the
              prototype with the seeded reference dataset.
            </div>
          </>
        )}
      </InfoCard>

      {/* Upper-right: legend + suggested topics */}
      <InfoCard side="right">
        <div className={styles.eyebrow} style={{ textAlign: 'right' }}>
          Atlas · Fig. 14
        </div>

        <div className={styles.legendTitle}>Legend</div>
        <div className={styles.legendRow}>
          <span className={`${styles.dot} ${styles.dotMd}`} style={{ background: COLOR_TOPIC_A }} />
          <span>Topic A clusters</span>
        </div>
        {compareMode && (
          <div className={styles.legendRow}>
            <span className={`${styles.dot} ${styles.dotMd}`} style={{ background: COLOR_TOPIC_B }} />
            <span>Topic B clusters</span>
          </div>
        )}
        {compareMode && (
          <div className={styles.legendRow}>
            <svg width="22" height="6">
              <line x1="1" y1="3" x2="21" y2="3" stroke="#7A4A8A" strokeWidth="1.2" strokeDasharray="1 4" />
            </svg>
            <span>Cross-topic linkage</span>
          </div>
        )}
        <div className={styles.legendRow}>
          <span className={`${styles.dot} ${styles.dotSm}`} />
          <span>1-9 records</span>
        </div>
        <div className={styles.legendRow}>
          <span className={`${styles.dot} ${styles.dotLg}`} />
          <span>100+ records</span>
        </div>

        <div className={styles.rule} />

        <div className={styles.legendTitle}>Suggested topics</div>
        <div className={styles.suggestionChips}>
          {(isMock ? DEMO_TOPIC_KEYS_ALL : []).map(k => {
            const isA = k === topicAKey;
            const isB = k === topicBKey;
            const t = DEMO_TOPICS[k];
            const chipMode = t.mode;
            const chipClass =
              `${styles.chip} ` +
              (isA ? styles.chipActiveA : isB ? styles.chipActiveB : '') +
              (chipMode === 'prehistory' ? ` ${styles.chipPrehistory}` : '');
            return (
              <button
                key={k}
                type="button"
                className={chipClass}
                onClick={() => {
                  if (isA) return;
                  if (isB) {
                    setTopicBKey(null);
                    return;
                  }
                  if (compareMode) {
                    setTopicBKey(k);
                  } else {
                    setTopicAKey(k);
                  }
                }}
                onContextMenu={e => {
                  e.preventDefault();
                  setTopicBKey(k);
                }}
                title="click → Topic A · right-click → Topic B"
              >
                {t.title}
              </button>
            );
          })}
          {!isMock && (
            <span className={styles.caption} style={{ marginTop: 0 }}>
              No topics yet. Backend coming soon.
            </span>
          )}
        </div>
      </InfoCard>

      {/* Globe */}
      <div className={styles.globeStage}>
        <Globe
          size={400}
          topicA={topicA}
          topicAColor={COLOR_TOPIC_A}
          topicB={topicB}
          topicBColor={COLOR_TOPIC_B}
          yearMax={year}
          hoveredId={hovered}
          onHover={setHovered}
          paused={paused}
          prehistory={wrapperMode === 'prehistory'}
        />
      </div>

      {/* Search row */}
      <SearchRow
        topicA={topicA}
        topicB={topicB}
        onSubmitA={handleSubmitA}
        onSubmitB={handleSubmitB}
        onAddCompare={handleAddCompare}
        onRemoveB={() => setTopicBKey(null)}
        hint={searchHint}
      />

      {/* Timeline */}
      <TimelinePane
        topicA={topicA}
        topicB={topicB}
        tlMin={tlMin}
        tlMax={tlMax}
        year={year}
        prehistory={wrapperMode === 'prehistory'}
        paused={paused}
        hovered={hovered}
        onHover={setHovered}
        onScrub={setYear}
        onTogglePause={() => setPaused(p => !p)}
        hint={
          compareMode
            ? 'drag to scrub · topic A above the line, topic B below: overlapping years draw cross-linkages'
            : 'drag to scrub · hover an event to surface marginalia'
        }
      />

      <div className={styles.footerCredit}>
        Travis Gilbert · DyGFormer GNN ·
        <a href="/research"> paper trails →</a>
      </div>
    </div>
  );
}
