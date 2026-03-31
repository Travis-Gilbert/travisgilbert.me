'use client';

import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { apiFetch } from '@/lib/commonplace-api';
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
}

interface ActivityItem {
  id: number;
  type: 'connection' | 'tension' | 'cluster' | 'enrichment';
  time: string;
  text: string;
  strength: number | null;
  is_new: boolean;
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
}

interface HomeData {
  hero_question: HeroQuestion;
  activity: ActivityItem[];
  threads: Thread[];
  pending_reviews: number;
}

/* ─────────────────────────────────────────────────
   Mock data (until backend endpoint exists)
   ───────────────────────────────────────────────── */

const MOCK_HERO: HeroQuestion = {
  text: "How does Shannon's information theory connect to Hamming's generative learning?",
  evidence: { entities: 3, bridges: 2, holes: 1 },
  evidence_score: 87,
  tension_score: 72,
};

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 1, type: 'connection', time: '2m', text: 'TPU Research Cloud and Google TRC program now share 3 entities', strength: 94, is_new: true },
  { id: 2, type: 'tension', time: '8m', text: 'Two sources disagree on evolutionary game theory\'s relationship to mechanism design', strength: null, is_new: true },
  { id: 3, type: 'connection', time: '14m', text: 'Hamming\'s generative learning and Theseus encode knowledge through operation, not instruction', strength: 87, is_new: false },
  { id: 4, type: 'cluster', time: '31m', text: 'Semiotics cluster expanded: 4 new objects joined via Saussure bridge', strength: null, is_new: false },
  { id: 5, type: 'enrichment', time: '1h', text: 'NER extracted 12 new entities from your last 3 captures', strength: null, is_new: false },
];

const MOCK_THREADS: Thread[] = [
  { id: 1, object_type: 'research', title: 'Self-organizing epistemic systems', heat: 0.92, objects: 23, color: '#C4503C', metadata: { authors: 'Maturana, Varela, Luhmann', venue: 'Systems Research & Behavioral Science', subtitle: 'Connected to autopoiesis via structural coupling' } },
  { id: 2, object_type: 'task', title: 'Fix Django serializer null-safety', heat: 0.8, objects: 3, color: '#C49A4A', metadata: { priority: 'high', project: 'CommonPlace', subtasks: [{ text: 'Patch EdgeCompactSerializer', done: true }, { text: 'Patch ObjectConnectionSerializer', done: false }, { text: 'Add null guards to FK traversal', done: false }] } },
  { id: 3, object_type: 'concept', title: 'Structural Hole Detection', heat: 0.65, objects: 12, color: '#2D5F6B', metadata: { connections: 17, clusters: ['Game Theory', 'Network Science', 'Sociology'], snippet: 'Gaps in a network where a bridge could form between disconnected clusters' } },
  { id: 4, object_type: 'event', title: 'Corpus Crawl Batch 2', heat: 0.3, objects: 5, color: '#7B5EA7', metadata: { month: 'Apr', day: '3', time: '9:00 AM', duration: '~4h', status: 'upcoming' } },
];

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
  const [data, setData] = useState<HomeData>({
    hero_question: MOCK_HERO,
    activity: MOCK_ACTIVITY,
    threads: MOCK_THREADS,
    pending_reviews: 2,
  });

  // Try to fetch real data from backend
  useEffect(() => {
    apiFetch<HomeData>('/home/')
      .then((d) => {
        if (d.hero_question) setData(d);
      })
      .catch(() => { /* stay on mock data */ });
  }, []);

  const { hero_question: hero, activity, threads, pending_reviews } = data;

  return (
    <div className={styles.homeView}>
      <div className={styles.content}>
        {/* ── Hero ── */}
        <motion.div
          className={styles.hero}
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', ...SPRING_GENTLE }}
        >
          <div className={styles.heroLabel}>
            <span className={styles.heroPulseDot} />
            The engine has found a live question
          </div>
          <h2 className={styles.heroQuestion}>{hero.text}</h2>
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

            {activity.map((item, i) => {
              const typeInfo = TYPE_MAP[item.type] || TYPE_MAP.connection;
              return (
                <motion.div
                  key={item.id}
                  className={styles.activityItem}
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
              <div className={styles.reviewCta}>
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

            {threads.map((thread, i) => {
              const Renderer = THREAD_RENDERERS[thread.object_type] || ResearchThread;
              return (
                <motion.div
                  key={thread.id}
                  className={styles.threadCard}
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
