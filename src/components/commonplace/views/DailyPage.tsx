'use client';

import { useCallback, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { WarningTriangle } from 'iconoir-react';
import EngineDiscoveryFeed from './EngineDiscoveryFeed';
import type { EngineDiscovery } from './EngineDiscoveryFeed';
import GraphWeatherHeader from './GraphWeatherHeader';
import AskBar from '../ask/AskBar';
import SuggestionPills from '../ask/SuggestionPills';
import AskRetrievalStrip from '../ask/AskRetrievalStrip';
import AskAnswerCard from '../ask/AskAnswerCard';
import { apiFetch } from '@/lib/commonplace-api';
import { useDrawer } from '@/lib/providers/drawer-provider';
import {
  submitQuestion,
  fetchAskSuggestions,
  fetchDailyBriefing,
  fetchGraphWeather,
} from '@/lib/ask-theseus';
import type {
  AskRetrievalResponse,
  AskRetrievalObject,
  AskSynthesisResponse,
  AskSuggestion,
  GraphWeatherData,
} from '@/lib/ask-theseus';
import styles from './DailyPage.module.css';

/* ─── Mock data (used until backend is reachable) ─── */

const MOCK_DISCOVERIES: EngineDiscovery[] = [
  {
    edge_id: 1,
    from_object: { id: 42, title: "Hamming's generative learning", object_type_slug: 'concept' },
    to_object: { id: 87, title: "Shannon's relay memory", object_type_slug: 'note' },
    engine: 'sbert',
    strength: 0.87,
    reason: 'Both describe systems that encode knowledge through operation rather than explicit instruction. Shannon\'s relays record which direction leads forward; Hamming\'s principle demands we learn to create rather than memorize.',
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

interface MockObject {
  type: string;
  title: string;
  body?: string;
  url?: string;
  from_name?: string;
  from_address?: string;
  source_badge?: string;
  time?: string;
  edges: number;
  attribution?: string;
  priority?: string;
  lang?: string;
  role?: string;
  initials?: string;
}

const MOCK_OBJECTS: MockObject[] = [
  {
    type: 'email',
    title: 'Re: TPU Research Cloud Application',
    body: 'Thank you for your application to the TPU Research Cloud program. We\'ve reviewed your project description for Theseus and are pleased to inform you that your application has been selected for the next review cycle.',
    from_name: 'Google TRC Support',
    from_address: 'trc-support@google.com',
    source_badge: 'Gmail',
    time: '9:45 AM',
    edges: 3,
  },
  {
    type: 'note',
    title: "Shannon's relay circuits as distributed memory",
    body: 'The maze remembers. The mouse just follows it. This is the exact design principle behind edge evolution: knowledge is not stored in model weights, it is distributed across graph structure.',
    time: '2:14 PM',
    edges: 7,
  },
  {
    type: 'source',
    title: 'Buehler 2025: Self-organizing graph architectures',
    body: 'Proves self-organization is possible in knowledge graphs. Theseus adds the crucial feedback loops.',
    url: 'arxiv.org',
    edges: 12,
  },
  {
    type: 'task',
    title: 'Run validate_edges with --limit 100',
    priority: 'high',
    edges: 0,
  },
  {
    type: 'quote',
    title: 'We live in an age of exponential growth in knowledge, and it is increasingly futile to teach only polished theorems and proofs',
    attribution: 'Richard Hamming, The Art of Doing Science and Engineering',
    edges: 0,
  },
  {
    type: 'concept',
    title: 'Weak Supervision',
    body: 'Using web co-occurrence as proxy labels for training the learned scorer. The web validation pipeline searches for concept pairs on external pages and generates ConnectionFeedback records automatically.',
    edges: 9,
    time: 'Yesterday',
  },
  {
    type: 'hunch',
    title: 'GNN embeddings will break the discovery ceiling. The structural position signal is fundamentally different from text similarity: two objects can be recognized as related because they occupy similar neighborhoods, even with zero text overlap.',
    edges: 0,
  },
  {
    type: 'person',
    title: 'Richard Hamming',
    role: 'Bell Labs',
    initials: 'H',
    edges: 23,
  },
];

/* ─── Type color map ─── */

const TYPE_COLORS: Record<string, string> = {
  note: '#F5F0E8',
  source: '#2D5F6B',
  concept: '#8B6FA0',
  quote: '#C49A4A',
  hunch: '#B06080',
  task: '#C47A3A',
  person: '#B45A2D',
  email: '#4A7A9A',
  script: '#6B7A8A',
  event: '#4A6A8A',
};

/* ─── Template summary helpers (Option 1: no LLM) ─── */

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

export default function DailyPage() {
  const { openDrawer } = useDrawer();

  /* Try fetching real data; fall back to mock */
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

  /* ── Graph weather (shared with AskBar prefix) ── */
  const [weather, setWeather] = useState<GraphWeatherData | null>(null);
  useEffect(() => {
    fetchGraphWeather()
      .then(setWeather)
      .catch(() => {});
  }, []);

  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  /* ── Ask Theseus state ── */
  const [askQuestion, setAskQuestion] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [retrievalResult, setRetrievalResult] = useState<AskRetrievalResponse | null>(null);
  const [synthesisResult, setSynthesisResult] = useState<AskSynthesisResponse | null>(null);
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [isBriefing, setIsBriefing] = useState(false);
  const MOCK_SUGGESTIONS: AskSuggestion[] = [
    { text: 'What should I be working on?', type: 'question' },
    { text: 'How does Shannon connect to Hamming?', type: 'question' },
    { text: '3 evidence gaps', type: 'gap' },
  ];
  const [suggestions, setSuggestions] = useState<AskSuggestion[]>(MOCK_SUGGESTIONS);

  /* Fetch real suggestions; keep mock if backend unreachable */
  useEffect(() => {
    fetchAskSuggestions()
      .then((real) => { if (real.length) setSuggestions(real); })
      .catch(() => { /* keep mock suggestions */ });
  }, []);

  /* ── Daily briefing on mount (Batch 3) ── */
  useEffect(() => {
    fetchDailyBriefing()
      .then((briefing) => {
        if (briefing.retrieval.objects.length > 0) {
          setIsBriefing(true);
          setSubmittedQuestion(briefing.question);
          setRetrievalResult({
            question_id: 'briefing',
            retrieval: briefing.retrieval,
          });
          const groups = groupByType(briefing.retrieval.objects);
          setSynthesisResult({
            answer: buildTemplateSummary(briefing.question, groups),
            referenced_object_ids: briefing.retrieval.objects.map((o) => o.id),
          });
        }
      })
      .catch(() => {});

    // Background refresh for next load
    fetch('/api/v1/notebook/briefing/?refresh=true').catch(() => {});
  }, []);

  /* ── Option 1: Retrieval only, no LLM call ── */
  const handleAsk = useCallback(async (question: string) => {
    setAskLoading(true);
    setSubmittedQuestion(question);
    setRetrievalResult(null);
    setSynthesisResult(null);
    setIsBriefing(false);

    try {
      const retrieval = await submitQuestion(question);
      setRetrievalResult(retrieval);

      // Template-based summary, no LLM call
      const objects = retrieval.retrieval.objects;
      const typeGroups = groupByType(objects);
      const summary = buildTemplateSummary(question, typeGroups);

      setSynthesisResult({
        answer: summary,
        referenced_object_ids: objects.map((o) => o.id),
      });
    } catch {
      toast.error('Could not reach the knowledge graph.');
      setSubmittedQuestion('');
    } finally {
      setAskLoading(false);
    }
  }, []);

  const handleSuggestionSelect = useCallback((text: string) => {
    setAskQuestion(text);
    handleAsk(text);
  }, [handleAsk]);

  const handleOpenObject = useCallback((id: number) => {
    // Look up slug from retrieval objects if available
    const obj = retrievalResult?.retrieval.objects.find((o) => o.id === id);
    if (obj?.slug) {
      openDrawer(obj.slug);
    } else {
      openDrawer(String(id));
    }
  }, [retrievalResult, openDrawer]);

  return (
    <div className={styles.dailyPage}>
      <div className={styles.content}>
        {/* GRAPH WEATHER HEADER */}
        <GraphWeatherHeader weather={weather} />

        {/* ASK BAR */}
        <AskBar
          onSubmit={handleAsk}
          disabled={askLoading}
          value={askQuestion}
          onChange={setAskQuestion}
          dateLabel={dateLabel}
          iq={weather?.composite_iq}
        />

        {/* SUGGESTION PILLS */}
        {!retrievalResult && (
          <SuggestionPills
            suggestions={suggestions}
            onSelect={handleSuggestionSelect}
          />
        )}

        {/* RETRIEVAL STRIP (while loading synthesis) */}
        {retrievalResult && !synthesisResult && (
          <AskRetrievalStrip objects={retrievalResult.retrieval.objects} />
        )}

        {/* ANSWER CARD (when available) */}
        {retrievalResult && synthesisResult && (
          <>
            {isBriefing && (
              <div className={styles.briefingLabel}>DAILY BRIEFING</div>
            )}
            <AskAnswerCard
              question={submittedQuestion}
              retrieval={retrievalResult}
              synthesis={synthesisResult}
              onOpenObject={handleOpenObject}
            />
          </>
        )}

        {/* TIER 1: Engine Discoveries (always visible) */}
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

        {/* TIER 2: Today's Objects (always visible) */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            Today
            <span className={styles.sectionCount}>{MOCK_OBJECTS.length}</span>
            <span className={styles.sectionLine} />
          </div>
          <ObjectFeed objects={MOCK_OBJECTS} />
        </section>

        {/* TIER 3: Tensions */}
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

/* ─── Polymorphic Object Feed ─── */

function ObjectFeed({ objects }: { objects: MockObject[] }) {
  const email = objects.find((o) => o.type === 'email');
  const note = objects.find((o) => o.type === 'note');
  const source = objects.find((o) => o.type === 'source');
  const task = objects.find((o) => o.type === 'task');
  const rest = objects.filter(
    (o) => o !== email && o !== note && o !== source && o !== task,
  );

  return (
    <div className={styles.objectFeed}>
      {/* Hero: email full-width */}
      {email && <EmailCard obj={email} />}

      {/* Asymmetric pair */}
      {(note || source) && (
        <div className={styles.gridAsym}>
          {note && <NoteCard obj={note} />}
          {source && <SourceCard obj={source} />}
        </div>
      )}

      {/* Task: full-width */}
      {task && <TaskCard obj={task} />}

      {/* Remaining objects */}
      {rest.map((obj, i) => (
        <div key={i}>
          {obj.type === 'quote' && <QuoteCard obj={obj} />}
          {obj.type === 'concept' && <ConceptCard obj={obj} />}
          {obj.type === 'hunch' && <HunchCard obj={obj} />}
          {obj.type === 'person' && <PersonCard obj={obj} />}
        </div>
      ))}
    </div>
  );
}

/* ─── Object Type Cards ─── */

function EmailCard({ obj }: { obj: MockObject }) {
  return (
    <div className={styles.objEmail}>
      <div className={styles.emailHeader}>
        <div className={styles.emailIcon}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--cp-blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 4L12 13 2 4" />
          </svg>
        </div>
        <div className={styles.emailFrom}>
          <div className={styles.emailFromName}>{obj.from_name}</div>
          <div className={styles.emailFromAddr}>{obj.from_address}</div>
        </div>
        {obj.source_badge && (
          <span className={styles.emailSourceBadge}>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="var(--cp-blue)" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><path d="M2 12h20" />
            </svg>
            {obj.source_badge}
          </span>
        )}
        {obj.time && <span className={styles.emailTime}>{obj.time}</span>}
      </div>
      <div className={styles.emailBody}>
        <div className={styles.emailSubject}>{obj.title}</div>
        {obj.body && <div className={styles.emailPreview}>{obj.body}</div>}
      </div>
      {obj.edges > 0 && (
        <div className={styles.emailFooter}>
          <span className={styles.edgeDot} />
          <span>{obj.edges} connections found by engine</span>
        </div>
      )}
    </div>
  );
}

function NoteCard({ obj }: { obj: MockObject }) {
  return (
    <div className={styles.objNote}>
      <div className={styles.objTitle}>{obj.title}</div>
      {obj.body && <div className={styles.objBody}>{obj.body}</div>}
      <ObjMeta edges={obj.edges} time={obj.time} />
    </div>
  );
}

function SourceCard({ obj }: { obj: MockObject }) {
  return (
    <div className={styles.objSource}>
      {obj.url && (
        <div className={styles.sourceUrl}>
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="var(--cp-teal-light)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><path d="M2 12h20" />
          </svg>
          {obj.url}
        </div>
      )}
      <div className={styles.objTitle}>{obj.title}</div>
      {obj.body && <div className={styles.objBody}>{obj.body}</div>}
      <ObjMeta edges={obj.edges} time={obj.time} />
    </div>
  );
}

function TaskCard({ obj }: { obj: MockObject }) {
  return (
    <div className={styles.objTask}>
      <div className={styles.taskCheck} />
      <div className={styles.objTitleInline}>{obj.title}</div>
      {obj.priority && <span className={styles.priorityBadge}>{obj.priority}</span>}
    </div>
  );
}

function QuoteCard({ obj }: { obj: MockObject }) {
  return (
    <div className={styles.objQuote}>
      <span className={styles.quoteMark}>&ldquo;</span>
      <div className={styles.quoteText}>{obj.title}</div>
      {obj.attribution && <div className={styles.quoteAttr}>{obj.attribution}</div>}
    </div>
  );
}

function ConceptCard({ obj }: { obj: MockObject }) {
  return (
    <div className={styles.objConcept}>
      <div className={styles.conceptTitle}>{obj.title}</div>
      {obj.body && <div className={styles.conceptBody}>{obj.body}</div>}
      <ObjMeta edges={obj.edges} time={obj.time} />
    </div>
  );
}

function HunchCard({ obj }: { obj: MockObject }) {
  return (
    <div className={styles.objHunch}>
      <div className={styles.hunchLabel}>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--cp-pink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.66 17H14.34" /><path d="M12 2a7 7 0 00-3 13.33V17h6v-1.67A7 7 0 0012 2z" />
        </svg>
        Hunch
      </div>
      <div className={styles.hunchText}>{obj.title}</div>
    </div>
  );
}

function PersonCard({ obj }: { obj: MockObject }) {
  return (
    <div className={styles.objPerson}>
      <div className={styles.personAvatar}>{obj.initials}</div>
      <div>
        <div className={styles.personName}>{obj.title}</div>
        {obj.role && <div className={styles.personRole}>{obj.role}</div>}
      </div>
      {obj.edges > 0 && <div className={styles.personEdges}>{obj.edges} edges</div>}
    </div>
  );
}

function ObjMeta({ edges, time }: { edges: number; time?: string }) {
  if (!edges && !time) return null;
  return (
    <div className={styles.objMeta}>
      {edges > 0 && (
        <span className={styles.edgeIndicator}>
          <span className={styles.edgeDot} />
          <span>{edges} edges</span>
        </span>
      )}
      {time && <span className={styles.objTime}>{time}</span>}
    </div>
  );
}
