/**
 * GeographicMap — lightweight inline map for `geographic` answer_type.
 *
 * Reads `visual.geographic_regions` (the backend's GeographicRegionsSection)
 * and either `visual.structured.geo_projection` (optional precomputed
 * [x, y] per region) OR falls back to rendering each region as a chip
 * in a vertical list.
 *
 * A full choropleth requires a topojson + d3-geo layer that isn't in
 * the client bundle; we keep this renderer honest by defaulting to the
 * chip list and letting a future batch wire d3-geo in place of the
 * fallback. The chip list still supports region hover → canvas focus,
 * so the primary "graph cross-highlight" behavior works today.
 */

'use client';

import type { FC } from 'react';
import { useMemo } from 'react';
import type { StructuredVisual, StructuredVisualRegion } from '@/lib/theseus-types';

interface GeographicMapProps {
  visual: StructuredVisual;
  onRegionHover?: (region: StructuredVisualRegion | null) => void;
  onRegionSelect?: (region: StructuredVisualRegion) => void;
}

interface GeoRegion {
  id: string;
  label: string;
  linked_evidence?: string[];
}

function readRegions(visual: StructuredVisual): GeoRegion[] {
  // Prefer the dedicated GeographicRegionsSection when present; fall back
  // to the generic `regions` array on StructuredVisual.
  const regions: GeoRegion[] = [];
  const geo = visual.regions;
  if (Array.isArray(geo)) {
    for (const r of geo) {
      if (!r || typeof r !== 'object') continue;
      const id = String(r.id ?? '');
      const label = String(r.label ?? '');
      if (!id || !label) continue;
      regions.push({
        id,
        label,
        linked_evidence: Array.isArray(r.linked_evidence) ? r.linked_evidence.map(String) : undefined,
      });
    }
  }
  return regions;
}

const GeographicMap: FC<GeographicMapProps> = ({ visual, onRegionHover, onRegionSelect }) => {
  const regions = useMemo(() => readRegions(visual), [visual]);
  if (regions.length === 0) return null;

  return (
    <div
      style={{
        background: 'var(--color-paper, #fdfbf6)',
        border: '1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)',
        borderRadius: 6,
        padding: 12,
        boxShadow: 'var(--shadow-warm-sm)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-metadata)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-muted)',
          marginBottom: 8,
        }}
      >
        Regions
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {regions.map((region) => {
          const hasLinked = region.linked_evidence && region.linked_evidence.length > 0;
          return (
            <button
              key={region.id}
              type="button"
              onMouseEnter={() => {
                if (!onRegionHover || !hasLinked) return;
                onRegionHover({
                  id: region.id,
                  label: region.label,
                  x: 0,
                  y: 0,
                  width: 1,
                  height: 1,
                  linked_evidence: region.linked_evidence,
                });
              }}
              onMouseLeave={() => onRegionHover?.(null)}
              onClick={() => {
                if (!hasLinked || !onRegionSelect) return;
                onRegionSelect({
                  id: region.id,
                  label: region.label,
                  x: 0,
                  y: 0,
                  width: 1,
                  height: 1,
                  linked_evidence: region.linked_evidence,
                });
              }}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 4,
                background: hasLinked
                  ? 'color-mix(in srgb, var(--color-teal) 14%, transparent)'
                  : 'transparent',
                border: `1px solid color-mix(in srgb, var(--color-teal) ${hasLinked ? 30 : 14}%, transparent)`,
                color: 'var(--color-ink)',
                cursor: hasLinked ? 'pointer' : 'default',
              }}
            >
              {region.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default GeographicMap;
