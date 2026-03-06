'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { EvidenceBoardRow } from '@/lib/studio-api';
import { updateEvidenceBoard } from '@/lib/studio-api';

const EMPTY_ROW: EvidenceBoardRow = {
  clue: '',
  source: '',
  confidence: 'low',
  nextAction: '',
  visual: '',
};

const CONFIDENCE_OPTIONS: Array<{ value: EvidenceBoardRow['confidence']; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const COLUMNS: Array<{ key: keyof EvidenceBoardRow; label: string }> = [
  { key: 'clue', label: 'Clue' },
  { key: 'source', label: 'Source' },
  { key: 'confidence', label: 'Conf.' },
  { key: 'nextAction', label: 'Next Action' },
  { key: 'visual', label: 'Visual' },
];

const DEBOUNCE_MS = 1200;

export default function EvidenceBoard({
  slug,
  initialRows,
  sources = [],
}: {
  slug: string;
  initialRows: EvidenceBoardRow[];
  sources?: string[];
}) {
  const [rows, setRows] = useState<EvidenceBoardRow[]>(
    initialRows.length > 0 ? initialRows : [],
  );
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRowsRef = useRef(rows);

  // Keep ref in sync for the debounced save closure
  useEffect(() => {
    latestRowsRef.current = rows;
  }, [rows]);

  const save = useCallback(
    async (rowsToSave: EvidenceBoardRow[]) => {
      setSaving(true);
      try {
        await updateEvidenceBoard(slug, rowsToSave);
      } catch {
        // best effort
      } finally {
        setSaving(false);
      }
    },
    [slug],
  );

  const scheduleSave = useCallback(
    (nextRows: EvidenceBoardRow[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => save(nextRows), DEBOUNCE_MS);
    },
    [save],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const updateRow = useCallback(
    (index: number, field: keyof EvidenceBoardRow, value: string) => {
      setRows((prev) => {
        const next = prev.map((r, i) =>
          i === index ? { ...r, [field]: value } : r,
        );
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const addRow = useCallback(() => {
    setRows((prev) => {
      const next = [...prev, { ...EMPTY_ROW }];
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const removeRow = useCallback(
    (index: number) => {
      setRows((prev) => {
        const next = prev.filter((_, i) => i !== index);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  return (
    <div className="studio-evidence-board">
      {/* Header row */}
      <div className="studio-evidence-row">
        {COLUMNS.map((col) => (
          <div key={col.key} className="studio-evidence-header">
            {col.label}
          </div>
        ))}
        {/* Spacer for delete button column */}
        <div className="studio-evidence-header" style={{ width: '28px', minWidth: '28px', flex: 'none' }} />
      </div>

      {/* Data rows */}
      {rows.map((row, i) => (
        <div key={i} className="studio-evidence-row">
          {/* Clue */}
          <div className="studio-evidence-cell">
            <input
              type="text"
              value={row.clue}
              onChange={(e) => updateRow(i, 'clue', e.target.value)}
              placeholder="What did you find?"
            />
          </div>

          {/* Source */}
          <div className="studio-evidence-cell">
            <input
              type="text"
              value={row.source}
              onChange={(e) => updateRow(i, 'source', e.target.value)}
              placeholder="Where from?"
              list={`evidence-sources-${i}`}
            />
            {sources.length > 0 && (
              <datalist id={`evidence-sources-${i}`}>
                {sources.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
          </div>

          {/* Confidence */}
          <div className="studio-evidence-cell">
            <select
              className="studio-evidence-confidence"
              data-level={row.confidence}
              value={row.confidence}
              onChange={(e) =>
                updateRow(i, 'confidence', e.target.value)
              }
            >
              {CONFIDENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Next Action */}
          <div className="studio-evidence-cell">
            <input
              type="text"
              value={row.nextAction}
              onChange={(e) => updateRow(i, 'nextAction', e.target.value)}
              placeholder="What to do next"
            />
          </div>

          {/* Visual */}
          <div className="studio-evidence-cell">
            <input
              type="text"
              value={row.visual}
              onChange={(e) => updateRow(i, 'visual', e.target.value)}
              placeholder="How to show it"
            />
          </div>

          {/* Delete button */}
          <div
            className="studio-evidence-cell"
            style={{
              width: '28px',
              minWidth: '28px',
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => removeRow(i)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--studio-text-3)',
                fontSize: '14px',
                lineHeight: 1,
                padding: '2px',
              }}
              title="Remove row"
            >
              &times;
            </button>
          </div>
        </div>
      ))}

      {/* Footer: add row + status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          borderTop: rows.length > 0 ? '1px solid var(--studio-border)' : 'none',
        }}
      >
        <button
          type="button"
          onClick={addRow}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--studio-accent)',
            padding: '4px 0',
          }}
        >
          + Add Clue
        </button>
        {saving && (
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              color: 'var(--studio-text-3)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Saving...
          </span>
        )}
      </div>
    </div>
  );
}
