'use client';

import type { Plugin } from './agents';

interface PluginRibbonProps {
  plugins: Plugin[];
  onToggle: (id: string) => void;
}

export default function PluginRibbon({ plugins, onToggle }: PluginRibbonProps) {
  return (
    <div className="cw-plugin-ribbon">
      {plugins.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`cw-plugin-btn${p.active ? ' is-active' : ''}`}
          title={p.name}
          aria-label={p.name}
          style={{ '--plugin-color': p.color } as React.CSSProperties}
          onClick={() => onToggle(p.id)}
        >
          <span className="cw-plugin-icon">{p.icon}</span>
          {p.active && <span className="cw-plugin-pip" />}
        </button>
      ))}
    </div>
  );
}
