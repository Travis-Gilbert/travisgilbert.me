import type { PluginState } from '@/lib/theseus-plugins-api';

/**
 * Traffic-light accent colour per plugin lifecycle state. Shared
 * between the Plugins marketplace panel (card footer dot) and the
 * Connections panel (installed-connector row dot) so the two
 * surfaces agree on what "failing" looks like.
 *
 * Falls back to in-line hex alongside each CSS var so the panels
 * still render when the Atlas theme variables haven't been loaded
 * (Storybook, isolated visual tests).
 */
export const PLUGIN_STATE_ACCENT: Record<PluginState, string> = {
  discovered: 'var(--paper-ink-3)',
  enabled: 'var(--sage, #6e7f54)',
  disabled: 'var(--paper-ink-3)',
  failing: 'var(--vie-error, #c65c3a)',
  quarantined: 'var(--vie-error, #c65c3a)',
};
