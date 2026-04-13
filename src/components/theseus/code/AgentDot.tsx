'use client';

import { AGENTS, type AgentId } from './agents';

interface AgentDotProps {
  agent: AgentId;
  active: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function AgentDot({ agent, active, showLabel = true, size = 'md' }: AgentDotProps) {
  if (!active) return null;
  const config = AGENTS[agent];
  const dotSize = size === 'sm' ? 6 : 7;

  return (
    <span className="cw-agent-dot-wrap">
      <span
        className={`cw-agent-dot ${config.animationClass}`}
        style={{
          '--agent-color': config.color,
          width: dotSize,
          height: dotSize,
          background: config.color,
          boxShadow: `0 0 8px color-mix(in srgb, ${config.color} 40%, transparent)`,
        } as React.CSSProperties}
      />
      {showLabel && (
        <span className="cw-agent-label" style={{ color: config.color }}>
          {config.name}
        </span>
      )}
    </span>
  );
}
