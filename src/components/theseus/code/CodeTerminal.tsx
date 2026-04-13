'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import TerminalCanvas from '@/components/commonplace/engine/TerminalCanvas';
import type { AgentId, ChatMessage } from './agents';
import AgentDot from './AgentDot';

type TerminalTab = 'ask' | 'log' | 'agents';

interface CodeTerminalProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  activeAgents: AgentId[];
  onSend: (text: string) => void;
}

const COLLAPSED_HEIGHT = 44;
const DEFAULT_EXPANDED_HEIGHT = 340;
const MIN_EXPANDED_HEIGHT = 180;
const MAX_EXPANDED_HEIGHT = 600;

const IDLE_THOUGHTS = [
  '847 connections mapped so far. I\'m looking for patterns.',
  'Watching answer_router.py for drift signals.',
  '14 symbols indexed across 8 files.',
  'The code graph has 3 strongly connected clusters.',
  'Last engine pass found 2 tensions in the routing layer.',
  'Monitoring 6 downstream callers of classify_answer_type.',
];

export default function CodeTerminal({ open, onClose, messages, activeAgents, onSend }: CodeTerminalProps) {
  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState(DEFAULT_EXPANDED_HEIGHT);
  const [activeTab, setActiveTab] = useState<TerminalTab>('ask');
  const [inputValue, setInputValue] = useState('');
  const [thoughtTick, setThoughtTick] = useState(0);
  const [thoughtOpacity, setThoughtOpacity] = useState(1);

  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Expand on first open
  useEffect(() => {
    if (open) setExpanded(true);
  }, [open]);

  // Thought cycling (collapsed bar)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setThoughtOpacity(0);
      timeout = setTimeout(() => {
        setThoughtTick((c) => c + 1);
        setThoughtOpacity(1);
      }, 200);
    }, 5000);
    return () => {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const thoughtText = useMemo(
    () => IDLE_THOUGHTS[thoughtTick % IDLE_THOUGHTS.length],
    [thoughtTick],
  );

  // Focus input on expand
  useEffect(() => {
    if (expanded) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [expanded]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (expanded) setExpanded(false);
        else onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, expanded, onClose]);

  // Resize drag
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeRef.current = { startY: e.clientY, startHeight: height };

      const handleMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const delta = resizeRef.current.startY - ev.clientY;
        const next = Math.max(MIN_EXPANDED_HEIGHT, Math.min(MAX_EXPANDED_HEIGHT, resizeRef.current.startHeight + delta));
        setHeight(next);
      };
      const handleUp = () => {
        resizeRef.current = null;
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [height],
  );

  function handleSend() {
    if (inputValue.trim()) {
      onSend(inputValue.trim());
      setInputValue('');
      if (activeTab !== 'ask') setActiveTab('ask');
    }
  }

  if (!open) return null;

  const tabs: { id: TerminalTab; label: string }[] = [
    { id: 'ask', label: 'Ask' },
    { id: 'agents', label: 'Agents' },
    { id: 'log', label: 'Log' },
  ];

  const content = (
    <div
      ref={widgetRef}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 48,
        right: 0,
        height: expanded ? height : COLLAPSED_HEIGHT,
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <TerminalCanvas seed={42} />

      {/* Resize handle */}
      {expanded && (
        <div
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            top: -4,
            left: 0,
            right: 0,
            height: 8,
            cursor: 'ns-resize',
            zIndex: 5,
          }}
        >
          <div style={{
            position: 'absolute',
            top: 3,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 32,
            height: 3,
            borderRadius: 2,
            background: 'rgba(244,243,240,0.06)',
          }} />
        </div>
      )}

      {/* Collapsed bar */}
      {!expanded && (
        <div
          onClick={() => setExpanded(true)}
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            height: COLLAPSED_HEIGHT,
            padding: '0 16px',
            cursor: 'pointer',
            userSelect: 'none',
            gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
              <path d="M13 16H18" stroke="#5fb3a1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 8L10 12L6 16" stroke="#5fb3a1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 18V6C2 4.89543 2.89543 4 4 4H20C21.1046 4 22 4.89543 22 6V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18Z" stroke="#5fb3a1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--cw-green)', flexShrink: 0,
            animation: 'cw-glow 3s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, color: 'var(--cw-text-dim)',
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', opacity: thoughtOpacity,
            transition: 'opacity 0.2s',
          }}>
            {thoughtText}
          </span>
          {activeAgents.length > 0 && (
            <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {activeAgents.map((ak) => (
                <AgentDot key={ak} agent={ak} active showLabel={false} size="sm" />
              ))}
            </span>
          )}
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, color: 'var(--cw-text-dim)', flexShrink: 0,
          }}>
            {messages.length} events
          </span>
          <span style={{ fontSize: 8, color: 'var(--cw-text-dim)' }}>&#x25B2;</span>
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div style={{
          position: 'relative', zIndex: 2, flex: 1,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Input bar */}
          <div style={{
            borderBottom: '1px solid rgba(244,243,240,0.05)',
            padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            flexShrink: 0, background: 'rgba(30,32,40,0.5)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
              <path d="M13 16H18" stroke="#5fb3a1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 8L10 12L6 16" stroke="#5fb3a1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 18V6C2 4.89543 2.89543 4 4 4H20C21.1046 4 22 4.89543 22 6V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18Z" stroke="#5fb3a1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="ask the engine anything..."
              autoComplete="off"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 14, color: '#F4F3F0', padding: '6px 0',
              }}
            />
            <button
              onClick={handleSend}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11, color: 'var(--cw-text-dim)', padding: '4px 10px',
                borderRadius: 4,
              }}
            >
              send
            </button>
            <button
              onClick={() => setExpanded(false)}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9, color: 'var(--cw-text-dim)',
                background: 'rgba(244,243,240,0.04)',
                border: '1px solid rgba(244,243,240,0.05)',
                padding: '2px 6px', borderRadius: 3,
                flexShrink: 0, cursor: 'pointer',
              }}
              title="Collapse (Escape)"
            >
              esc
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 8, color: 'var(--cw-text-dim)', padding: '4px 2px',
                flexShrink: 0, transform: 'rotate(180deg)',
              }}
              title="Close terminal"
            >
              &#x25B2;
            </button>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 0,
            borderBottom: '1px solid rgba(244,243,240,0.05)',
            flexShrink: 0, padding: '0 14px',
          }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid var(--cw-teal)' : '2px solid transparent',
                  padding: '6px 12px', cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10, fontWeight: 500,
                  letterSpacing: '0.03em', textTransform: 'uppercase',
                  color: activeTab === tab.id ? 'var(--cw-text)' : 'var(--cw-text-dim)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
            {activeTab === 'ask' && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11, color: 'var(--cw-text-muted)', lineHeight: 1.7,
              }}>
                {messages.length === 0 ? (
                  <span style={{ color: 'var(--cw-text-dim)', fontStyle: 'italic' }}>
                    I am watching your code graph. Ask me anything about connections, patterns, or code structure.
                  </span>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                      {msg.type === 'user' && (
                        <div><span style={{ color: 'var(--cw-teal)' }}>you:</span> {msg.text}</div>
                      )}
                      {msg.type === 'theseus' && (
                        <div><span style={{ color: 'var(--cw-green)' }}>theseus:</span> {msg.text}</div>
                      )}
                      {msg.type === 'system' && (
                        <div style={{ color: 'var(--cw-text-dim)' }}>{msg.text}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === 'agents' && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11, color: 'var(--cw-text-muted)', lineHeight: 1.7,
              }}>
                {activeAgents.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activeAgents.map((ak) => (
                      <AgentDot key={ak} agent={ak} active />
                    ))}
                  </div>
                ) : (
                  <span style={{ color: 'var(--cw-text-dim)', fontStyle: 'italic' }}>
                    No agents active. Send a message to activate the pipeline.
                  </span>
                )}
              </div>
            )}
            {activeTab === 'log' && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11, color: 'var(--cw-text-dim)', lineHeight: 1.7,
              }}>
                {messages.filter((m) => m.type === 'system').map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ color: 'var(--cw-teal)', flexShrink: 0 }}>[sys]</span>
                    <span style={{ color: 'var(--cw-text-muted)' }}>{m.text}</span>
                  </div>
                ))}
                {messages.filter((m) => m.type === 'system').length === 0 && (
                  <span style={{ fontStyle: 'italic' }}>No system events yet.</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document === 'undefined') return null;

  return createPortal(content, document.body);
}
