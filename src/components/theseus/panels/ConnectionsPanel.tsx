'use client';

import PluginsPanel from './PluginsPanel';

// Mobile Shell 2.0 (2026-04-28): the dedicated Connections panel was
// merged into the Plugins panel as its Connectors sub-tab. This file
// stays as a thin shim so URL deep links to ?view=connections (and any
// stale event listeners that still dispatch the old panel id) keep
// working without a redirect bounce.
export default function ConnectionsPanel() {
  return <PluginsPanel defaultTab="connectors" />;
}
