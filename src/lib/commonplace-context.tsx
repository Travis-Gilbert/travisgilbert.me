/**
 * CommonPlace context utilities.
 *
 * The five focused providers live in src/lib/providers/:
 *   - useLayout()    from layout-provider.tsx
 *   - useWorkspace() from workspace-provider.tsx
 *   - useCapture()   from capture-provider.tsx
 *   - useDrawer()    from drawer-provider.tsx
 *   - useSelection() from selection-provider.tsx
 *
 * This file retains only shared utilities that don't belong
 * to any single provider.
 */

/** Map active screen/view to its section color for the dot grid. */
export function getContextColor(activeScreen: string | null, viewType?: string): string {
  const key = activeScreen || viewType || 'library';
  switch (key) {
    case 'timeline':
    case 'network':
    case 'calendar':
    case 'loose-ends':
      return '#2D5F6B';  // teal
    case 'notebook':
    case 'notebooks':
    case 'project':
    case 'projects':
      return '#C49A4A';  // gold
    case 'connection-engine':
    case 'engine':
    case 'settings':
      return '#8B6FA0';  // purple
    case 'compose':
    case 'library':
    default:
      return '#B8623D';  // terracotta
  }
}
