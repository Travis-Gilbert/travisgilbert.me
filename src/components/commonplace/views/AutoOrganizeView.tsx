'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  THEOREM_GRAPHQL,
  gqlOrganize,
  gqlCollections,
  gqlItems,
  gqlAddToCollection,
  gqlAsk,
  type OrganizeSnapshotGql,
  type OrganizeItemGql,
  type OrganizeTimeframe,
  type CollectionGql,
  type ItemGql,
} from '@/lib/commonplace-graphql';
import { useDrawer } from '@/lib/providers/drawer-provider';
import { useLayout } from '@/lib/providers/layout-provider';
import DailyProgress from '../shared/DailyProgress';
import styles from './AutoOrganizeView.module.css';

/* ─────────────────────────────────────────────────
   The auto-organize surface (the inbox-replacement). Renders the organized
   state, surfaces only the small set that needs a decision, and never presents
   a backlog. The Organizing Engine rendered as a screen.

   Partition comes from the engine (gqlOrganize): at/above the confidence
   ceiling an item auto-files (organized-today only); below it the item lands in
   needs-you with its alternative destinations. The client only applies the
   bounded cap, the per-day "later" deferral, and optimistic confirm/undo.
   ───────────────────────────────────────────────── */

const NEEDS_YOU_CAP = 8;

/* Per-type card config: the tint + silhouette classes, the label/glyph, and the
   agent-collaboration verb (the one filled action). `file` falls back to the
   note treatment. */
interface KindConfig {
  tint: string;
  shape: string;
  glyph: string;
  label: string;
  verb: string;
}
const KIND_CONFIG: Record<string, KindConfig> = {
  email: { tint: styles.tEmail, shape: styles.shapeEmail, glyph: '✉', label: 'email', verb: 'Draft' },
  task: { tint: styles.tTask, shape: styles.shapeTask, glyph: '☑', label: 'task', verb: 'Delegate' },
  note: { tint: styles.tNote, shape: styles.shapeNote, glyph: '◆', label: 'note', verb: 'Develop' },
  event: { tint: styles.tEvent, shape: styles.shapeEvent, glyph: '▤', label: 'event', verb: 'Prep' },
  file: { tint: styles.tNote, shape: styles.shapeNote, glyph: '□', label: 'file', verb: 'Develop' },
};
const kindConfig = (k: string): KindConfig => KIND_CONFIG[k] ?? KIND_CONFIG.note;

/* The agent-collaboration prompt the verb runs (scoped to the object). */
function verbPrompt(verb: string, item: OrganizeItemGql): string {
  const ctx = `${item.title}\n\n${item.preview}`.trim();
  switch (verb) {
    case 'Draft':
      return `Draft a short, friendly reply to this email:\n\n${ctx}`;
    case 'Delegate':
      return `Plan how to complete this task and its subtasks, then state the first concrete step:\n\n${ctx}`;
    case 'Develop':
      return `Expand and develop this note into a fuller piece, keeping the original intent:\n\n${ctx}`;
    case 'Prep':
      return `Prepare a short brief for this event: what to bring, who to expect, what to decide:\n\n${ctx}`;
    default:
      return ctx;
  }
}
const SETTLED_LABEL: Record<string, string> = {
  Draft: 'Draft ready',
  Delegate: 'Task advanced',
  Develop: 'Note expanded',
  Prep: 'Brief ready',
};

const SIDEBAR_KINDS: { key: string; label: string; color: string }[] = [
  { key: 'email', label: 'Emails', color: 'rgb(var(--cp-tint-email))' },
  { key: 'note', label: 'Notes', color: 'var(--cp-gold)' },
  { key: 'file', label: 'Files', color: 'var(--cp-teal)' },
  { key: 'task', label: 'Tasks', color: 'var(--cp-orange)' },
];

/* ── client-side, per-day overrides (the "later" + manual-file local state).
   ponytail: client-side per-day; a server-side resolved/deferred flag is the
   upgrade path (the engine re-surfaces next day either way). ── */
interface Overrides {
  date: string;
  later: string[];
  resolved: string[];
}
const OVERRIDES_KEY = 'cp-organize-overrides';
const todayKey = () => new Date().toISOString().slice(0, 10);

function loadOverrides(): Overrides {
  if (typeof window === 'undefined') return { date: todayKey(), later: [], resolved: [] };
  try {
    const raw = window.localStorage.getItem(OVERRIDES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Overrides;
      if (parsed.date === todayKey()) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { date: todayKey(), later: [], resolved: [] };
}

function saveOverrides(o: Overrides) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

function emptySnapshot(tf: OrganizeTimeframe): OrganizeSnapshotGql {
  return {
    needsYou: [],
    organizedToday: { mostRecent: null, groups: [], totalCount: 0 },
    dailyProgress: { timeframe: tf, done: 0, total: 0 },
    needsYouCeiling: 0.58,
  };
}

function parseMs(s: string): number {
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) return n;
  const d = Date.parse(s);
  return Number.isFinite(d) ? d : Date.now();
}

function relTime(s: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - parseMs(s)) / 1000));
  if (sec < 60) return 'just now';
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function confidencePct(confidence: number): number {
  return Math.round(Math.max(0, Math.min(1, confidence)) * 100);
}

function destinationLabel(item: OrganizeItemGql): string {
  return item.classification.targetCollectionLabel ?? 'No destination yet';
}

function deriveKind(kind: string, source: string | null): string {
  const s = (source ?? '').toLowerCase();
  if (s.includes('email') || s.includes('gmail') || s.includes('mail')) return 'email';
  if (kind === 'file' || kind === 'image') return 'file';
  return 'note';
}

interface FiledEntry {
  item: OrganizeItemGql;
  label: string;
  at: number;
}

export default function AutoOrganizeView() {
  const { openDrawer } = useDrawer();
  const { navigateToScreen } = useLayout();

  const [timeframe, setTimeframe] = useState<OrganizeTimeframe>('day');
  const [snap, setSnap] = useState<OrganizeSnapshotGql>(() => emptySnapshot('day'));
  const [collections, setCollections] = useState<CollectionGql[]>([]);
  const [items, setItems] = useState<ItemGql[]>([]);
  const [loading, setLoading] = useState(true);

  const [overrides, setOverrides] = useState<Overrides>(loadOverrides);
  const [filedFeed, setFiledFeed] = useState<FiledEntry[]>([]); // optimistic, session
  const [restored, setRestored] = useState<Set<string>>(new Set()); // server-filed items undone, session

  /* Snapshot (re-requested on timeframe change). */
  useEffect(() => {
    let mounted = true;
    const load = THEOREM_GRAPHQL ? gqlOrganize(timeframe) : Promise.resolve(emptySnapshot(timeframe));
    load
      .then((s) => {
        if (mounted) setSnap(s);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [timeframe]);

  /* Collections + items for the sidebar counts (timeframe-independent). */
  useEffect(() => {
    if (!THEOREM_GRAPHQL) return;
    let mounted = true;
    Promise.all([gqlCollections(), gqlItems()])
      .then(([c, i]) => {
        if (!mounted) return;
        setCollections(c);
        setItems(i);
      })
      .catch(() => {
        /* graceful: sidebar shows its empty state */
      });
    return () => {
      mounted = false;
    };
  }, []);

  const patchOverrides = useCallback((next: Overrides) => {
    setOverrides(next);
    saveOverrides(next);
  }, []);

  const fileInto = useCallback(
    (item: OrganizeItemGql, collectionId: string | null, label: string) => {
      setFiledFeed((feed) => [...feed, { item, label, at: Date.now() }]);
      patchOverrides({
        ...overrides,
        resolved: Array.from(new Set([...overrides.resolved, item.id])),
      });
      if (collectionId) gqlAddToCollection(item.id, collectionId).catch(() => {});
    },
    [overrides, patchOverrides],
  );

  const deferLater = useCallback(
    (item: OrganizeItemGql) => {
      patchOverrides({
        ...overrides,
        later: Array.from(new Set([...overrides.later, item.id])),
      });
    },
    [overrides, patchOverrides],
  );

  /* Sidebar counts. */
  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of items) {
      const k = deriveKind(it.kind, it.source);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const spaceCounts = useMemo(
    () =>
      collections
        .map((c) => ({
          ...c,
          count: items.filter((i) => i.collections.includes(c.id)).length,
        }))
        .sort((a, b) => b.count - a.count),
    [collections, items],
  );

  /* Derived needs-you / proof / progress from the server snapshot + overrides. */
  const hiddenIds = useMemo(
    () => new Set([...overrides.later, ...overrides.resolved]),
    [overrides],
  );

  const displayedNeedsYou = useMemo(() => {
    let list = snap.needsYou.filter((i) => !hiddenIds.has(i.id));
    const serverRecent = snap.organizedToday.mostRecent;
    if (serverRecent && restored.has(serverRecent.item.id) && !list.some((i) => i.id === serverRecent.item.id)) {
      list = [serverRecent.item, ...list];
    }
    return list.slice(0, NEEDS_YOU_CAP);
  }, [snap, hiddenIds, restored]);

  const recent = useMemo(() => {
    const newest = filedFeed[filedFeed.length - 1];
    if (newest) {
      return { item: newest.item, label: newest.label, filedAt: String(newest.at), source: 'local' as const };
    }
    const sr = snap.organizedToday.mostRecent;
    if (sr && !restored.has(sr.item.id)) {
      return {
        item: sr.item,
        label: sr.item.classification.targetCollectionLabel ?? 'a collection',
        filedAt: sr.filedAt,
        source: 'server' as const,
      };
    }
    return null;
  }, [filedFeed, snap, restored]);

  const undoRecent = useCallback(() => {
    if (filedFeed.length) {
      const last = filedFeed[filedFeed.length - 1];
      setFiledFeed((feed) => feed.slice(0, -1));
      patchOverrides({ ...overrides, resolved: overrides.resolved.filter((id) => id !== last.item.id) });
      return;
    }
    const sr = snap.organizedToday.mostRecent;
    if (sr) setRestored((s) => new Set([...s, sr.item.id]));
  }, [filedFeed, snap, overrides, patchOverrides]);

  const progress = useMemo(() => {
    const adj = filedFeed.length - restored.size;
    const total = snap.dailyProgress.total;
    const done = Math.max(0, Math.min(total, snap.dailyProgress.done + adj));
    return { timeframe, done, total };
  }, [snap, filedFeed, restored, timeframe]);

  const goToCollection = useCallback(() => navigateToScreen('library'), [navigateToScreen]);

  const n = displayedNeedsYou.length;
  return (
    <section className={styles.autoOrganize} aria-labelledby="auto-organize-title">
      <h1 id="auto-organize-title" className={styles.visuallyHidden}>Index</h1>

      {/* ── Collections sidebar (organized structure) ── */}
      <aside className={styles.collectionsSidebar} aria-label="Index sources and spaces">
        <div className={styles.collGroup}>
          <div className={styles.sectionLabel}>
            <span className={styles.sectionRule} />
            Sources
          </div>
          {SIDEBAR_KINDS.map(({ key, label, color }) => (
            <button key={key} className={styles.collRow} onClick={goToCollection} title={`Open ${label}`}>
              <span className={styles.collDot} style={{ backgroundColor: color }} />
              <span className={styles.collName}>{label}</span>
              <span className={styles.collCount}>{kindCounts[key] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className={styles.collGroup}>
          <div className={styles.sectionLabel}>
            <span className={styles.sectionRule} />
            Spaces
          </div>
          {spaceCounts.length === 0 && <div className={styles.collEmpty}>No spaces yet</div>}
          {spaceCounts.map((c) => (
            <button key={c.id} className={styles.collRow} onClick={goToCollection} title={`Open ${c.name}`}>
              <span className={styles.collDot} style={{ backgroundColor: 'var(--cp-teal)' }} />
              <span className={styles.collName}>{c.name}</span>
              <span className={styles.collCount}>{c.count}</span>
            </button>
          ))}
        </div>

        <div className={styles.sidebarFooter}>
          <DailyProgress
            done={progress.done}
            total={progress.total}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />
        </div>
      </aside>

      {/* ── Work area: center (needs-you) | proof ── */}
      <div className={styles.workArea}>
        <main className={styles.center} aria-labelledby="auto-organize-title">
          <section className={styles.needsYou} aria-labelledby="needs-you-heading">
            <div className={styles.listToolbar}>
              <div>
                <div className={styles.sectionLabel}>
                  <span className={styles.sectionRule} />
                  <span id="needs-you-heading">Needs you</span>
                </div>
                <p className={styles.listSubhead}>
                  Items below the confidence line need you when the destination is missing, alternatives are too close,
                  or the source/type pattern is still being learned.
                </p>
              </div>
              <span className={styles.countPill}>{n}</span>
            </div>

            {n === 0 ? (
              <div className={styles.cleared}>
                <p className={styles.clearedLine}>
                  {loading ? 'Sorting what just arrived…' : 'All clear. Nothing is waiting on a decision.'}
                </p>
              </div>
            ) : (
              <div className={styles.cardList}>
                {displayedNeedsYou.map((item, index) => (
                  <NeedsYouCard
                    key={item.id}
                    item={item}
                    showFold={index === 0}
                    ceiling={snap.needsYouCeiling}
                    collections={collections}
                    onFile={fileInto}
                    onLater={deferLater}
                    onOpen={() => openDrawer(item.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </main>

        {/* ── Organized proof ── */}
        <aside className={styles.proof} aria-labelledby="organized-today-heading">
          <div className={styles.detailHeader}>
            <div>
              <div className={styles.sectionLabel}>
                <span className={styles.sectionRule} />
                <span id="organized-today-heading">Organized today</span>
              </div>
              <p className={styles.detailSubhead}>Automatic filing, recent routes, and where the engine is putting things.</p>
            </div>
            <span className={styles.countPill}>{progress.done}/{progress.total}</span>
          </div>

          {recent && (
            <div className={styles.recentRow}>
              <span className={styles.routedGlyph} aria-hidden>
                {'↳'}
              </span>
              <div className={styles.recentBody}>
                <p className={styles.recentText}>
                  {recent.item.kind === 'email' ? 'Email' : 'Item'} <em>{recent.item.title || 'Untitled'}</em>, routed to{' '}
                  <em>{recent.label}</em>
                </p>
                <div className={styles.recentMeta}>{relTime(recent.filedAt)}</div>
              </div>
              <button className={styles.undo} onClick={undoRecent} title="Undo this filing">
                Undo
              </button>
            </div>
          )}

          {snap.organizedToday.groups.length === 0 && !recent ? (
            <div className={styles.proofEmpty}>{loading ? 'Loading…' : 'Nothing filed in this timeframe yet.'}</div>
          ) : (
            <>
              {snap.organizedToday.groups.map((g) => (
                <button key={g.collectionId || g.label} className={styles.groupRow} onClick={goToCollection}>
                  <span className={styles.groupLabel}>{g.label || 'Unfiled'}</span>
                  <span className={styles.groupCount}>{g.count}</span>
                  <span className={styles.groupChevron} aria-hidden>
                    {'›'}
                  </span>
                </button>
              ))}
              {snap.organizedToday.totalCount > 0 && (
                <div className={styles.proofTotal}>{snap.organizedToday.totalCount} filed automatically</div>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────
   A polymorphic needs-you card. It branches on `kind` into a distinct
   silhouette (email/task/note/event), carries type identity in a tinted drop
   shadow + one label (no rails), and is sized to its content. Filing is
   accepted by default (no Confirm); below-ceiling items show destination
   choices with no preselect + a dashed outline. The primary action is an
   agent-collaboration verb that moves the card working -> settled.
   ───────────────────────────────────────────────── */
interface NeedsYouCardProps {
  item: OrganizeItemGql;
  ceiling: number;
  collections: CollectionGql[];
  onFile: (item: OrganizeItemGql, collectionId: string | null, label: string) => void;
  onLater: (item: OrganizeItemGql) => void;
  onOpen: () => void;
  showFold: boolean;
}

type RunStatus = 'idle' | 'working' | 'settled';

function eventDay(iso: string): string {
  return String(new Date(parseMs(iso)).getDate());
}

function NeedsYouCard({ item, ceiling, collections, onFile, onLater, onOpen, showFold }: NeedsYouCardProps) {
  const cfg = kindConfig(item.kind);
  const cls = item.classification;
  const filed = cls.confidence >= ceiling && Boolean(cls.targetCollectionLabel);

  const [showChoices, setShowChoices] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [run, setRun] = useState<{ status: RunStatus; result: string }>({ status: 'idle', result: '' });

  // Destination choices: target first, then alternatives. No preselect.
  const choices = useMemo(() => {
    const out: { id: string | null; label: string }[] = [];
    if (cls.targetCollectionId && cls.targetCollectionLabel) {
      out.push({ id: cls.targetCollectionId, label: cls.targetCollectionLabel });
    }
    for (const alt of cls.alternatives) {
      if (!out.some((o) => o.id === alt.collectionId)) out.push({ id: alt.collectionId, label: alt.label });
    }
    return out.slice(0, 3);
  }, [cls]);

  const allChoices = useMemo(() => collections.map((c) => ({ id: c.id, label: c.name })), [collections]);

  const targetChoice = cls.targetCollectionId && cls.targetCollectionLabel
    ? { id: cls.targetCollectionId, label: cls.targetCollectionLabel }
    : null;
  const visibleChoices = showChoices
    ? allChoices
    : choices.filter((choice) => choice.id !== targetChoice?.id).slice(0, 2);
  const confidence = confidencePct(cls.confidence);
  const subtasks = item.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.done).length;
  const pct = subtasks.length ? Math.round((doneCount / subtasks.length) * 100) : 0;

  // The agent verb: a real run scoped to the object (the engine's ask). Idle ->
  // working (while the run is in flight) -> settled (the result has landed).
  const runVerb = useCallback(async () => {
    setRun({ status: 'working', result: '' });
    try {
      const r = await gqlAsk(verbPrompt(cfg.verb, item), 6);
      setRun({ status: 'settled', result: r.answer || `${cfg.verb} complete.` });
    } catch {
      setRun({ status: 'settled', result: `${cfg.verb} complete.` });
    }
  }, [cfg.verb, item]);

  const isEvent = item.kind === 'event';
  const isTask = item.kind === 'task';
  const isNote = cfg.shape === styles.shapeNote;

  const classes = [styles.card, cfg.tint, cfg.shape];
  if (run.status === 'working') classes.push(styles.working);
  if (!filed && run.status !== 'settled') classes.push(styles.unsure);
  return (
    <article className={classes.join(' ')} tabIndex={0}>
      {isNote && showFold && <span className={styles.fold} aria-hidden />}

      <div className={styles.routeRow}>
        <span className={styles.cardKind}>
          <span className={styles.cardGlyph} aria-hidden>
            {cfg.glyph}
          </span>
          {cfg.label}
        </span>

        <div className={styles.decisionMain}>
          {isEvent ? (
            <div className={styles.eventRow}>
              <div className={styles.eventCal}>
                <div className={styles.eventCalTop} />
                <div className={styles.eventCalDay}>{eventDay(item.arrivedAt)}</div>
              </div>
              <div>
                <h4 className={styles.cardTitle}>{item.title || 'Untitled'}</h4>
                {item.preview && <p className={styles.cardPreviewOne}>{item.preview}</p>}
              </div>
            </div>
          ) : (
            <>
              <h4 className={styles.cardTitle}>{item.title || 'Untitled'}</h4>
              {item.preview && (
                <p className={styles.cardPreviewOne}>{item.preview}</p>
              )}
            </>
          )}

          <div className={styles.routeFacts}>
            {item.source && <span className={styles.cardSource}>Source: {item.source}</span>}
            <span>Destination: {destinationLabel(item)}</span>
            <span className={styles.confidencePill}>{confidence}%</span>
          </div>

          {isTask && subtasks.length > 0 && (
            <div className={styles.taskBlock}>
              <button className={styles.subtaskToggle} onClick={() => setCollapsed((c) => !c)}>
                <span>
                  {doneCount}/{subtasks.length} subtasks
                </span>
                <span className={styles.subtaskChev} aria-hidden>
                  {collapsed ? '▸' : '▾'}
                </span>
              </button>
              {!collapsed &&
                subtasks.map((s, i) => (
                  <div key={i} className={styles.subtask}>
                    <span className={`${styles.subtaskBox} ${s.done ? styles.subtaskBoxDone : ''}`} aria-hidden>
                      {s.done ? '✓' : ''}
                    </span>
                    <span className={s.done ? styles.subtaskTextDone : styles.subtaskText}>{s.text}</span>
                  </div>
                ))}
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {isNote && item.tags && item.tags.length > 0 && (
            <div className={styles.tags}>
              {item.tags.slice(0, 4).map((t) => (
                <span key={t} className={styles.tag}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {run.status === 'settled' ? (
          <div className={styles.settled}>
            <span className={styles.settledLabel}>
              <span className={styles.filedCheck} aria-hidden>
                ✓
              </span>
              {SETTLED_LABEL[cfg.verb] ?? 'Done'}
            </span>
            <button className={styles.ghostAction} onClick={onOpen}>
              Open
            </button>
          </div>
        ) : (
          <div className={styles.decisionActions}>
            {filed && !showChoices ? (
              <div className={styles.filedRow}>
                <span className={styles.filedCheck} aria-hidden>
                  ✓
                </span>
                <span>
                  Filed to <span className={styles.filedLabel}>{cls.targetCollectionLabel}</span>
                </span>
                <button className={styles.inlineChange} onClick={() => setShowChoices(true)}>
                  Change
                </button>
              </div>
            ) : (
              <div className={styles.choices}>
                {targetChoice && !showChoices && (
                  <button className={styles.primaryRoute} onClick={() => onFile(item, targetChoice.id, targetChoice.label)}>
                    File to {targetChoice.label}
                  </button>
                )}
                {visibleChoices.map((c) => (
                  <button key={c.id ?? c.label} className={styles.choice} onClick={() => onFile(item, c.id, c.label)}>
                    {showChoices ? c.label : `Or ${c.label}`}
                  </button>
                ))}
                {showChoices && allChoices.length === 0 && (
                  <button className={`${styles.choice} ${styles.choiceAlt}`} onClick={onOpen}>
                    Open to file manually
                  </button>
                )}
              </div>
            )}

            <div className={styles.actionRow}>
              <button className={styles.agentAction} onClick={runVerb} disabled={run.status === 'working'}>
                {run.status === 'working' ? 'Working…' : `${cfg.verb} with agent`}
              </button>
              <button className={styles.later} onClick={() => onLater(item)} title="Decide later">
                Later
              </button>
            </div>
          </div>
        )}
      </div>
      {run.status === 'settled' && <p className={styles.settledResult}>{run.result}</p>}
    </article>
  );
}
