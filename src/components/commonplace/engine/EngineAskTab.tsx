'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { EngineLogEntry } from '@/lib/commonplace-models';
import { EVIDENCE_TYPE_COLOR } from '@/lib/commonplace-models';
import { humanizeLogEntry } from './humanize';
import { submitQuestion } from '@/lib/ask-theseus';
import { useDrawer } from '@/lib/providers/drawer-provider';

/* ─────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────── */

interface ObjectChip {
  id: number;
  title: string;
  type: string;
  color: string;
  slug?: string;
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
   Component
   ───────────────────────────────────────────────── */

interface EngineAskTabProps {
  logEntries: EngineLogEntry[];
  onSendReady?: (sendFn: (text: string) => void) => void;
}

export default function EngineAskTab({ logEntries, onSendReady }: EngineAskTabProps) {
  const { openDrawer } = useDrawer();
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

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setShowTyping(true);
    const engineId = `engine-${Date.now()}`;

    try {
      const retrieval = await submitQuestion(text);
      const objects = retrieval.retrieval.objects ?? [];
      const engines = retrieval.retrieval.engines_used ?? [];
      const chips: ObjectChip[] = objects.slice(0, 6).map((obj) => ({
        id: obj.id,
        slug: obj.slug,
        title: obj.title,
        type: obj.object_type_slug,
        color: obj.object_type_color || EVIDENCE_TYPE_COLOR.note,
      }));
      const steps: AnalysisStep[] = engines.slice(0, 4).map((engine) => ({
        icon: '◆',
        color: '#3A7A88',
        text: `${engine.toUpperCase()} retrieval pass contributed evidence.`,
      }));

      const engineMsg: Message = {
        id: engineId,
        role: 'engine',
        text: objects.length > 0
          ? `I found ${objects.length} connected object${objects.length === 1 ? '' : 's'} from live Index API retrieval.`
          : 'No connected objects were returned by live Index API retrieval for this query yet.',
        chips,
        steps,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, engineMsg]);
      setVisiblePhases((prev) => ({ ...prev, [engineId]: 1 }));
      setTimeout(() => {
        setVisiblePhases((prev) => ({ ...prev, [engineId]: 2 }));
      }, 250);
      setTimeout(() => {
        setVisiblePhases((prev) => ({ ...prev, [engineId]: 3 }));
      }, 600);
    } catch {
      const engineMsg: Message = {
        id: engineId,
        role: 'engine',
        text: 'Live retrieval is unavailable right now. Index API could not be reached.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, engineMsg]);
      setVisiblePhases((prev) => ({ ...prev, [engineId]: 1 }));
    } finally {
      setShowTyping(false);
    }
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
          onOpenChip={(chip) => {
            const slug = chip.slug || String(chip.id);
            if (slug) openDrawer(slug);
          }}
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

function MessageBubble({
  message,
  phase,
  onOpenChip,
}: {
  message: Message;
  phase: number;
  onOpenChip?: (chip: ObjectChip) => void;
}) {
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
              <button
                key={chip.id}
                type="button"
                onClick={() => onOpenChip?.(chip)}
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
                  cursor: onOpenChip ? 'pointer' : 'default',
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
              </button>
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
