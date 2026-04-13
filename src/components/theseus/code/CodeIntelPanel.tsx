'use client';

import { useEffect, useRef, useState } from 'react';
import type { Suggestion, ChatMessage, AgentId } from './agents';
import SuggestionCard from './SuggestionCard';
import AgentDot from './AgentDot';

interface CodeIntelPanelProps {
  suggestions: Suggestion[];
  messages: ChatMessage[];
  activeAgents: AgentId[];
  isEditing: boolean;
  editProgress: number;
  totalEdits: number;
  onSend: (text: string) => void;
  onAction: (suggestion: Suggestion) => void;
}

export default function CodeIntelPanel({
  suggestions,
  messages,
  activeAgents,
  isEditing,
  editProgress,
  totalEdits,
  onSend,
  onAction,
}: CodeIntelPanelProps) {
  const [input, setInput] = useState('');
  const msgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msgRef.current) {
      msgRef.current.scrollTop = msgRef.current.scrollHeight;
    }
  }, [messages, activeAgents]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
      e.preventDefault();
      onSend(input);
      setInput('');
    }
  }

  function handleSendClick() {
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  }

  return (
    <div className="cw-intel">
      {/* Proactive suggestions */}
      <div className="cw-intel-suggestions">
        <div className="cw-intel-header">
          <span className="cw-intel-header-dot" />
          Theseus sees
        </div>
        {suggestions.map((s, i) => (
          <SuggestionCard key={`${s.type}-${i}`} suggestion={s} onAction={onAction} />
        ))}
      </div>

      {/* Conversation */}
      <div ref={msgRef} className="cw-intel-conversation" aria-live="polite">
        {messages.map((msg, i) => (
          <div key={i} className="cw-intel-msg">
            {msg.type === 'user' && (
              <div className="cw-intel-msg-user">{msg.text}</div>
            )}
            {msg.type === 'theseus' && (
              <div className="cw-intel-msg-theseus">{msg.text}</div>
            )}
            {msg.type === 'system' && (
              <div className="cw-intel-msg-system">
                <span className="cw-intel-msg-system-dot" />
                {msg.text}
              </div>
            )}
            {msg.type === 'agents' && msg.agents && (
              <div className="cw-intel-msg-agents">
                {msg.agents.map((ak) => (
                  <AgentDot key={ak} agent={ak} active />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Live agent strip */}
        {activeAgents.length > 0 && (
          <div className="cw-intel-live-agents" aria-live="assertive">
            {activeAgents.map((ak) => (
              <AgentDot key={ak} agent={ak} active />
            ))}
            {isEditing && (
              <>
                <span className="cw-intel-progress-label">
                  {editProgress}/{totalEdits}
                </span>
                <div className="cw-intel-progress-bar">
                  <div
                    className="cw-intel-progress-fill"
                    style={{ width: `${(editProgress / Math.max(totalEdits, 1)) * 100}%` }}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="cw-intel-input-wrap">
        <textarea
          className="cw-intel-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell Theseus what to do..."
          rows={4}
        />
        <div className="cw-intel-input-actions">
          <button type="button" className="cw-intel-btn-graph">GRAPH</button>
          <button type="button" className="cw-intel-btn-send" onClick={handleSendClick}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
