'use client';

import {
  fetchInquirySuggestions,
  useApiData,
  type InquirySuggestionData,
} from '@/lib/commonplace-api';
import TerminalBlock from './TerminalBlock';

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
        icon: '?',
        iconColor: 'var(--cp-red)',
        title: q.title,
        meta: `${q.claim_count} claim${q.claim_count !== 1 ? 's' : ''}, ${q.gap_count} gap${q.gap_count !== 1 ? 's' : ''}`,
        query: q.title,
      });
    }

    for (const gap of data.evidence_gaps) {
      items.push({
        key: `gap-${gap.description}`,
        icon: '!',
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
        icon: '~',
        iconColor: 'var(--cp-term-muted)',
        title: topic.description,
        meta: 'stale topic',
        query: `${topic.entity} recent research`,
      });
    }

    for (const tension of data.unresolved_tensions) {
      items.push({
        key: `tension-${tension.id}`,
        icon: '\u26A0',
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
      <div style={{ margin: '-4px -4px' }}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectQuery(item.query)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '5px 4px',
              cursor: 'pointer',
              transition: 'background 100ms',
              background: 'transparent',
              border: 'none',
              borderRadius: 2,
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 11,
                fontWeight: 600,
                color: item.iconColor,
                width: 14,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {item.icon}
            </span>
            <span
              style={{
                flex: 1,
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 11,
                color: 'var(--cp-term-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.title}
            </span>
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                color: 'var(--cp-term-muted)',
                flexShrink: 0,
              }}
            >
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
  icon: string;
  iconColor: string;
  title: string;
  meta: string;
  query: string;
}
