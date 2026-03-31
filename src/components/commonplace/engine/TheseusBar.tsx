'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Search } from 'iconoir-react';
import type { EngineLogEntry } from '@/lib/commonplace-models';
import { fetchEngineLog } from '@/lib/commonplace-models';
import { apiFetch } from '@/lib/commonplace-api';

/* ─────────────────────────────────────────────────
   Humanize engine log entries into readable sentences
   ───────────────────────────────────────────────── */

interface ObjectChip {
  id: number;
  title: string;
  typeSlug: string;
  typeColor: string;
}

const TYPE_ICON: Record<string, string> = {
  note: '\u25AA',
  source: '\u25C8',
  concept: '\u25CE',
  person: '\u25CF',
  hunch: '\u25C7',
  task: '\u25A0',
  event: '\u25C6',
  quote: '\u275D',
  script: '\u25B7',
};

const TYPE_COLOR: Record<string, string> = {
  note: '#2A2420',
  source: '#2D5F6B',
  concept: '#7B5EA7',
  person: '#C4503C',
  hunch: '#C49A4A',
  task: '#C49A4A',
  event: '#7B5EA7',
  quote: '#2D5F6B',
  script: '#2D5F6B',
};

function humanize(entry: EngineLogEntry): string {
  const msg = entry.message.toLowerCase();

  if (entry.pass === 'sbert' && msg.includes('connection')) {
    return `I found a connection between two objects in your graph. They share semantic similarities worth exploring.`;
  }
  if (entry.pass === 'nli' && (msg.includes('tension') || msg.includes('contradict'))) {
    return `Two of your sources disagree about a key claim. I've flagged this as a tension worth looking at.`;
  }
  if (entry.pass === 'kge' && msg.includes('cluster')) {
    return `A cluster in your graph just grew. New objects found their way in through shared connections.`;
  }
  if (msg.includes('entit')) {
    return `Your recent captures introduced new entities. The graph is getting denser around active topics.`;
  }
  if (msg.includes('structural hole') || msg.includes('bridge')) {
    return `I noticed a gap between two clusters in your graph. There might be a bridge here worth investigating.`;
  }
  if (entry.pass === 'promote') {
    return `Your recent reviews helped. The connection scorer is getting more accurate.`;
  }

  // Generic fallback: rewrite the raw message in first person
  return entry.message.replace(/^(Found|Detected|Scored|Processed)/i, 'I $1').replace(/\.$/, '') + '.';
}

const IDLE_THOUGHTS = [
  'Everything is quiet. I\'m watching for new patterns in your graph.',
  'The graph is resting. No new connections or tensions detected recently.',
  'I\'m scanning for structural holes and potential bridges between your clusters.',
  'Waiting for new captures. Each one helps me find connections you haven\'t seen yet.',
];

/* ─────────────────────────────────────────────────
   TheseusBar component
   ───────────────────────────────────────────────── */

const SPRING_NATURAL = { stiffness: 300, damping: 25 };

function getResponseForQuery(q: string): string {
  const lower = q.toLowerCase();
  if (lower.includes('shannon') || lower.includes('information'))
    return 'I see connections to information theory in your graph. Several objects share entities around encoding and signal processing.';
  if (lower.includes('working') || lower.includes('should'))
    return 'Your hottest threads have recent edge activity. I can see open tasks and active connections worth reviewing.';
  if (lower.includes('gap') || lower.includes('hole'))
    return 'I found structural holes between clusters. These gaps might be where the most interesting connections are hiding.';
  return 'I\'m looking through your graph for connections to that. Let me trace the edges and see what emerges.';
}

export default function TheseusBar() {
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [logEntries, setLogEntries] = useState<EngineLogEntry[]>([]);
  const [thoughtIndex, setThoughtIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [objectChips, setObjectChips] = useState<ObjectChip[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => { setMounted(true); }, []);

  // Fetch engine log once on mount, then every 30s.
  // Ref-based to avoid re-triggering downstream effects.
  useEffect(() => {
    let cancelled = false;
    function load() {
      fetchEngineLog().then((entries) => {
        if (!cancelled) setLogEntries(entries);
      });
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Memoize thoughts so the array reference is stable across renders
  const thoughts = useMemo(() => {
    if (logEntries.length > 0) return logEntries.slice(0, 6).map(humanize);
    return IDLE_THOUGHTS;
  }, [logEntries]);

  // The current target thought (what should be typed out)
  const targetThought = useMemo(() => {
    if (inputValue) return getResponseForQuery(inputValue);
    return thoughts[thoughtIndex % thoughts.length] ?? IDLE_THOUGHTS[0];
  }, [inputValue, thoughts, thoughtIndex]);

  // Cycle thoughts when idle (no input, expanded)
  useEffect(() => {
    if (!expanded || inputValue) return;
    const interval = setInterval(() => {
      setThoughtIndex((i) => (i + 1) % thoughts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [expanded, inputValue, thoughts.length]);

  // Typewriter effect: runs when targetThought changes.
  // Uses a ref to cancel cleanly without competing intervals.
  useEffect(() => {
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
      typewriterRef.current = null;
    }

    if (reduced) {
      setDisplayedText(targetThought);
      setIsTyping(false);
      return;
    }

    setDisplayedText('');
    setIsTyping(true);
    let charIndex = 0;

    typewriterRef.current = setInterval(() => {
      charIndex++;
      if (charIndex <= targetThought.length) {
        setDisplayedText(targetThought.slice(0, charIndex));
      } else {
        setIsTyping(false);
        if (typewriterRef.current) {
          clearInterval(typewriterRef.current);
          typewriterRef.current = null;
        }
      }
    }, 18);

    return () => {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current);
        typewriterRef.current = null;
      }
    };
  }, [targetThought, reduced]);

  // Search for object chips when user types 4+ characters (debounced)
  useEffect(() => {
    if (inputValue.length < 4) {
      setObjectChips([]);
      return;
    }
    let stale = false;
    const timeout = setTimeout(() => {
      apiFetch<{ results: Array<{ id: number; title: string; object_type_slug: string; object_type_color: string }> }>(
        `/objects/?search=${encodeURIComponent(inputValue)}&limit=3`
      )
        .then((data) => {
          if (stale) return;
          const results = data.results ?? [];
          setObjectChips(results.map((r) => ({
            id: r.id,
            title: r.title,
            typeSlug: r.object_type_slug,
            typeColor: r.object_type_color || TYPE_COLOR[r.object_type_slug] || '#2A2420',
          })));
        })
        .catch(() => { if (!stale) setObjectChips([]); });
    }, 300);
    return () => { stale = true; clearTimeout(timeout); };
  }, [inputValue]);

  // Auto-focus input when expanded
  useEffect(() => {
    if (expanded) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [expanded]);

  // Escape key handler
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && expanded) {
        setExpanded(false);
        setInputValue('');
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => {
      if (prev) setInputValue('');
      return !prev;
    });
  }, []);

  if (!mounted) return null;

  const collapsedThought = thoughts[thoughtIndex % thoughts.length] ?? '';

  const content = (
    <div className="commonplace-theme">
      <AnimatePresence mode="wait">
        {!expanded ? (
          /* ── Collapsed pill ── */
          <motion.div
            key="collapsed"
            onClick={handleToggle}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: 10 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', ...SPRING_NATURAL }}
            style={{
              position: 'fixed',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9100,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 20px',
              borderRadius: 24,
              cursor: 'pointer',
              backgroundColor: 'rgba(28,28,32,0.88)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(244,243,240,0.06)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              maxWidth: 480,
              width: 'auto',
            }}
          >
            <Search width={14} height={14} style={{ color: '#3A7A88', flexShrink: 0 }} strokeWidth={2} />
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#4ADE80',
                boxShadow: '0 0 6px rgba(74,222,128,0.4)',
                animation: reduced ? 'none' : 'cpPulse 1.5s ease-in-out infinite',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-metadata, "Courier Prime", monospace)',
                fontSize: 11,
                color: '#C0BDB5',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 360,
              }}
            >
              {collapsedThought.slice(0, 55)}{collapsedThought.length > 55 ? '...' : ''}
            </span>
          </motion.div>
        ) : (
          /* ── Expanded panel ── */
          <motion.div
            key="expanded"
            initial={reduced ? false : { opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: 20, scale: 0.96 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', ...SPRING_NATURAL }}
            style={{
              position: 'fixed',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9100,
              width: 600,
              maxWidth: 'calc(100vw - 280px)',
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: 'rgba(28,28,32,0.94)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(244,243,240,0.06)',
              boxShadow: '0 8px 48px rgba(0,0,0,0.3)',
            }}
          >
            {/* Thought area */}
            <div
              style={{
                padding: '16px 20px 12px',
                minHeight: 60,
                maxHeight: 140,
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--cp-font-body, "IBM Plex Sans", sans-serif)',
                  fontSize: 13,
                  color: '#C0BDB5',
                  lineHeight: 1.6,
                }}
              >
                {displayedText}
                {isTyping && (
                  <span
                    style={{
                      animation: 'cp-cursor-blink 0.8s step-end infinite',
                      color: '#3A7A88',
                    }}
                  >
                    |
                  </span>
                )}
              </div>

              {/* Object chips (when 4+ characters typed) */}
              {inputValue.length >= 4 && objectChips.length > 0 && (
                <motion.div
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.4, delay: 0.3 }}
                  style={{
                    display: 'flex',
                    gap: 5,
                    marginTop: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  {objectChips.map((chip) => (
                    <span
                      key={chip.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 12,
                        backgroundColor: 'rgba(244,243,240,0.06)',
                        border: `1px solid ${chip.typeColor}25`,
                        fontFamily: 'var(--font-metadata, "Courier Prime", monospace)',
                        fontSize: 10,
                        color: '#C0BDB5',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ color: chip.typeColor }}>
                        {TYPE_ICON[chip.typeSlug] || '\u25AA'}
                      </span>
                      {chip.title.length > 25 ? chip.title.slice(0, 25) + '...' : chip.title}
                    </span>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Input area */}
            <div
              style={{
                padding: '10px 16px 12px',
                borderTop: '1px solid rgba(244,243,240,0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Search width={14} height={14} style={{ color: '#3A7A88', flexShrink: 0 }} strokeWidth={2} />
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask the engine anything..."
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontFamily: 'var(--cp-font-body, "IBM Plex Sans", sans-serif)',
                  fontSize: 13,
                  color: '#F4F3F0',
                }}
              />
              <span
                onClick={handleToggle}
                style={{
                  fontFamily: 'var(--font-metadata, "Courier Prime", monospace)',
                  fontSize: 10,
                  color: '#7A756E',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: 3,
                  border: '1px solid rgba(244,243,240,0.08)',
                }}
              >
                esc
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return createPortal(content, document.body);
}
