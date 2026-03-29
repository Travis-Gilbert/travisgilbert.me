'use client';

import { useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import type { AskRetrievalResponse, AskSynthesisResponse } from '@/lib/ask-theseus';
import ObjectRef from './ObjectRef';
import AnswerObjectShape from './AnswerObjectShape';
import AskFeedbackBar from './AskFeedbackBar';
import styles from './AskAnswerCard.module.css';

const SPRING_GENTLE = { stiffness: 200, damping: 20 };

interface AskAnswerCardProps {
  question: string;
  retrieval: AskRetrievalResponse;
  synthesis: AskSynthesisResponse;
  onOpenObject?: (id: number) => void;
  onFeedbackGiven?: () => void;
}

/**
 * Parse answer text, replacing {{obj:ID}} tokens with ObjectRef components.
 */
function parseAnswer(
  text: string,
  objects: AskRetrievalResponse['retrieval']['objects'],
  onOpenObject?: (id: number) => void,
): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\{\{obj:(\d+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const objId = parseInt(match[1], 10);
    const obj = objects.find((o) => o.id === objId);
    if (obj) {
      parts.push(
        <ObjectRef
          key={`ref-${objId}-${match.index}`}
          id={obj.id}
          title={obj.title}
          typeSlug={obj.object_type_slug}
          typeColor={obj.object_type_color}
          onClick={onOpenObject}
        />,
      );
    } else {
      parts.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export default function AskAnswerCard({
  question,
  retrieval,
  synthesis,
  onOpenObject,
  onFeedbackGiven,
}: AskAnswerCardProps) {
  const reduced = useReducedMotion();
  const objects = retrieval.retrieval.objects;
  const engines = retrieval.retrieval.engines_used;

  const referencedObjects = useMemo(
    () => objects
      .filter((o) => synthesis.referenced_object_ids.includes(o.id))
      .slice(0, 3),
    [objects, synthesis.referenced_object_ids],
  );

  const paragraphs = useMemo(() => {
    const blocks = synthesis.answer.split('\n\n').filter(Boolean);
    return blocks.map((block) => parseAnswer(block, objects, onOpenObject));
  }, [synthesis.answer, objects, onOpenObject]);

  return (
    <AnimatePresence>
      <motion.div
        className={styles.card}
        initial={reduced ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', ...SPRING_GENTLE }}
      >
        <div className={styles.question}>{question}</div>

        <div className={styles.body}>
          {paragraphs.map((nodes, i) => (
            <p key={i}>{nodes}</p>
          ))}
        </div>

        {referencedObjects.length > 0 && (
          <div className={styles.objGroup}>
            {referencedObjects.map((obj, i) => (
              <AnswerObjectShape
                key={obj.id}
                object={obj}
                index={i}
                onClick={onOpenObject}
              />
            ))}
          </div>
        )}

        <motion.div
          className={styles.provStrip}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduced ? { duration: 0 } : { duration: 0.3, delay: 0.2 }}
        >
          <span className={styles.provLabel}>Engines</span>
          {engines.map((e) => (
            <span key={e} className={styles.engBadge}>{e}</span>
          ))}
          <span className={styles.objCount}>
            {objects.length} objects, {retrieval.retrieval.claims.length} claims
          </span>
        </motion.div>

        <AskFeedbackBar
          questionId={retrieval.question_id}
          retrievedObjectIds={objects.map((o) => o.id)}
          onFeedback={onFeedbackGiven ? () => onFeedbackGiven() : undefined}
        />
      </motion.div>
    </AnimatePresence>
  );
}
