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
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 7px',
              borderRadius: 9,
              border: active
                ? `1px solid ${meta.accentColor}40`
                : '1px solid transparent',
              background: active ? `${meta.accentColor}0D` : 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 7,
              fontWeight: 500,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: active
                ? meta.accentColor
                : 'var(--cp-text-faint, #68666E)',
              transition: 'all 0.12s ease',
              lineHeight: '14px',
            }}
          >
            {/* Accent dot */}
            <span
              style={{
                width: 4,
                height: 4,
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
            border: '1px solid #C4503C30',
            background: '#C4503C08',
            cursor: 'pointer',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 7,
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#C4503C',
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
