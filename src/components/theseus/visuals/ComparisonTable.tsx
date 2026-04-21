/**
 * ComparisonTable — side-by-side grid for `comparison` answer_type.
 *
 * Reads `visual.structured.rows: Array<{ label, columns: string[] }>`
 * and `visual.structured.columns: string[]`. Falls through to regions
 * when the richer structured payload isn't present. Every cell + row
 * is hoverable and links back to the canvas via `onRegionHover`.
 */

'use client';

import type { FC } from 'react';
import type { StructuredVisual, StructuredVisualRegion } from '@/lib/theseus-types';

interface ComparisonTableProps {
  visual: StructuredVisual;
  onRegionHover?: (region: StructuredVisualRegion | null) => void;
  onRegionSelect?: (region: StructuredVisualRegion) => void;
}

interface ComparisonRow {
  label: string;
  columns: string[];
  linked_evidence?: string[];
}

function readRows(visual: StructuredVisual): ComparisonRow[] | null {
  // Preferred: explicit rows + columns.
  const raw = visual.structured?.rows;
  if (Array.isArray(raw)) {
    const rows: ComparisonRow[] = [];
    for (const r of raw) {
      if (!r || typeof r !== 'object') continue;
      const rec = r as Record<string, unknown>;
      const label = typeof rec.label === 'string' ? rec.label : '';
      const columns = Array.isArray(rec.columns) ? rec.columns.map((c) => String(c ?? '')) : [];
      const linked = Array.isArray(rec.linked_evidence) ? rec.linked_evidence.map(String) : undefined;
      if (label.length === 0 || columns.length === 0) continue;
      rows.push({ label, columns, linked_evidence: linked });
    }
    if (rows.length > 0) return rows;
  }
  // Fallback: items[] with {label, snippet, object_pk, object_type}. This
  // is the shape the 26B currently ships for `comparison` answer_type.
  const items = visual.structured?.items;
  if (Array.isArray(items)) {
    const rows: ComparisonRow[] = [];
    for (const r of items) {
      if (!r || typeof r !== 'object') continue;
      const rec = r as Record<string, unknown>;
      const label = typeof rec.label === 'string' ? rec.label : '';
      const snippet = typeof rec.snippet === 'string' ? rec.snippet : '';
      if (label.length === 0) continue;
      const objectPk = rec.object_pk;
      const linked = objectPk !== null && objectPk !== undefined ? [String(objectPk)] : undefined;
      rows.push({ label, columns: [snippet], linked_evidence: linked });
    }
    if (rows.length > 0) return rows;
  }
  return null;
}

function readColumns(visual: StructuredVisual): string[] {
  const raw = visual.structured?.columns;
  if (Array.isArray(raw)) {
    const cols = raw.map((c) => String(c ?? '')).filter((c) => c.length > 0);
    if (cols.length > 0) return cols;
  }
  // When we synthesized rows from items[], there's a single snippet column.
  if (Array.isArray(visual.structured?.items)) return ['Excerpt'];
  return [];
}

const ComparisonTable: FC<ComparisonTableProps> = ({ visual, onRegionHover }) => {
  const rows = readRows(visual);
  const columns = readColumns(visual);

  if (!rows || columns.length === 0) return null;

  return (
    <div
      style={{
        background: 'var(--color-paper, #fdfbf6)',
        border: '1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)',
        borderRadius: 6,
        padding: 16,
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        lineHeight: 1.5,
        color: 'var(--color-ink)',
        boxShadow: 'var(--shadow-warm-sm)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: '6px 8px',
                fontFamily: 'var(--font-metadata)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-muted)',
                borderBottom: '1px solid color-mix(in srgb, var(--color-ink) 20%, transparent)',
              }}
            />
            {columns.map((col) => (
              <th
                key={col}
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  fontFamily: 'var(--font-metadata)',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-muted)',
                  borderBottom: '1px solid color-mix(in srgb, var(--color-ink) 20%, transparent)',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.label}-${i}`}
              onMouseEnter={() => {
                if (!onRegionHover || !row.linked_evidence || row.linked_evidence.length === 0) return;
                onRegionHover({
                  id: `comparison-row-${i}`,
                  label: row.label,
                  x: 0,
                  y: i,
                  width: columns.length,
                  height: 1,
                  linked_evidence: row.linked_evidence,
                });
              }}
              onMouseLeave={() => onRegionHover?.(null)}
              style={{
                borderBottom: '1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)',
              }}
            >
              <td
                style={{
                  padding: '8px',
                  fontFamily: 'var(--font-title)',
                  fontWeight: 500,
                }}
              >
                {row.label}
              </td>
              {row.columns.map((cell, ci) => (
                <td key={ci} style={{ padding: '8px', verticalAlign: 'top' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonTable;
