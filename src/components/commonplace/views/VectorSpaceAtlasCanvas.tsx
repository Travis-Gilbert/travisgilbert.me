'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EmbeddingView, EmbeddingViewMosaic } from 'embedding-atlas/react';
import type { DataPoint } from 'embedding-atlas/react';
import {
  COMMONPLACE_EMBEDDING_TABLE,
  atlasLabels,
  dataPointForRow,
  embeddingRowsToArrays,
  nearestRow,
} from '@/lib/commonplace-embedding-space';
import type { EmbeddingSpaceRowGql } from '@/lib/commonplace-graphql';

const CATEGORY_COLORS = [
  '#2D5F6B',
  '#C49A4A',
  '#8B6FA0',
  '#A65324',
  '#5A7A4A',
  '#4A7A9A',
  '#B06080',
  '#6B7A8A',
  '#C47A3A',
  '#78767E',
];

interface VectorSpaceAtlasCanvasProps {
  rows: EmbeddingSpaceRowGql[];
  mosaicReady: boolean;
  selectedIdentifier?: string | null;
  highlightedIdentifiers?: string[];
  onSelect: (identifier: string | null) => void;
}

export default function VectorSpaceAtlasCanvas({
  rows,
  mosaicReady,
  selectedIdentifier,
  highlightedIdentifiers = [],
  onSelect,
}: VectorSpaceAtlasCanvasProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 720, height: 520 });

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setSize({
        width: Math.max(260, Math.round(rect.width)),
        height: Math.max(260, Math.round(rect.height)),
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const arrays = useMemo(() => embeddingRowsToArrays(rows), [rows]);
  const labels = useMemo(() => atlasLabels(rows), [rows]);
  const selectedRow = useMemo(
    () => rows.find((row) => row.identifier === selectedIdentifier) ?? null,
    [rows, selectedIdentifier],
  );
  const selectedDataPoint = useMemo(
    () => (selectedRow ? dataPointForRow(selectedRow) : null),
    [selectedRow],
  );
  const selectedIdentifiers = useMemo(() => {
    const values = new Set(highlightedIdentifiers);
    if (selectedIdentifier) values.add(selectedIdentifier);
    return [...values];
  }, [highlightedIdentifiers, selectedIdentifier]);
  const selectedDataPoints = useMemo(
    () =>
      selectedIdentifiers
        .map((identifier) => rows.find((row) => row.identifier === identifier))
        .filter((row): row is EmbeddingSpaceRowGql => !!row)
        .map(dataPointForRow),
    [rows, selectedIdentifiers],
  );

  const handleSelection = (selection: DataPoint[] | null) => {
    const identifier = selection?.[0]?.identifier;
    onSelect(identifier == null ? null : String(identifier));
  };

  return (
    <div ref={frameRef} style={{ width: '100%', height: '100%', minHeight: 0 }}>
      {mosaicReady ? (
        <EmbeddingViewMosaic
          table={COMMONPLACE_EMBEDDING_TABLE}
          x="x"
          y="y"
          category="category"
          text="text"
          identifier="identifier"
          additionalFields={{
            category_label: 'category_label',
            community_id: 'community_id',
            epistemic_status: 'epistemic_status',
            created_ms: 'created_ms',
          }}
          width={size.width}
          height={size.height}
          labels={labels}
          categoryColors={CATEGORY_COLORS}
          selection={selectedIdentifiers.length > 0 ? selectedIdentifiers : null}
          onSelection={handleSelection}
          theme={{
            fontFamily: 'var(--cp-font-body)',
            brandingLink: null,
            statusBar: false,
          }}
          config={{
            colorScheme: 'light',
            mode: 'density',
            pointSize: 2.4,
            autoLabelEnabled: true,
          }}
        />
      ) : (
        <EmbeddingView
          data={arrays}
          width={size.width}
          height={size.height}
          labels={labels}
          categoryColors={CATEGORY_COLORS}
          selection={selectedDataPoints.length > 0 ? selectedDataPoints : selectedDataPoint ? [selectedDataPoint] : null}
          onSelection={handleSelection}
          querySelection={async (x, y, unitDistance) => {
            const row = nearestRow(rows, x, y, unitDistance);
            return row ? dataPointForRow(row) : null;
          }}
          theme={{
            fontFamily: 'var(--cp-font-body)',
            brandingLink: null,
            statusBar: false,
          }}
          config={{
            colorScheme: 'light',
            mode: 'density',
            pointSize: 2.4,
            autoLabelEnabled: false,
          }}
        />
      )}
    </div>
  );
}
