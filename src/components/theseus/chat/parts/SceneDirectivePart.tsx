'use client';

import { ArrowUpRightIcon } from 'lucide-react';
import type { FC } from 'react';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import { dispatchTheseusEvent } from '@/lib/theseus/events';
import { normalizeDirective } from '@/lib/theseus/sceneDirector/directive';

interface SceneDirectivePartProps {
  directive: SceneDirective;
  label?: string;
}

/**
 * "Show in Explorer" affordance. Renders as a button attached to a chat
 * answer card. Click switches to the Explorer panel and fires an
 * `explorer:apply-directive` event carrying the (normalized) directive.
 */
const SceneDirectivePart: FC<SceneDirectivePartProps> = ({
  directive,
  label = 'Show in Explorer',
}) => {
  const handleClick = () => {
    const normalized = normalizeDirective(directive);
    dispatchTheseusEvent('theseus:switch-panel', {
      panel: 'explorer',
      source: 'chat-directive',
    });
    // Fire the directive after the panel switch so ExplorerPanel's listener
    // is mounted by the time the directive arrives.
    window.requestAnimationFrame(() => {
      dispatchTheseusEvent('explorer:apply-directive', {
        directive: normalized,
        source: 'chat',
      });
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="aui-scene-directive"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--brass, #c9a23a)',
        background: 'transparent',
        border: '1px solid color-mix(in srgb, var(--brass, #c9a23a) 30%, transparent)',
        borderRadius: 4,
        padding: '6px 10px',
        cursor: 'pointer',
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'color-mix(in srgb, var(--brass, #c9a23a) 8%, transparent)';
        e.currentTarget.style.borderColor = 'var(--brass, #c9a23a)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--brass, #c9a23a) 30%, transparent)';
      }}
    >
      <ArrowUpRightIcon width={12} height={12} />
      {label}
    </button>
  );
};

export default SceneDirectivePart;
