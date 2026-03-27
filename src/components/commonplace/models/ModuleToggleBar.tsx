'use client';

import type { ModuleId } from '@/lib/commonplace-models';
import { MODULE_META } from '@/lib/commonplace-models';

interface ModuleToggleBarProps {
  visibility: Record<ModuleId, boolean>;
  counts: Record<ModuleId, number>;
  onToggle: (moduleId: ModuleId) => void;
  onAddAssumption?: () => void;
  onStressTest?: () => void;
}

export default function ModuleToggleBar({
  visibility,
  counts,
  onToggle,
  onAddAssumption,
  onStressTest,
}: ModuleToggleBarProps): React.ReactElement {
  const modules = Object.keys(MODULE_META) as ModuleId[];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '3px 20px 5px',
        flexWrap: 'wrap',
      }}
    >
      {modules.map((id) => {
        const meta = MODULE_META[id];
        const active = visibility[id];

        return (
          <button
            key={id}
            onClick={() => onToggle(id)}
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.background = 'rgba(26, 24, 22, 0.04)';
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 99,
              border: 'none',
              background: active ? 'rgba(26, 24, 22, 0.06)' : 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              fontWeight: active ? 500 : 400,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: active
                ? 'rgba(26, 24, 22, 0.6)'
                : 'rgba(26, 24, 22, 0.3)',
              transition: 'all 150ms ease',
              lineHeight: '14px',
            }}
          >
            {/* Accent dot */}
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: meta.accentColor,
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

      <span style={{ flex: 1 }} />

      {/* Action buttons */}
      {onAddAssumption && (
        <button
          onClick={onAddAssumption}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 7px',
            borderRadius: 9,
            border: '1px solid var(--cp-border-faint, #ECEAE6)',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 7,
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--cp-text-faint, #68666E)',
            lineHeight: '14px',
            transition: 'all 0.12s ease',
          }}
        >
          + assumption
        </button>
      )}

      {onStressTest && (
        <button
          onClick={onStressTest}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 7px',
            borderRadius: 9,
            border: '1px solid #B8623D30',
            background: '#B8623D08',
            cursor: 'pointer',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 7,
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#B8623D',
            lineHeight: '14px',
            transition: 'all 0.12s ease',
          }}
        >
          stress test
        </button>
      )}
    </div>
  );
}
