'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { AskRetrievalObject } from '@/lib/ask-theseus';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import styles from './AnswerObjectShape.module.css';

/** Strip markdown/HTML artifacts from body_preview for clean display. */
function cleanPreview(raw: string | undefined): string {
  if (!raw) return '';
  let t = raw;
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '');           // ![alt](url)
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');         // [text](url) -> text
  t = t.replace(/<[^>]+>/g, '');                          // HTML tags
  t = t.replace(/^#{1,6}\s+/gm, '');                     // ## headers
  t = t.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');         // **bold**/*italic*
  t = t.replace(/^[-*_]{3,}\s*$/gm, '');                  // horizontal rules
  t = t.replace(/\|/g, ' ');                              // pipe tables
  t = t.replace(/^[-|:\s]+$/gm, '');                      // table separator rows
  t = t.replace(/^https?:\/\/\S+\s*$/gm, '');            // standalone URLs
  t = t.replace(/\n{2,}/g, '\n').replace(/[ \t]+/g, ' ');
  t = t.trim();
  if (t.length > 200) {
    const cut = t.slice(0, 200);
    const sp = cut.lastIndexOf(' ');
    t = (sp > 120 ? cut.slice(0, sp) : cut) + '...';
  }
  return t;
}

interface AnswerObjectShapeProps {
  object: AskRetrievalObject;
  index?: number;
  onClick?: (id: number) => void;
}

export default function AnswerObjectShape({ object: obj, index = 0, onClick }: AnswerObjectShapeProps) {
  const reduced = useReducedMotion();
  const identity = getObjectTypeIdentity(obj.object_type_slug);
  const slug = obj.object_type_slug;

  return (
    <motion.div
      className={styles.shape}
      style={{ '--shape-glow': identity.color } as React.CSSProperties}
      onClick={() => onClick?.(obj.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(obj.id); }}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.35, delay: index * 0.08, type: 'spring', stiffness: 200, damping: 20 }}
    >
      {slug === 'task' && <TaskShape obj={obj} />}
      {slug === 'event' && <EventShape obj={obj} />}
      {slug === 'source' && <SourceShape obj={obj} identity={identity} />}
      {slug === 'hunch' && <HunchShape obj={obj} />}
      {!['task', 'event', 'source', 'hunch'].includes(slug) && (
        <DefaultShape obj={obj} identity={identity} />
      )}
    </motion.div>
  );
}

function TaskShape({ obj }: { obj: AskRetrievalObject }) {
  const priClass = obj.priority === 'high' ? styles.priHigh : obj.priority === 'low' ? styles.priLow : '';
  const progressPct = typeof obj.progress === 'number' ? obj.progress : 0;

  return (
    <div className={`${styles.task} ${priClass}`}>
      <div className={styles.taskRow}>
        <div className={`${styles.taskChk} ${obj.done ? styles.done : ''}`}>
          {obj.done && '✓'}
        </div>
        <div className={`${styles.taskTitle} ${obj.done ? styles.doneText : ''}`}>{obj.title}</div>
      </div>
      <div className={styles.taskMeta}>
        {obj.due_date && <span className={styles.taskDue}>{obj.due_date}</span>}
        {obj.project_name && <span className={styles.taskProject}>{obj.project_name}</span>}
        {obj.provenance && <span className={styles.provBadge}>{obj.provenance}</span>}
      </div>
      {obj.subtasks && obj.subtasks.length > 0 && (
        <div className={styles.taskSubs}>
          {obj.subtasks.map((st, i) => (
            <div key={i} className={`${styles.taskSub} ${st.done ? styles.done : ''}`}>
              <span className={styles.subChk}>{st.done ? '✓' : '○'}</span>
              <span>{st.title}</span>
            </div>
          ))}
        </div>
      )}
      {progressPct > 0 && (
        <div className={styles.taskProgress}>
          <div
            className={styles.taskProgressFill}
            style={{
              width: `${Math.min(progressPct, 100)}%`,
              background: obj.priority === 'high' ? '#D85A30' : 'var(--cp-ask-positive)',
            }}
          />
        </div>
      )}
    </div>
  );
}

function EventShape({ obj }: { obj: AskRetrievalObject }) {
  const date = obj.event_date ? new Date(obj.event_date) : null;
  const month = date ? date.toLocaleString('en', { month: 'short' }).toUpperCase() : '';
  const day = date ? date.getDate() : '';

  return (
    <div className={styles.event}>
      <div className={styles.calMini}>
        <div className={styles.calMo}>{month}</div>
        <div className={styles.calDay}>{day}</div>
      </div>
      <div>
        <div className={styles.eventTitle}>{obj.title}</div>
        {obj.event_time && (
          <div className={styles.eventTime}>
            {obj.event_time}
            {obj.event_duration && ` (${obj.event_duration})`}
          </div>
        )}
        {obj.body_preview && <div className={styles.eventBody}>{cleanPreview(obj.body_preview)}</div>}
        {obj.provenance && <span className={styles.provBadge}>{obj.provenance}</span>}
      </div>
    </div>
  );
}

function SourceShape({ obj, identity }: { obj: AskRetrievalObject; identity: { color: string } }) {
  return (
    <div className={styles.source} style={{ borderTopColor: identity.color }}>
      <div className={styles.sourceHeader}>
        <span className={styles.dot} style={{ background: identity.color }} />
        <span className={styles.sourceTitle}>{obj.title}</span>
      </div>
      {(obj.author || obj.year) && (
        <div className={styles.sourceAuthor}>
          {obj.author}{obj.author && obj.year ? ', ' : ''}{obj.year}
        </div>
      )}
      {obj.body_preview && <div className={styles.sourceBody}>{cleanPreview(obj.body_preview)}</div>}
      {obj.edge_count > 0 && <div className={styles.edgeCount}>{obj.edge_count} edges</div>}
    </div>
  );
}

function HunchShape({ obj }: { obj: AskRetrievalObject }) {
  return (
    <div className={styles.hunch}>
      <div className={styles.hunchLabel}>Hunch</div>
      <div className={styles.hunchText}>{obj.title}</div>
      {obj.body_preview && <div className={styles.hunchBody}>{cleanPreview(obj.body_preview)}</div>}
      {obj.confidence && <div className={styles.hunchConfidence}>confidence: {obj.confidence}</div>}
    </div>
  );
}

function DefaultShape({ obj, identity }: { obj: AskRetrievalObject; identity: { color: string } }) {
  return (
    <div className={styles.default}>
      <div className={styles.defaultHeader}>
        <span className={styles.dot} style={{ background: identity.color }} />
        <span className={styles.defaultTitle}>{obj.title}</span>
      </div>
      {obj.body_preview && <div className={styles.defaultBody}>{cleanPreview(obj.body_preview)}</div>}
      {obj.edge_count > 0 && <div className={styles.edgeCount}>{obj.edge_count} edges</div>}
    </div>
  );
}
