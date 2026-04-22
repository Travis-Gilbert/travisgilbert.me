import type { CSSProperties } from 'react';

/**
 * Paper-surface CSS custom properties applied to any Atlas panel
 * whose content area uses the paper token family. Exported as a
 * plain object so consumers can spread into their style prop:
 *
 *     <div style={{ ...paperTokens, display: 'grid' }}>
 *
 * Kept as a frozen constant because the object is passed as a React
 * style prop on every render; React uses referential identity as a
 * hint for diffing, so a single module-level object avoids a fresh
 * allocation each mount.
 */
export const PAPER_TOKENS: CSSProperties & Record<string, string> =
  Object.freeze({
    background: 'var(--paper)',
    color: 'var(--paper-ink)',
    ['--ink']: 'var(--paper-ink)',
    ['--ink-2']: 'var(--paper-ink-2)',
    ['--ink-3']: 'var(--paper-ink-3)',
    ['--rule']: 'var(--paper-rule)',
    ['--rule-strong']: '#a89d8f',
    ['--accent-color']: 'var(--paper-pencil)',
    ['--pencil']: 'var(--paper-pencil)',
  }) as CSSProperties & Record<string, string>;
