'use client';

import { useState } from 'react';
import { NavArrowLeft, NavArrowRight } from 'iconoir-react';
import type { Connection } from '@/lib/connectionEngine';

const TYPE_URL_PREFIX: Record<string, string> = {
  essay: '/essays',
  'field-note': '/field-notes',
  shelf: '/shelf',
};

interface ConnectedReadingSidebarProps {
  connections: Connection[];
  currentSlug: string;
  currentTitle: string;
}

export default function ConnectedReadingSidebar({
  connections, currentTitle,
}: ConnectedReadingSidebarProps) {
  const [expanded, setExpanded] = useState(false);

  if (connections.length === 0) return null;

  // Group by type
  const grouped = new Map<string, Connection[]>();
  for (const conn of connections) {
    const group = grouped.get(conn.type) ?? [];
    group.push(conn);
    grouped.set(conn.type, group);
  }

  return (
    <aside
      className="hidden xl:block fixed right-0 z-50 transition-all duration-200 ease-out"
      /* Sits below the hero zone; above DesignLanguageEasterEgg (z-40) */
      style={{
        top: '40vh',
        width: expanded ? 320 : 36,
        backgroundColor: 'rgba(240, 235, 228, 0.95)',
        backdropFilter: 'blur(8px)',
        borderLeft: '1px solid var(--color-border)',
      }}
      aria-label="Connected reading sidebar"
    >
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center py-3 bg-transparent border-none cursor-pointer"
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{ minHeight: 44 }}
      >
        {expanded ? <NavArrowRight width={16} height={16} /> : <NavArrowLeft width={16} height={16} />}
        {!expanded && (
          <span
            className="font-mono text-[11px] mt-1"
            style={{ writingMode: 'vertical-rl', color: 'var(--color-ink-light)' }}
          >
            {connections.length} connections
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <h3
            className="font-mono text-[10px] uppercase tracking-widest mb-3"
            style={{ color: '#B45A2D' }}
          >
            Connections
          </h3>
          <p className="text-xs text-ink-secondary mb-4">
            Related to: {currentTitle}
          </p>

          {Array.from(grouped.entries()).map(([type, conns]) => (
            <div key={type} className="mb-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-ink-light mb-1">
                {type.replace('-', ' ')}s
              </p>
              {conns.map((conn) => (
                <a
                  key={conn.slug}
                  href={`${TYPE_URL_PREFIX[conn.type] ?? ''}/${conn.slug}`}
                  className="block text-sm text-ink hover:text-terracotta no-underline py-1.5 border-l-2 pl-2 mb-1"
                  style={{ borderLeftColor: conn.color }}
                >
                  {conn.title}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
