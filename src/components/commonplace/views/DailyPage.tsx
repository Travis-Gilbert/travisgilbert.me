'use client';

import { useCallback, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, useReducedMotion } from 'motion/react';
import AskBar from '../ask/AskBar';
import SuggestionPills from '../ask/SuggestionPills';
import HomeView from './HomeView';
import DualBar from '../shared/DualBar';
import { useDrawer } from '@/lib/providers/drawer-provider';
import {
  submitQuestion,
  fetchAskSuggestions,
} from '@/lib/ask-theseus';
import type {
  AskRetrievalResponse,
  AskRetrievalObject,
  AskSuggestion,
} from '@/lib/ask-theseus';
import styles from './DailyPage.module.css';

/* ─────────────────────────────────────────────────
   Search result type styling
   ───────────────────────────────────────────────── */

const RESULT_STYLE: Record<string, { border: string; icon: string; bg: string }> = {
  note:    { border: '#2A2420', icon: '\u25AA', bg: 'rgba(42,36,32,0.03)' },
  source:  { border: '#2D5F6B', icon: '\u25C8', bg: 'rgba(45,95,107,0.06)' },
  concept: { border: '#7B5EA7', icon: '\u25CE', bg: 'rgba(123,94,167,0.06)' },
  person:  { border: '#C4503C', icon: '\u25CF', bg: 'rgba(196,80,60,0.06)' },
  hunch:   { border: '#C49A4A', icon: '\u25C7', bg: 'rgba(196,154,74,0.08)' },
  task:    { border: '#C49A4A', icon: '\u25A0', bg: 'rgba(196,154,74,0.06)' },
  event:   { border: '#7B5EA7', icon: '\u25C6', bg: 'rgba(123,94,167,0.06)' },
  quote:   { border: '#2D5F6B', icon: '\u275D', bg: 'rgba(45,95,107,0.06)' },
  script:  { border: '#2D5F6B', icon: '\u25B7', bg: 'rgba(45,95,107,0.04)' },
};

const FALLBACK_SUGGESTIONS: AskSuggestion[] = [
  { text: 'What should I be working on?', type: 'question' },
  { text: 'How does Shannon connect to Hamming?', type: 'question' },
  { text: '3 evidence gaps', type: 'gap' },
];

/* ─────────────────────────────────────────────────
   Main DailyPage
   ───────────────────────────────────────────────── */

export default function DailyPage() {
  const { openDrawer } = useDrawer();
  const reduced = useReducedMotion();

  /* ── Ask Theseus state ── */
  const [askQuestion, setAskQuestion] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [retrievalResult, setRetrievalResult] = useState<AskRetrievalResponse | null>(null);
  const [displayObjects, setDisplayObjects] = useState<AskRetrievalObject[]>([]);

  /* ── Suggestions ── */
  const [suggestions, setSuggestions] = useState<AskSuggestion[]>(FALLBACK_SUGGESTIONS);

  useEffect(() => {
    fetchAskSuggestions()
      .then((real) => { if (real.length) setSuggestions(real); })
      .catch(() => {});
  }, []);

  /* ── Search mode: 3+ characters triggers reshaping ── */
  const isSearching = askQuestion.length >= 3;

  /* ── Submit a question (retrieval only, no LLM) ── */
  const handleAsk = useCallback(async (question: string) => {
    setAskLoading(true);
    try {
      const retrieval = await submitQuestion(question);
      setRetrievalResult(retrieval);
      if (retrieval.retrieval.objects.length > 0) {
        setDisplayObjects(retrieval.retrieval.objects);
      }
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

  /* ── Detect structured question (contains ?) ── */
  const isStructuredQuestion = isSearching && askQuestion.includes('?');

  return (
    <div className={styles.dailyPage}>
      <div className={styles.content}>
        {/* Sticky AskBar */}
        <div className={styles.askBarSticky}>
          <AskBar
            onSubmit={handleAsk}
            disabled={askLoading}
            value={askQuestion}
            onChange={setAskQuestion}
            active={isSearching}
          />
          {!isSearching && (
            <SuggestionPills
              suggestions={suggestions}
              onSelect={handleSuggestionSelect}
            />
          )}
        </div>

        {/* ── Page reshaping: search results replace default content ── */}
        {isSearching ? (
          <div className={styles.searchResults}>
            {/* Structured question hero answer card */}
            {isStructuredQuestion && (
              <motion.div
                className={styles.heroAnswer}
                initial={reduced ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 20 }}
              >
                <div className={styles.heroAnswerLabel}>
                  <span className={styles.heroAnswerDot} />
                  Theseus found a path
                </div>
                <h3 className={styles.heroAnswerTitle}>
                  {retrievalResult
                    ? `Found ${displayObjects.length} objects connected to your question`
                    : 'Searching your graph for connections...'}
                </h3>
                <p className={styles.heroAnswerText}>
                  {retrievalResult
                    ? `${displayObjects.length} objects across ${[...new Set(displayObjects.map((o) => o.object_type_slug))].length} types. The engine traced semantic bridges, shared entities, and structural patterns.`
                    : 'The engine is looking through your graph for semantic bridges and shared entities.'}
                </p>
                {retrievalResult && displayObjects.length > 0 && (
                  <div className={styles.heroAnswerBars}>
                    <DualBar
                      label1="Evidence" value1={Math.min(95, displayObjects.length * 10)} color1="#2D5F6B"
                      label2="Tension" value2={30} color2="#C49A4A"
                    />
                  </div>
                )}
              </motion.div>
            )}

            {/* Polymorphic search results grid */}
            <div className={styles.searchGridLabel}>Related objects</div>
            <div className={styles.searchGrid}>
              {displayObjects.length > 0 ? (
                displayObjects.map((obj, i) => {
                  const rs = RESULT_STYLE[obj.object_type_slug] || RESULT_STYLE.note;
                  return (
                    <motion.div
                      key={obj.id}
                      className={styles.searchResult}
                      style={{
                        borderLeftColor: rs.border,
                        backgroundColor: rs.bg,
                      }}
                      onClick={() => handleOpenObject(obj.id)}
                      initial={reduced ? false : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={reduced ? { duration: 0 } : {
                        type: 'spring',
                        stiffness: 400,
                        damping: 30,
                        delay: i * 0.06,
                      }}
                    >
                      <div className={styles.searchResultMeta}>
                        <span className={styles.searchResultIcon} style={{ color: rs.border }}>{rs.icon}</span>
                        <span className={styles.searchResultType} style={{ color: rs.border }}>{obj.object_type_slug}</span>
                        {obj.edge_count != null && obj.edge_count > 0 && (
                          <span className={styles.searchResultStrength}>{obj.edge_count} edges</span>
                        )}
                      </div>
                      <h5 className={styles.searchResultTitle}>{obj.title}</h5>
                      {obj.body_preview && (
                        <p className={styles.searchResultSnippet}>{obj.body_preview}</p>
                      )}
                    </motion.div>
                  );
                })
              ) : (
                /* Show searching state when no results yet */
                <div style={{
                  gridColumn: '1 / -1',
                  fontFamily: 'var(--cp-font-body)',
                  fontSize: 13,
                  color: 'var(--cp-text-muted)',
                  fontStyle: 'italic',
                  padding: '20px 0',
                }}>
                  {askLoading ? 'Searching your graph...' : 'Type more or press Enter to search.'}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Default home content ── */
          <HomeView />
        )}
      </div>
    </div>
  );
}
