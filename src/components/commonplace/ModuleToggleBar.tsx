'use client';

import type { ModuleId } from '@/lib/commonplace-models';
import { MODULE_META } from '@/lib/commonplace-models';

/**
 * ModuleToggleBar: horizontal row of toggle buttons for module visibility.
 *
 * Each module (tensions, methods, compare, falsify, narratives) gets
 * a toggle button with its accent color pip and count. Active modules
 * have a filled background; inactive are dimmed with a dashed border.
 *
 * Compare is always visible (per spec: "Compare is always available"),
 * so its toggle is disabled but shown for visual consistency.
 */

interface ModuleToggleBarProps {
  visibility: Record<ModuleId, boolean>;
  counts: Record<ModuleId, number>;
  onToggle: (moduleId: ModuleId) => void;
}

export default function ModuleToggleBar({
  visibility,
  counts,
  onToggle,
}: ModuleToggleBarProps) {
  const modules = Object.keys(MODULE_META) as ModuleId[];

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: '8px 20px',
        borderBottom: '1px solid var(--cp-border-faint, #ECEAE6)',
        background: 'var(--cp-surface, #F8F7F4)',
        flexWrap: 'wrap',
      }}
    >
      {modules.map((id) => {
        const meta = MODULE_META[id];
        const active = visibility[id];
        const isCompare = id === 'compare';

        return (
          <button
            key={id}
            onClick={() => !isCompare && onToggle(id)}
            disabled={isCompare}
            title={
              isCompare
                ? 'Compare is always visible'
                : `${active ? 'Hide' : 'Show'} ${meta.label}`
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 3,
              border: active
                ? `1px solid ${meta.accentColor}33`
                : '1px dashed var(--cp-border, #E2E0DC)',
              background: active ? `${meta.accentColor}0D` : 'transparent',
              cursor: isCompare ? 'default' : 'pointer',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: active
                ? meta.accentColor
                : 'var(--cp-text-faint, #68666E)',
              opacity: isCompare ? 0.7 : 1,
              transition: 'all 0.12s ease',
            }}
          >
            {/* Accent pip */}
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: active
                  ? meta.accentColor
                  : 'var(--cp-border, #E2E0DC)',
                flexShrink: 0,
              }}
            />
            {meta.label}
            {counts[id] > 0 && (
              <span style={{ opacity: 0.7 }}>{counts[id]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
