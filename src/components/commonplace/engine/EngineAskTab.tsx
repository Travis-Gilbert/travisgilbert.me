'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { EngineLogEntry } from '@/lib/commonplace-models';
import { EVIDENCE_TYPE_COLOR } from '@/lib/commonplace-models';
import { humanizeLogEntry } from './humanize';

/* ─────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────── */

interface ObjectChip {
  id: number;
  title: string;
  type: string;
  color: string;
}

interface AnalysisStep {
  icon: string;
  color: string;
  text: string;
  strength?: number;
}

interface Message {
  id: string;
  role: 'user' | 'engine';
  text: string;
  chips?: ObjectChip[];
  steps?: AnalysisStep[];
  timestamp: string;
}

/* ─────────────────────────────────────────────────
   Canned response patterns (until LLM integration)
   ───────────────────────────────────────────────── */

interface CannedResponse {
  pattern: RegExp;
  text: string;
  chips: ObjectChip[];
  steps: AnalysisStep[];
}

const CANNED_RESPONSES: CannedResponse[] = [
  {
    pattern: /connect|link|relat|bridge/i,
    text: 'I found several connections worth exploring. The strongest signal comes from shared entity mentions across your recent captures.',
    chips: [
      { id: 1, title: 'Structural Hole Detection', type: 'concept', color: EVIDENCE_TYPE_COLOR.concept },
      { id: 2, title: 'Stigmergy in software systems', type: 'source', color: EVIDENCE_TYPE_COLOR.source },
    ],
    steps: [
      { icon: '⟷', color: '#3A7A88', text: 'SBERT similarity: 3 pairs above 0.7 threshold', strength: 0.72 },
      { icon: '△', color: '#C49A4A', text: 'NLI detected 1 supporting and 1 contradicting stance', strength: 0.65 },
    ],
  },
  {
    pattern: /tension|contradict|disagree|conflict/i,
    text: 'I see active tensions in your graph. Two sources present conflicting claims about this topic.',
    chips: [
      { id: 3, title: 'Corridor decline thesis', type: 'note', color: EVIDENCE_TYPE_COLOR.note },
      { id: 4, title: 'Council member statement', type: 'quote', color: '#A08020' },
    ],
    steps: [
      { icon: '!', color: '#B8623D', text: 'High-severity tension: timeline contradiction on plan origin', strength: 0.91 },
      { icon: '◆', color: '#7050A0', text: 'KGE link: induced demand concept bridges 4 objects' },
    ],
  },
  {
    pattern: /cluster|group|communit/i,
    text: 'Your graph has formed several distinct clusters. The semiotics cluster recently expanded with 4 new objects.',
    chips: [
      { id: 5, title: 'Semiotics cluster', type: 'concept', color: EVIDENCE_TYPE_COLOR.concept },
      { id: 6, title: 'Game theory cluster', type: 'concept', color: EVIDENCE_TYPE_COLOR.concept },
    ],
    steps: [
      { icon: '◉', color: '#3A7A88', text: 'Louvain community detection: 7 clusters identified' },
      { icon: '⟷', color: '#C49A4A', text: 'Structural hole between semiotics and game theory', strength: 0.34 },
    ],
  },
];

const DEFAULT_RESPONSE: Omit<CannedResponse, 'pattern'> = {
  text: 'I scanned your graph for relevant connections. Here is what I found based on recent engine activity.',
  chips: [
    { id: 7, title: 'Recent captures', type: 'note', color: EVIDENCE_TYPE_COLOR.note },
  ],
  steps: [
    { icon: '◆', color: '#3A7A88', text: 'Processed through 7 analysis passes', strength: 0.8 },
    { icon: '⟷', color: '#C49A4A', text: 'No strong new connections detected. Try adding more objects.' },
  ],
};

function matchResponse(input: string): Omit<CannedResponse, 'pattern'> {
  for (const r of CANNED_RESPONSES) {
    if (r.pattern.test(input)) return r;
  }
  return DEFAULT_RESPONSE;
}

/* ─────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────── */

interface EngineAskTabProps {
  logEntries: EngineLogEntry[];
  onSendReady?: (sendFn: (text: string) => void) => void;
}

export default function EngineAskTab({ logEntries, onSendReady }: EngineAskTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [showTyping, setShowTyping] = useState(false);
  const [visiblePhases, setVisiblePhases] = useState<Record<string, number>>({});
  const conversationRef = useRef<HTMLDivElement>(null);
  const hasGreeted = useRef(false);

  // Initial greeting from engine
  useEffect(() => {
    if (hasGreeted.current) return;
    hasGreeted.current = true;

    const greeting = logEntries.length > 0
      ? humanizeLogEntry(logEntries[logEntries.length - 1])
      : 'I am watching your knowledge graph. Ask me anything about connections, tensions, or patterns.';

    setMessages([{
      id: 'greeting',
      role: 'engine',
      text: greeting,
      timestamp: new Date().toISOString(),
    }]);
  }, [logEntries]);

  // Auto-scroll
  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, showTyping, visiblePhases]);

  const sendMessage = useCallback((text: string) => {
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setShowTyping(true);

    const response = matchResponse(text);
    const engineId = `engine-${Date.now()}`;

    // Phase 1: typing indicator (500ms)
    setTimeout(() => {
      setShowTyping(false);
      const engineMsg: Message = {
        id: engineId,
        role: 'engine',
        text: response.text,
        chips: response.chips,
        steps: response.steps,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, engineMsg]);

      // Phase 2: text already visible (0ms after insert)
      setVisiblePhases((prev) => ({ ...prev, [engineId]: 1 }));

      // Phase 3: chips (350ms after text)
      setTimeout(() => {
        setVisiblePhases((prev) => ({ ...prev, [engineId]: 2 }));
      }, 350);

      // Phase 4: analysis steps (800ms after text, stagger 280ms each)
      setTimeout(() => {
        setVisiblePhases((prev) => ({ ...prev, [engineId]: 3 }));
      }, 800);
    }, 500);
  }, []);

  // Expose sendMessage to parent
  useEffect(() => {
    onSendReady?.(sendMessage);
  }, [onSendReady, sendMessage]);

  return (
    <div
      ref={conversationRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          phase={visiblePhases[msg.id] ?? 3}
        />
      ))}

      {showTyping && <TypingIndicator />}

      {/* Inline styles for animations */}
      <style>{`
        @keyframes engineSlideUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes engineBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
          30% { transform: translateY(-3px); opacity: 0.7; }
        }
        @keyframes engineBarFill {
          from { width: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .engine-anim { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────────── */

function MessageBubble({ message, phase }: { message: Message; phase: number }) {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="engine-anim"
      style={{
        maxWidth: '88%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        animation: 'engineSlideUp 0.3s ease',
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          ...(isUser
            ? {
                background: 'rgba(45,95,107,0.12)',
                border: '1px solid rgba(45,95,107,0.18)',
                borderBottomRightRadius: 3,
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: '#F4F3F0',
              }
            : {
                background: '#1E2028',
                border: '1px solid rgba(244,243,240,0.05)',
                borderBottomLeftRadius: 3,
                fontFamily: 'var(--font-code)',
                fontSize: 12,
                color: '#C0BDB5',
                lineHeight: 1.65,
              }),
        }}
      >
        {message.text}

        {/* Object chips (phase 2+) */}
        {!isUser && message.chips && message.chips.length > 0 && phase >= 2 && (
          <div
            className="engine-anim"
            style={{
              display: 'flex',
              gap: 5,
              flexWrap: 'wrap',
              marginTop: 8,
              animation: 'engineSlideUp 0.25s ease',
            }}
          >
            {message.chips.map((chip) => (
              <span
                key={chip.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 9px',
                  borderRadius: 10,
                  background: 'rgba(244,243,240,0.04)',
                  border: '1px solid rgba(244,243,240,0.06)',
                  fontFamily: 'var(--font-code)',
                  fontSize: 10,
                  color: '#C0BDB5',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: chip.color,
                    flexShrink: 0,
                  }}
                />
                {chip.title}
              </span>
            ))}
          </div>
        )}

        {/* Analysis steps (phase 3) */}
        {!isUser && message.steps && message.steps.length > 0 && phase >= 3 && (
          <div style={{ marginTop: 8 }}>
            {message.steps.map((step, i) => (
              <div
                key={i}
                className="engine-anim"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 7,
                  padding: '5px 0',
                  fontFamily: 'var(--font-code)',
                  fontSize: 11,
                  color: '#7A756E',
                  lineHeight: 1.5,
                  animation: `engineSlideUp 0.25s ease ${i * 0.28}s both`,
                }}
              >
                <span style={{ fontSize: 10, color: step.color, flexShrink: 0, marginTop: 2 }}>
                  {step.icon}
                </span>
                <span style={{ flex: 1 }}>{step.text}</span>
                {step.strength !== undefined && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span
                      style={{
                        width: 36,
                        height: 3,
                        background: 'rgba(244,243,240,0.05)',
                        borderRadius: 2,
                        overflow: 'hidden',
                        display: 'inline-block',
                      }}
                    >
                      <span
                        className="engine-anim"
                        style={{
                          display: 'block',
                          height: '100%',
                          borderRadius: 2,
                          background: step.color,
                          width: `${step.strength * 100}%`,
                          animation: `engineBarFill 0.8s cubic-bezier(0.16,1,0.3,1) ${i * 0.28 + 0.2}s both`,
                        }}
                      />
                    </span>
                    <span style={{ fontFamily: 'var(--font-code)', fontSize: 9, color: '#555048' }}>
                      {Math.round(step.strength * 100)}
                    </span>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meta line */}
      <div
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: 9,
          color: '#555048',
          marginTop: 4,
          padding: '0 4px',
          textAlign: isUser ? 'right' : 'left',
        }}
      >
        {time} {isUser ? 'you' : 'engine'}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: '10px 14px',
        alignSelf: 'flex-start',
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#3A7A88',
            opacity: 0.3,
            animation: `engineBounce 1.4s ease-in-out infinite ${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}
