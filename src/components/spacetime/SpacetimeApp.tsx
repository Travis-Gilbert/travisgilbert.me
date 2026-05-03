'use client';

/**
 * <SpacetimeApp />: page shell for /spacetime.
 *
 * Composes Globe + YearTicker + two InfoCards + SearchRow + TimelinePane.
 * Owns: which topics are active (A and optional B), current scrub year,
 * paused state, hovered cluster, search-feedback hint.
 *
 * Data flows through `useTopic(key)`. Every topic key submitted via search
 * is slugified and sent to the backend; the backend's resolver decides
 * whether to return a cache hit or kick off cold-start. There is no mock
 * mode and no demo allowlist: if the backend cannot answer, the page
 * renders an honest empty state.
 */

import { useState, useEffect, useMemo, type WheelEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  type SpacetimeMode,
} from '@/lib/spacetime/types';
import { useTopic } from '@/lib/spacetime/use-topic';
import {
  clampYear,
  spinDirectionFromYears,
  yearFromWheelDelta,
} from '@/lib/spacetime/scroll-time';
import {
  comparePeriods,
  type SpacetimeEvent as ComparisonEvent,
  type TimeWindow,
} from '@/lib/spacetime/compare-periods';

/** Humanize the backend pipeline stage name into a status line the
 *  user can read. The cold-start runs ~30s end-to-end; without this
 *  the page would look frozen. */
function stageLabel(stage: string | null): string {
  switch (stage) {
    case 'starting':       return 'Starting…';
    case 'web_acquisition': return 'Searching the web for sources…';
    case 'engine_pass':    return 'Running graph engine over new sources…';
    case 'cluster_bucket': return 'Bucketing events by city + decade…';
    case 'gnn_inflection': return 'Scoring inflection points with the GNN…';
    case 'llm_chrome':     return 'Generating title and summary…';
    case 'complete':       return 'Done';
    default:               return 'Working…';
  }
}

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

function slugifyQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function orderedWindow(
  startYear: number,
  endYear: number,
  minYear: number,
  maxYear: number,
): TimeWindow {
  const start = clampYear(startYear, minYear, maxYear);
  const end = clampYear(endYear, minYear, maxYear);
  return start <= end
    ? { startYear: start, endYear: end }
    : { startYear: end, endYear: start };
}

export default function SpacetimeApp() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q');

  // Initial topicAKey: URL ?q=... wins so a topic deep-link always works;
  // otherwise null (empty state until the user submits a search).
  const [topicAKey, setTopicAKey] = useState<string | null>(() => urlQuery || null);
  const [topicBKey, setTopicBKey] = useState<string | null>(null);
  // The compare slot's second search input renders whenever this is true
  // OR a topicB has loaded. Lets the user open the second field before any
  // network call resolves.
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [year, setYear] = useState(2026);
  const [spinDirection, setSpinDirection] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState<HoveredId | null>(null);
  const [firstWindow, setFirstWindow] = useState<TimeWindow>({
    startYear: 1900,
    endYear: 1960,
  });
  const [secondWindow, setSecondWindow] = useState<TimeWindow>({
    startYear: 1961,
    endYear: 2026,
  });

  // React to URL flips (e.g. client-side navigation to /spacetime?q=...).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (urlQuery && urlQuery !== topicAKey) {
      setTopicAKey(urlQuery);
    }
  }, [urlQuery]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const { topic: topicA, loading: loadingA, stage: stageA, error: errorA } = useTopic(topicAKey);
  const { topic: topicB } = useTopic(topicBKey);

  const mode: SpacetimeMode = topicA?.mode ?? 'modern';
  const compareMode = !!topicB;
  const wrapperMode: SpacetimeMode = mode;

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
    setYear(y => {
      const next = y > tlMax || y < tlMin ? tlMax : y;
      setSpinDirection(spinDirectionFromYears(y, next));
      return next;
    });
  }, [tlMin, tlMax]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const midpoint = tlMin + (tlMax - tlMin) / 2;
    const firstEnd = wrapperMode === 'prehistory'
      ? Math.round(midpoint * 100) / 100
      : Math.round(midpoint);
    const secondStart = wrapperMode === 'prehistory' ? firstEnd : firstEnd + 1;

    setFirstWindow(orderedWindow(tlMin, firstEnd, tlMin, tlMax));
    setSecondWindow(orderedWindow(secondStart, tlMax, tlMin, tlMax));
  }, [tlMin, tlMax, wrapperMode, topicAKey, topicBKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const era = useMemo(() => eraFor(year, mode), [year, mode]);

  const comparisonEvents = useMemo<ComparisonEvent[]>(() => {
    const topicEvents = [
      ...(topicA?.events.map((event) => ({ topic: 'A' as const, event })) ?? []),
      ...(topicB?.events.map((event) => ({ topic: 'B' as const, event })) ?? []),
    ];

    return topicEvents.map(({ topic, event }) => ({
      id: `${topic}-${event.id}`,
      label: event.city,
      year: event.year,
      latitude: Number.isFinite(event.lat) ? event.lat : null,
      longitude: Number.isFinite(event.lon) ? event.lon : null,
      weight: event.papers,
    }));
  }, [topicA, topicB]);

  const periodComparison = useMemo(
    () => comparePeriods(comparisonEvents, firstWindow, secondWindow),
    [comparisonEvents, firstWindow, secondWindow],
  );

  const missingCoordinateCount = useMemo(() => {
    const byId = new Map<string, ComparisonEvent>();
    [...periodComparison.first, ...periodComparison.second].forEach((event) => {
      byId.set(event.id, event);
    });
    return [...byId.values()].filter(
      (event) => event.latitude == null || event.longitude == null,
    ).length;
  }, [periodComparison]);

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

  function handleSubmitA(query: string) {
    const slug = slugifyQuery(query);
    if (!slug) return;
    setTopicAKey(slug);
  }

  function handleSubmitB(query: string) {
    const slug = slugifyQuery(query);
    if (!slug) return;
    setTopicBKey(slug);
  }

  function handleAddCompare() {
    setCompareEnabled(true);
  }

  function handleRemoveB() {
    setTopicBKey(null);
    setCompareEnabled(false);
  }

  function setScrubYear(nextYear: number) {
    setYear((previousYear) => {
      const next = clampYear(nextYear, tlMin, tlMax);
      setSpinDirection(spinDirectionFromYears(previousYear, next));
      return next;
    });
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!topicA?.events.length && !topicB?.events.length) return;
    event.preventDefault();
    const wheelStep = wrapperMode === 'prehistory' ? 1 : 5;
    setYear((previousYear) => {
      const next = yearFromWheelDelta(
        previousYear,
        event.deltaY,
        tlMin,
        tlMax,
        wheelStep,
      );
      setSpinDirection(spinDirectionFromYears(previousYear, next));
      return next;
    });
  }

  function updateWindow(
    which: 'first' | 'second',
    field: keyof TimeWindow,
    value: string,
  ) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const setter = which === 'first' ? setFirstWindow : setSecondWindow;
    setter((current) => orderedWindow(
      field === 'startYear' ? parsed : current.startYear,
      field === 'endYear' ? parsed : current.endYear,
      tlMin,
      tlMax,
    ));
  }

  const yearLabelMode = wrapperMode === 'prehistory' ? `${Math.abs(year).toFixed(2)} Mya` : `≤ ${Math.round(year)}`;
  const yearInputStep = wrapperMode === 'prehistory' ? 0.01 : 1;
  const hasComparisonEvents = comparisonEvents.length > 0;

  return (
    <div className={styles.page} data-mode={wrapperMode} onWheel={handleWheel}>
      <PrwnBackdrop />
      <YearTicker year={year} era={era} prehistory={wrapperMode === 'prehistory'} />

      {/* Home link. The (spacetime) layout intentionally drops TopNav for the
          full-bleed parchment surface, so this small mark is the only way
          back to the main site without using the browser back button. Mirrors
          the footer credit visually so the page reads bracketed top + bottom. */}
      <Link href="/" className={styles.homeMark} aria-label="Back to travisgilbert.me">
        ← travisgilbert.me
      </Link>

      {/* Upper-left: Topic A details */}
      <InfoCard side="left">
        <div className={styles.eyebrow} style={{ color: COLOR_TOPIC_A_TEXT }}>
          Topic A · DyGFormer GNN
        </div>
        <h1 className={styles.topicTitle}>
          {loadingA && !topicA?.title
            ? 'Resolving topic…'
            : topicA?.title ?? '- No topic loaded -'}
        </h1>
        <div className={styles.topicSub}>
          {errorA
            ? `Backend error: ${errorA.message}`
            : loadingA
              ? stageLabel(stageA)
              : topicA?.sub || (topicA && topicA.events.length === 0
                  ? 'No clusters resolved for this query. Try a different topic, or one that maps to specific places (e.g. cities or regions).'
                  : 'Search a topic to begin')}
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

        {!topicA && !loadingA && !errorA && (
          <>
            <div className={styles.rule} />
            <div className={styles.caption}>
              Type a research topic in the search bar below. Cached topics
              return instantly; new ones run a cold-start that searches
              the graph + web and resolves clusters over a few seconds.
            </div>
          </>
        )}
      </InfoCard>

      {/* Upper-right: legend */}
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
        {hasComparisonEvents && (
          <>
            <div className={styles.rule} />
            <div className={styles.legendTitle}>Period Comparison</div>
            <div className={styles.periodGrid}>
              <label className={styles.periodField}>
                A start
                <input
                  type="number"
                  step={yearInputStep}
                  value={firstWindow.startYear}
                  onChange={(event) => updateWindow('first', 'startYear', event.target.value)}
                />
              </label>
              <label className={styles.periodField}>
                A end
                <input
                  type="number"
                  step={yearInputStep}
                  value={firstWindow.endYear}
                  onChange={(event) => updateWindow('first', 'endYear', event.target.value)}
                />
              </label>
              <label className={styles.periodField}>
                B start
                <input
                  type="number"
                  step={yearInputStep}
                  value={secondWindow.startYear}
                  onChange={(event) => updateWindow('second', 'startYear', event.target.value)}
                />
              </label>
              <label className={styles.periodField}>
                B end
                <input
                  type="number"
                  step={yearInputStep}
                  value={secondWindow.endYear}
                  onChange={(event) => updateWindow('second', 'endYear', event.target.value)}
                />
              </label>
            </div>
            <div className={styles.comparisonStats}>
              <span>A {periodComparison.first.length}</span>
              <span>B {periodComparison.second.length}</span>
              <span>Shared {periodComparison.sharedLabels.length}</span>
            </div>
            <div className={styles.comparisonList}>
              <span>Shared</span>
              <b>{periodComparison.sharedLabels.slice(0, 3).join(', ') || 'none'}</b>
            </div>
            <div className={styles.comparisonList}>
              <span>New in B</span>
              <b>{periodComparison.onlySecond.slice(0, 3).map((event) => event.label).join(', ') || 'none'}</b>
            </div>
            <div className={styles.caption}>
              {missingCoordinateCount > 0
                ? `${missingCoordinateCount} event${missingCoordinateCount === 1 ? '' : 's'} without coordinates stay in lists only.`
                : 'All selected period events have coordinates for globe plotting.'}
            </div>
          </>
        )}
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
          spinDirection={spinDirection}
          visibleWindows={hasComparisonEvents ? { first: firstWindow, second: secondWindow } : null}
          prehistory={wrapperMode === 'prehistory'}
        />
      </div>

      {/* Search row */}
      <SearchRow
        topicA={topicA}
        topicB={topicB}
        compareEnabled={compareEnabled}
        onSubmitA={handleSubmitA}
        onSubmitB={handleSubmitB}
        onAddCompare={handleAddCompare}
        onRemoveB={handleRemoveB}
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
        onScrub={setScrubYear}
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
