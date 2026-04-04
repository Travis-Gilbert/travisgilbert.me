'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { apiFetch } from '@/lib/commonplace-api';
import type { NavigationTarget, ScreenType, ViewType } from '@/lib/commonplace';
import { useDrawer } from '@/lib/providers/drawer-provider';
import { useLayout } from '@/lib/providers/layout-provider';
import DualBar from '../shared/DualBar';
import styles from './HomeView.module.css';

/* ─────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────── */

interface HeroQuestion {
  text: string;
  evidence: { entities: number; bridges: number; holes: number };
  evidence_score: number;
  tension_score: number;
  target?: NavigationTarget;
}

interface ActivityItem {
  id: number;
  type: 'connection' | 'tension' | 'cluster' | 'enrichment';
  time: string;
  text: string;
  strength: number | null;
  is_new: boolean;
  target?: NavigationTarget;
}

interface ThreadMetadata {
  authors?: string;
  venue?: string;
  subtitle?: string;
  priority?: string;
  project?: string;
  subtasks?: Array<{ text: string; done: boolean }>;
  connections?: number;
  clusters?: string[];
  snippet?: string;
  date?: string;
  month?: string;
  day?: string;
  time?: string;
  duration?: string;
  status?: string;
}

interface Thread {
  id: number;
  object_type: string;
  title: string;
  heat: number;
  objects: number;
  metadata: ThreadMetadata;
  color?: string;
  target?: NavigationTarget;
}

interface HomeData {
  hero_question: HeroQuestion;
  activity: ActivityItem[];
  threads: Thread[];
  pending_reviews: number;
  pending_reviews_target?: NavigationTarget;
}

/* ─────────────────────────────────────────────────
   Live-state fallback
   ───────────────────────────────────────────────── */

const EMPTY_HOME_DATA: HomeData = {
  hero_question: {
    text: '',
    evidence: { entities: 0, bridges: 0, holes: 0 },
    evidence_score: 0,
    tension_score: 0,
  },
  activity: [],
  threads: [],
  pending_reviews: 0,
  pending_reviews_target: {
    kind: 'view',
    view: { type: 'connection-review' },
  },
};

/* ─────────────────────────────────────────────────
   Activity type map
   ───────────────────────────────────────────────── */

const TYPE_MAP: Record<string, { accent: string; icon: string }> = {
  connection: { accent: '#C4503C', icon: '\u27F7' },
  tension: { accent: '#C49A4A', icon: '\u25B3' },
  cluster: { accent: '#2D5F6B', icon: '\u25C9' },
  enrichment: { accent: '#7B5EA7', icon: '\u25C6' },
};

/* ─────────────────────────────────────────────────
   Polymorphic thread card renderers
   ───────────────────────────────────────────────── */

function ResearchThread({ thread }: { thread: Thread }) {
  const m = thread.metadata;
  const color = thread.color || '#C4503C';
  return (
    <div className={styles.researchCard} style={{ borderLeftColor: color }}>
      <div className={styles.researchFold} />
      <h4 className={styles.researchTitle}>{thread.title}</h4>
      {m.authors && <p className={styles.researchAuthors}>{m.authors}</p>}
      {m.venue && <p className={styles.researchVenue}>{m.venue}</p>}
      {m.subtitle && <p className={styles.researchSubtitle}>{m.subtitle}</p>}
      <div className={styles.researchFooter}>
        <span className={styles.researchObjects}>{thread.objects} objects</span>
        <div style={{ flex: 1, height: 2, backgroundColor: 'rgba(42,36,32,0.05)', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(thread.heat * 100)}%`, height: '100%', backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

function TaskThread({ thread }: { thread: Thread }) {
  const m = thread.metadata;
  const subtasks = m.subtasks ?? [];
  const done = subtasks.filter((s) => s.done).length;
  const pct = subtasks.length > 0 ? Math.round((done / subtasks.length) * 100) : 0;
  const priColor = m.priority === 'high' ? '#C4503C' : '#C49A4A';
  return (
    <div className={styles.taskCard} style={{ borderLeft: `3px solid ${priColor}` }}>
      <div className={styles.taskHeader}>
        <div className={styles.taskCheckbox} style={{ borderColor: priColor }} />
        <h4 className={styles.taskTitle}>{thread.title}</h4>
        {m.project && <span className={styles.taskProject}>{m.project}</span>}
      </div>
      {subtasks.map((s, i) => (
        <div key={i} className={styles.taskSubtask}>
          <div
            className={styles.subtaskCheckbox}
            style={{
              borderColor: s.done ? priColor : 'var(--cp-text-faint)',
              backgroundColor: s.done ? `${priColor}15` : 'transparent',
            }}
          >
            {s.done && <span className={styles.subtaskCheck} style={{ color: priColor }}>{'\u2713'}</span>}
          </div>
          <span
            className={styles.subtaskText}
            style={{
              color: s.done ? 'var(--cp-text-faint)' : 'var(--cp-text-muted)',
              textDecoration: s.done ? 'line-through' : 'none',
            }}
          >
            {s.text}
          </span>
        </div>
      ))}
      <div className={styles.taskProgress}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${pct}%`, backgroundColor: priColor }} />
        </div>
        <span className={styles.progressPct}>{pct}%</span>
      </div>
    </div>
  );
}

function ConceptThread({ thread }: { thread: Thread }) {
  const m = thread.metadata;
  const color = thread.color || '#2D5F6B';
  return (
    <div className={styles.conceptCard} style={{ border: `1.5px solid ${color}30` }}>
      <div className={styles.conceptHeader}>
        <div
          className={styles.conceptBadge}
          style={{ backgroundColor: `${color}18`, border: `1.5px solid ${color}35`, color }}
        >
          {m.connections ?? 0}
        </div>
        <h4 className={styles.conceptTitle}>{thread.title}</h4>
      </div>
      {m.snippet && <p className={styles.conceptSnippet}>{m.snippet}</p>}
      {m.clusters && (
        <div className={styles.conceptTags}>
          {m.clusters.map((c) => (
            <span key={c} className={styles.conceptTag} style={{ color, backgroundColor: `${color}10` }}>{c}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function EventThread({ thread }: { thread: Thread }) {
  const m = thread.metadata;
  const color = thread.color || '#7B5EA7';
  return (
    <div className={styles.eventCard} style={{ borderLeft: `3px solid ${color}` }}>
      <div className={styles.eventCalendar} style={{ border: `1px solid ${color}30` }}>
        <div className={styles.eventCalendarMonth} style={{ backgroundColor: color }}>{m.month ?? 'Jan'}</div>
        <div className={styles.eventCalendarDay}>{m.day ?? '1'}</div>
      </div>
      <div>
        <h4 className={styles.eventTitle}>{thread.title}</h4>
        <div className={styles.eventMeta}>
          {m.time}{m.duration ? ` \u00B7 ${m.duration}` : ''}
        </div>
        {m.status && (
          <div className={styles.eventStatus} style={{ color, backgroundColor: `${color}10` }}>{m.status}</div>
        )}
      </div>
    </div>
  );
}

const THREAD_RENDERERS: Record<string, React.ComponentType<{ thread: Thread }>> = {
  research: ResearchThread,
  task: TaskThread,
  concept: ConceptThread,
  event: EventThread,
};

/* ─────────────────────────────────────────────────
   Main HomeView component
   ───────────────────────────────────────────────── */

const SPRING = { stiffness: 300, damping: 25 };
const SPRING_GENTLE = { stiffness: 200, damping: 20 };

export default function HomeView() {
  const reduced = useReducedMotion();
  const { openDrawer } = useDrawer();
  const { launchView, navigateToScreen } = useLayout();
  const [data, setData] = useState<HomeData>(EMPTY_HOME_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    apiFetch<HomeData>('/home/')
      .then((d) => {
        if (!isMounted) return;
        if (d?.hero_question) {
          setData(d);
          setLoadError(null);
          return;
        }
        setLoadError('Index API returned an incomplete CommonPlace home payload.');
      })
      .catch(() => {
        if (!isMounted) return;
        setLoadError('Could not load live CommonPlace home data from Index API.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const dispatchTarget = useCallback((target?: NavigationTarget) => {
    if (!target) return;
    if (target.kind === 'object') {
      const slug = target.object?.slug || (target.object?.id != null ? String(target.object.id) : '');
      if (slug) openDrawer(slug);
      return;
    }
    if (target.kind === 'view' && target.view?.type) {
      launchView(target.view.type as ViewType, target.view.context);
      return;
    }
    if (target.kind === 'screen' && target.screen?.type) {
      navigateToScreen(target.screen.type as ScreenType);
    }
  }, [openDrawer, launchView, navigateToScreen]);

  const inferThreadTarget = useCallback((thread: Thread): NavigationTarget | undefined => {
    if (thread.target) return thread.target;
    if (thread.object_type === 'research') {
      return { kind: 'screen', screen: { type: 'models' } };
    }
    if (thread.object_type === 'concept') {
      return { kind: 'view', view: { type: 'network' } };
    }
    if (thread.object_type === 'task' || thread.object_type === 'event') {
      return { kind: 'object', object: { id: thread.id } };
    }
    return undefined;
  }, []);

  const inferActivityTarget = useCallback((item: ActivityItem): NavigationTarget | undefined => {
    if (item.target) return item.target;
    if (item.type === 'cluster') {
      return { kind: 'view', view: { type: 'network' } };
    }
    if (item.type === 'enrichment' && item.text.startsWith('Updated ')) {
      return { kind: 'object', object: { id: item.id } };
    }
    return undefined;
  }, []);

  const {
    hero_question: hero,
    activity,
    threads,
    pending_reviews,
    pending_reviews_target,
  } = data;
  const heroTarget = hero.target ?? { kind: 'screen', screen: { type: 'models' } };
  const heroLabel = isLoading
    ? 'Connecting to Index API'
    : loadError
      ? 'Live home data unavailable'
      : 'The engine has found a live question';
  const heroText = hero.text || (isLoading ? 'Loading live CommonPlace activity...' : 'No live question is active yet.');
  const sectionMessage = loadError || (isLoading ? 'Loading live graph activity…' : '');

  return (
    <div className={styles.homeView}>
      <div className={styles.content}>
        {/* ── Hero ── */}
        <motion.div
          className={styles.hero}
          data-clickable={Boolean(heroTarget)}
          role={heroTarget ? 'button' : undefined}
          tabIndex={heroTarget ? 0 : undefined}
          onClick={heroTarget ? () => dispatchTarget(heroTarget) : undefined}
          onKeyDown={heroTarget ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              dispatchTarget(heroTarget);
            }
          } : undefined}
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', ...SPRING_GENTLE }}
        >
          <div className={styles.heroLabel}>
            <span className={styles.heroPulseDot} />
            {heroLabel}
          </div>
          <h2 className={styles.heroQuestion}>{heroText}</h2>
          <div className={styles.heroEvidence}>
            <span>{hero.evidence.entities} shared entities</span>
            <span className={styles.heroEvidenceDot}>&middot;</span>
            <span>{hero.evidence.bridges} semantic bridges</span>
            <span className={styles.heroEvidenceDot}>&middot;</span>
            <span>{hero.evidence.holes} structural hole{hero.evidence.holes !== 1 ? 's' : ''}</span>
          </div>
          <div className={styles.heroBars}>
            <DualBar
              label1="Evidence" value1={hero.evidence_score} color1="#2D5F6B"
              label2="Tension" value2={hero.tension_score} color2="#C49A4A"
            />
          </div>
        </motion.div>

        {/* ── Two-column layout ── */}
        <div className={styles.twoColumn}>
          {/* Left: Engine Activity */}
          <div>
            <div className={styles.sectionLabel}>
              <span className={styles.sectionRule} />
              Engine Activity
            </div>

            {activity.length === 0 && (
              <div className={styles.reviewCta} data-clickable={false}>
                <div className={styles.reviewCtaTitle}>
                  {sectionMessage || 'No engine activity yet'}
                </div>
                <p className={styles.reviewCtaText}>
                  The CommonPlace home screen now reads directly from `Index-API`.
                </p>
              </div>
            )}

            {activity.map((item, i) => {
              const typeInfo = TYPE_MAP[item.type] || TYPE_MAP.connection;
              const target = inferActivityTarget(item);
              return (
                <motion.div
                  key={item.id}
                  className={styles.activityItem}
                  data-clickable={Boolean(target)}
                  role={target ? 'button' : undefined}
                  tabIndex={target ? 0 : undefined}
                  onClick={target ? () => dispatchTarget(target) : undefined}
                  onKeyDown={target ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      dispatchTarget(target);
                    }
                  } : undefined}
                  style={{ '--activity-accent': typeInfo.accent } as React.CSSProperties}
                  initial={reduced ? false : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduced ? { duration: 0 } : {
                    type: 'spring',
                    ...SPRING,
                    delay: i * 0.09,
                  }}
                >
                  <div className={styles.activityRow}>
                    <span className={styles.activityIcon} style={{ color: typeInfo.accent }}>{typeInfo.icon}</span>
                    <div className={styles.activityBody}>
                      <div className={styles.activityMeta}>
                        <span className={styles.activityType} style={{ color: typeInfo.accent }}>{item.type}</span>
                        {item.is_new && <span className={styles.activityNewDot} style={{ backgroundColor: typeInfo.accent }} />}
                        <span className={styles.activityTime}>{item.time}</span>
                      </div>
                      <p className={styles.activityText}>{item.text}</p>
                      {item.strength != null && (
                        <div className={styles.activityStrength}>
                          <div className={styles.strengthTrack}>
                            <div className={styles.strengthFill} style={{ width: `${item.strength}%`, backgroundColor: typeInfo.accent }} />
                          </div>
                          <span className={styles.strengthValue}>{item.strength}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Review CTA */}
            {pending_reviews > 0 && (
              <div
                className={styles.reviewCta}
                data-clickable={Boolean(pending_reviews_target)}
                role={pending_reviews_target ? 'button' : undefined}
                tabIndex={pending_reviews_target ? 0 : undefined}
                onClick={pending_reviews_target ? () => dispatchTarget(pending_reviews_target) : undefined}
                onKeyDown={pending_reviews_target ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    dispatchTarget(pending_reviews_target);
                  }
                } : undefined}
              >
                <div className={styles.reviewCtaTitle}>{pending_reviews} connection{pending_reviews !== 1 ? 's' : ''} awaiting review</div>
                <p className={styles.reviewCtaText}>Your feedback trains the scorer. Each review improves accuracy.</p>
              </div>
            )}
          </div>

          {/* Right: Active Threads */}
          <div>
            <div className={styles.sectionLabel}>
              <span className={styles.sectionRule} />
              Active Threads
            </div>

            {threads.length === 0 && (
              <div className={styles.reviewCta} data-clickable={false}>
                <div className={styles.reviewCtaTitle}>
                  {sectionMessage || 'No active threads yet'}
                </div>
                <p className={styles.reviewCtaText}>
                  As questions, tasks, clusters, and events land in the graph, they will appear here.
                </p>
              </div>
            )}

            {threads.map((thread, i) => {
              const Renderer = THREAD_RENDERERS[thread.object_type] || ResearchThread;
              const target = inferThreadTarget(thread);
              return (
                <motion.div
                  key={thread.id}
                  className={styles.threadCard}
                  data-clickable={Boolean(target)}
                  role={target ? 'button' : undefined}
                  tabIndex={target ? 0 : undefined}
                  onClick={target ? () => dispatchTarget(target) : undefined}
                  onKeyDown={target ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      dispatchTarget(target);
                    }
                  } : undefined}
                  initial={reduced ? false : { opacity: 0, y: 8 + i * 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduced ? { duration: 0 } : {
                    type: 'spring',
                    ...SPRING,
                    delay: 0.2 + i * 0.1,
                  }}
                >
                  <Renderer thread={thread} />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
