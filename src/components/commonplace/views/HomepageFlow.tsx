'use client';

import AnswerObjectShape from '../ask/AnswerObjectShape';
import type { AskRetrievalObject } from '@/lib/ask-theseus';
import type { EngineDiscovery } from './EngineDiscoveryFeed';
import styles from './HomepageFlow.module.css';

interface HomepageFlowProps {
  objects: AskRetrievalObject[];
  connections?: EngineDiscovery[];
  onOpenObject?: (id: number) => void;
}

/**
 * Conversation-style layout for homepage objects.
 * Pattern repeats in groups of 4:
 *   Row 1: staggered (left object top-aligned, right object shifted down)
 *   Row 2: pair (two objects side by side, equal)
 * This fills the space instead of leaving empty gaps.
 */
export default function HomepageFlow({ objects, onOpenObject }: HomepageFlowProps) {
  const groups = buildGroups(objects);

  return (
    <div className={styles.flow}>
      {groups.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && <div className={styles.connector} />}
          {group.type === 'staggered' && (
            <div className={styles.rowStaggered}>
              <div className={styles.staggerLeft}>
                <AnswerObjectShape object={group.objects[0]} index={gi * 2} onClick={onOpenObject} />
              </div>
              {group.objects[1] && (
                <div className={styles.staggerRight}>
                  <AnswerObjectShape object={group.objects[1]} index={gi * 2 + 1} onClick={onOpenObject} />
                </div>
              )}
            </div>
          )}
          {group.type === 'pair' && (
            <div className={styles.rowPair}>
              {group.objects.map((obj, oi) => (
                <div key={obj.id} className={styles.pairCell}>
                  <AnswerObjectShape object={obj} index={gi * 2 + oi} onClick={onOpenObject} />
                </div>
              ))}
            </div>
          )}
          {group.type === 'single' && (
            <div className={styles.rowSingle}>
              <AnswerObjectShape object={group.objects[0]} index={gi * 2} onClick={onOpenObject} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type Group = { type: 'staggered' | 'pair' | 'single'; objects: AskRetrievalObject[] };

function buildGroups(objects: AskRetrievalObject[]): Group[] {
  const groups: Group[] = [];
  let i = 0;

  while (i < objects.length) {
    const phase = groups.length % 2;

    if (phase === 0) {
      // Staggered row: left + right in the same band
      if (i + 1 < objects.length) {
        groups.push({ type: 'staggered', objects: [objects[i], objects[i + 1]] });
        i += 2;
      } else {
        groups.push({ type: 'single', objects: [objects[i]] });
        i++;
      }
    } else {
      // Paired row: two objects side by side, equal width
      if (i + 1 < objects.length) {
        groups.push({ type: 'pair', objects: [objects[i], objects[i + 1]] });
        i += 2;
      } else {
        groups.push({ type: 'single', objects: [objects[i]] });
        i++;
      }
    }
  }

  return groups;
}
