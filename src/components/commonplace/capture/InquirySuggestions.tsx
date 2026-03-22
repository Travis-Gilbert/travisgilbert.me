'use client';

import type { ComponentType } from 'react';
import { HelpCircle, WarningCircle, Compass, WarningTriangle } from 'iconoir-react';
import {
  fetchInquirySuggestions,
  useApiData,
  type InquirySuggestionData,
} from '@/lib/commonplace-api';
import TerminalBlock from '../engine/TerminalBlock';

interface InquirySuggestionsProps {
  onSelectQuery: (text: string) => void;
}

/**
 * Gap-driven suggestions rendered inside a TerminalBlock.
 * The graph is "thinking out loud": unanswered questions,
 * evidence gaps, stale topics, unresolved tensions.
 * Each row pre-fills the InquiryBar when clicked.
 */
export default function InquirySuggestions({ onSelectQuery }: InquirySuggestionsProps) {
  const { data } = useApiData<InquirySuggestionData>(
    () => fetchInquirySuggestions(),
    [],
  );

  const items: SuggestionItem[] = [];

  if (data) {
    for (const q of data.unanswered_questions) {
      items.push({
        key: `q-${q.id}`,
        Icon: HelpCircle,
        iconColor: 'var(--cp-red)',
        title: q.title,
        meta: `${q.claim_count} claim${q.claim_count !== 1 ? 's' : ''}, ${q.gap_count} gap${q.gap_count !== 1 ? 's' : ''}`,
        query: q.title,
      });
    }

    for (const gap of data.evidence_gaps) {
      items.push({
        key: `gap-${gap.description}`,
        Icon: WarningCircle,
        iconColor: 'var(--cp-term-amber)',
        title: gap.description,
        meta: gap.related_question_id
          ? `question #${gap.related_question_id}`
          : 'evidence gap',
        query: gap.description,
      });
    }

    for (const topic of data.stale_topics) {
      items.push({
        key: `stale-${topic.entity}`,
        Icon: Compass,
        iconColor: 'var(--cp-term-muted)',
        title: topic.description,
        meta: 'stale topic',
        query: `${topic.entity} recent research`,
      });
    }

    for (const tension of data.unresolved_tensions) {
      items.push({
        key: `tension-${tension.id}`,
        Icon: WarningTriangle,
        iconColor: 'var(--cp-term-amber)',
        title: tension.title,
        meta: `tension (${tension.severity})`,
        query: tension.title,
      });
    }
  }

  if (items.length === 0) return null;

  return (
    <TerminalBlock
      title="The graph is wondering"
      status="idle"
      style={{ marginTop: 10 }}
    >
      <div className="cp-suggestion-list">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectQuery(item.query)}
            className="cp-suggestion-row"
          >
            <span className="cp-suggestion-icon" style={{ color: item.iconColor }}>
              <item.Icon width={13} height={13} strokeWidth={2} />
            </span>
            <span className="cp-suggestion-title">
              {item.title}
            </span>
            <span className="cp-suggestion-meta">
              {item.meta}
            </span>
          </button>
        ))}
      </div>
    </TerminalBlock>
  );
}

interface SuggestionItem {
  key: string;
  Icon: ComponentType<{ width?: number; height?: number; strokeWidth?: number }>;
  iconColor: string;
  title: string;
  meta: string;
  query: string;
}
