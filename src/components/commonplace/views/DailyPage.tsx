'use client';

import { useCallback, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { WarningTriangle } from 'iconoir-react';
import EngineDiscoveryFeed from './EngineDiscoveryFeed';
import type { EngineDiscovery } from './EngineDiscoveryFeed';
import AskBar from '../ask/AskBar';
import SuggestionPills from '../ask/SuggestionPills';
import HomepageFlow from './HomepageFlow';
import ProvenanceStrip from '../ask/ProvenanceStrip';
import FeedbackBar from '../ask/FeedbackBar';
import { apiFetch } from '@/lib/commonplace-api';
import { useDrawer } from '@/lib/providers/drawer-provider';
import {
  submitQuestion,
  fetchAskSuggestions,
  fetchDailyBriefing,
} from '@/lib/ask-theseus';
import type {
  AskRetrievalResponse,
  AskRetrievalObject,
  AskSuggestion,
} from '@/lib/ask-theseus';
import styles from './DailyPage.module.css';

/* ── Mock data (used until backend is reachable) ── */

const MOCK_DISCOVERIES: EngineDiscovery[] = [
  {
    edge_id: 1,
    from_object: { id: 42, title: "Hamming's generative learning", object_type_slug: 'concept' },
    to_object: { id: 87, title: "Shannon's relay memory", object_type_slug: 'note' },
    engine: 'sbert',
    strength: 0.87,
    reason: 'Both describe systems that encode knowledge through operation rather than explicit instruction.',
    created_at: '2026-03-28T14:30:00Z',
  },
  {
    edge_id: 2,
    from_object: { id: 101, title: 'Re: TPU Research Cloud', object_type_slug: 'source' },
    to_object: { id: 55, title: 'Google TRC program', object_type_slug: 'source' },
    engine: 'shared_entity',
    strength: 0.94,
    reason: 'Entity match: TPU Research Cloud, Google, Theseus appear in both objects.',
    created_at: '2026-03-28T12:00:00Z',
  },
  {
    edge_id: 3,
    from_object: { id: 200, title: 'CAP theorem failures', object_type_slug: 'note' },
    to_object: { id: 201, title: 'Redis guards', object_type_slug: 'script' },
    engine: 'bm25',
    strength: 0.72,
    reason: 'Both discuss partition tolerance strategies in distributed systems.',
    created_at: '2026-03-28T10:00:00Z',
  },
  {
    edge_id: 4,
    from_object: { id: 300, title: 'Buehler 2025', object_type_slug: 'source' },
    to_object: { id: 301, title: 'Self-organizing spec', object_type_slug: 'source' },
    engine: 'sbert',
    strength: 0.81,
    reason: 'Both describe graph architectures that reorganize without external direction.',
    created_at: '2026-03-28T09:00:00Z',
  },
];

/* ── Template summary helpers ── */

function groupByType(objects: AskRetrievalObject[]) {
  const groups: Record<string, AskRetrievalObject[]> = {};
  for (const obj of objects) {
    const type = obj.object_type_slug;
    if (!groups[type]) groups[type] = [];
    groups[type].push(obj);
  }
  return groups;
}

function buildTemplateSummary(
  _question: string,
  groups: Record<string, AskRetrievalObject[]>,
): string {
  const total = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
  if (total === 0) return 'No objects found in your graph for this question.';

  const parts: string[] = [];

  if (groups.task?.length) {
    const incomplete = groups.task.filter((t) => !t.done);
    if (incomplete.length > 0) {
      parts.push(`${incomplete.length} task${incomplete.length !== 1 ? 's' : ''} related to your question`);
    }
  }
  if (groups.event?.length) {
    parts.push(`${groups.event.length} upcoming event${groups.event.length !== 1 ? 's' : ''}`);
  }
  if (groups.source?.length) {
    parts.push(`${groups.source.length} source${groups.source.length !== 1 ? 's' : ''}`);
  }
  if (groups.note?.length) {
    parts.push(`${groups.note.length} note${groups.note.length !== 1 ? 's' : ''}`);
  }
  if (groups.hunch?.length) {
    parts.push(`${groups.hunch.length} hunch${groups.hunch.length !== 1 ? 'es' : ''}`);
  }

  return parts.length > 0
    ? `Found ${parts.join(', ')}.`
    : `Found ${total} object${total !== 1 ? 's' : ''}.`;
}

/* ── Fallback mock data (renders if briefing API fails) ── */

const FALLBACK_OBJECTS: AskRetrievalObject[] = [
  {
    id: 1,
    slug: 'welcome',
    title: 'Your knowledge graph is ready',
    object_type_slug: 'note',
    object_type_color: '#F5F0E8',
    body_preview: 'Ask a question above or click a suggestion to explore what your graph knows.',
    edge_count: 0,
  },
];

export default function DailyPage() {
  const { openDrawer } = useDrawer();

  /* ── Engine discoveries ── */
  const [discoveries, setDiscoveries] = useState<EngineDiscovery[]>(MOCK_DISCOVERIES);

  useEffect(() => {
    apiFetch<{ discoveries: EngineDiscovery[] }>('/engine/discoveries/?limit=20')
      .then((data) => {
        if (data.discoveries?.length) {
          setDiscoveries(data.discoveries);
        }
      })
      .catch(() => { /* stay on mock */ });
  }, []);

  /* ── Ask Theseus state ── */
  const [askQuestion, setAskQuestion] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [retrievalResult, setRetrievalResult] = useState<AskRetrievalResponse | null>(null);
  const [summaryText, setSummaryText] = useState('');
  const [displayObjects, setDisplayObjects] = useState<AskRetrievalObject[]>(FALLBACK_OBJECTS);

  /* ── Suggestions ── */
  const MOCK_SUGGESTIONS: AskSuggestion[] = [
    { text: 'What should I be working on?', type: 'question' },
    { text: 'How does Shannon connect to Hamming?', type: 'question' },
    { text: '3 evidence gaps', type: 'gap' },
  ];
  const [suggestions, setSuggestions] = useState<AskSuggestion[]>(MOCK_SUGGESTIONS);

  useEffect(() => {
    fetchAskSuggestions()
      .then((real) => { if (real.length) setSuggestions(real); })
      .catch(() => {});
  }, []);

  /* ── Daily briefing on mount ── */
  useEffect(() => {
    fetchDailyBriefing()
      .then((briefing) => {
        if (briefing.retrieval.objects.length > 0) {
          setRetrievalResult({
            question_id: 'briefing',
            retrieval: briefing.retrieval,
          });
          setDisplayObjects(briefing.retrieval.objects);
          const groups = groupByType(briefing.retrieval.objects);
          setSummaryText(buildTemplateSummary(briefing.question, groups));
        }
      })
      .catch(() => {});

    // Background refresh for next load
    fetch('/api/v1/notebook/briefing/?refresh=true').catch(() => {});
  }, []);

  /* ── Submit a question (retrieval only, no LLM) ── */
  const handleAsk = useCallback(async (question: string) => {
    setAskLoading(true);

    try {
      const retrieval = await submitQuestion(question);
      setRetrievalResult(retrieval);

      const objects = retrieval.retrieval.objects;
      if (objects.length > 0) {
        setDisplayObjects(objects);
      }
      const typeGroups = groupByType(objects);
      setSummaryText(buildTemplateSummary(question, typeGroups));
    } catch {
      toast.error('Could not reach the knowledge graph.');
    } finally {
      setAskLoading(false);
    }
  }, []);

  const handleSuggestionSelect = useCallback((text: string) => {
    setAskQuestion(text);
    handleAsk(text);
  }, [handleAsk]);

  const handleOpenObject = useCallback((id: number) => {
    const obj = displayObjects.find((o) => o.id === id);
    if (obj?.slug) {
      openDrawer(obj.slug);
    } else {
      openDrawer(String(id));
    }
  }, [displayObjects, openDrawer]);

  const engines = retrievalResult?.retrieval.engines_used ?? [];
  const claimCount = retrievalResult?.retrieval.claims.length ?? 0;

  return (
    <div className={styles.dailyPage}>
      <div className={styles.content}>
        {/* Command bar */}
        <AskBar
          onSubmit={handleAsk}
          disabled={askLoading}
          value={askQuestion}
          onChange={setAskQuestion}
        />

        {/* Suggestion pills (always visible) */}
        <SuggestionPills
          suggestions={suggestions}
          onSelect={handleSuggestionSelect}
        />

        {/* Briefing summary paragraph */}
        {summaryText && (
          <p className={styles.briefingSummary}>{summaryText}</p>
        )}

        {/* Conversation layout with objects */}
        <HomepageFlow
          objects={displayObjects}
          onOpenObject={handleOpenObject}
        />

        {/* Provenance strip */}
        {engines.length > 0 && (
          <ProvenanceStrip
            engines={engines}
            objectCount={displayObjects.length}
            claimCount={claimCount}
          />
        )}

        {/* Feedback bar */}
        {retrievalResult && (
          <FeedbackBar
            questionId={retrievalResult.question_id}
            retrievedObjectIds={displayObjects.map((o) => o.id)}
          />
        )}

        {/* Engine Discoveries */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5D9B78" strokeWidth="2" strokeLinecap="round">
              <circle cx="6" cy="12" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="18" cy="18" r="3" />
              <path d="M8.6 10.4L15.4 7.6M8.6 13.6l6.8 2.8" />
            </svg>
            Engine found <span className={styles.sectionCount}>{discoveries.length}</span> connections
            <span className={styles.sectionLine} />
          </div>
          <EngineDiscoveryFeed discoveries={discoveries} onOpenObject={(slug) => openDrawer(slug)} />
        </section>

        {/* Tensions */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <WarningTriangle width={11} height={11} color="var(--cp-gold)" strokeWidth={2.5} />
            Open Tensions
            <span className={styles.sectionCount} style={{ color: 'var(--cp-gold)' }}>383</span>
            <span className={styles.sectionLine} />
          </div>
          <div className={styles.tension}>
            <WarningTriangle width={14} height={14} color="var(--cp-gold)" strokeWidth={2} />
            <div className={styles.tensionTitle}>Contradiction: Dan Lahav vs README.md</div>
            <div className={styles.tensionBadge}>high priority</div>
          </div>
        </section>
      </div>
    </div>
  );
}
