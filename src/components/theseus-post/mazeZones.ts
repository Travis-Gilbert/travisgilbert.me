// mazeZones.ts: Scroll-zone tracking via IntersectionObserver.
// Each content section declares which maze zones it activates.

import type { MazeZone } from './MazeWalls';

export interface ZoneMapping {
  sectionId: string;
  zones: MazeZone[];
}

// Maps each content section to the maze zones it activates.
// Order matches the revised section sequence from the addendum.
export const ZONE_MAPPINGS: ZoneMapping[] = [
  { sectionId: 'hero', zones: ['capture', 'vault', 'engine', 'pipeline'] },
  { sectionId: 'vision', zones: ['capture', 'vault'] },
  { sectionId: 'interstitial-1', zones: ['pipeline', 'engine'] },
  { sectionId: 'theseus-layer', zones: ['pipeline', 'engine'] },
  { sectionId: 'index-api', zones: ['connectors'] },
  { sectionId: 'commonplace-layer', zones: ['vault', 'compose', 'ui'] },
  { sectionId: 'interstitial-2', zones: ['vault', 'engine'] },
  { sectionId: 'scenario', zones: ['capture', 'pipeline', 'vault', 'engine'] },
  { sectionId: 'feedback', zones: ['iq', 'feedback'] },
  { sectionId: 'interstitial-3', zones: ['pipeline', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] },
  { sectionId: 'pipeline', zones: ['pipeline', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] },
  { sectionId: 'roadmap', zones: ['vault', 'engine', 'iq', 'compose', 'resurface', 'tension'] },
  { sectionId: 'close', zones: ['capture', 'vault', 'engine', 'pipeline'] },
];

// Hook-compatible zone tracker using IntersectionObserver.
// Returns the set of currently active zones based on which sections
// are in the viewport center band (40%-60%).
export function createZoneTracker(
  onZonesChange: (zones: Set<MazeZone>) => void,
): {
  observe: (sectionId: string, element: HTMLElement) => void;
  disconnect: () => void;
} {
  const visibleSections = new Set<string>();
  const elementMap = new Map<Element, string>();

  const observer = new IntersectionObserver(
    (entries) => {
      let changed = false;
      for (const entry of entries) {
        const sectionId = elementMap.get(entry.target);
        if (!sectionId) continue;

        if (entry.isIntersecting) {
          if (!visibleSections.has(sectionId)) {
            visibleSections.add(sectionId);
            changed = true;
          }
        } else {
          if (visibleSections.has(sectionId)) {
            visibleSections.delete(sectionId);
            changed = true;
          }
        }
      }

      if (changed) {
        const activeZones = new Set<MazeZone>();
        for (const sid of visibleSections) {
          const mapping = ZONE_MAPPINGS.find((m) => m.sectionId === sid);
          if (mapping) {
            for (const z of mapping.zones) activeZones.add(z);
          }
        }
        onZonesChange(activeZones);
      }
    },
    {
      // Fire when sections enter the center band (40%-60% of viewport)
      rootMargin: '-40% 0px -40% 0px',
      threshold: 0,
    },
  );

  return {
    observe(sectionId: string, element: HTMLElement) {
      elementMap.set(element, sectionId);
      observer.observe(element);
    },
    disconnect() {
      observer.disconnect();
      elementMap.clear();
      visibleSections.clear();
    },
  };
}
