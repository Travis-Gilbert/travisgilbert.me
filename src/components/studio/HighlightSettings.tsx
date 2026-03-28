'use client';

import { useState, useEffect } from 'react';
import { getHighlightColors, saveHighlightColors } from './HighlightPicker';
import type { HighlightColor } from './HighlightPicker';

const PRESET_COLORS = [
  'rgba(212, 170, 74, 0.25)',
  'rgba(45, 95, 107, 0.20)',
  'rgba(138, 106, 154, 0.22)',
  'rgba(180, 90, 45, 0.18)',
  'rgba(90, 122, 74, 0.22)',
  'rgba(164, 74, 58, 0.20)',
];

export default function HighlightSettings() {
  const [colors, setColors] = useState<HighlightColor[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setColors(getHighlightColors());
    setMounted(true);
  }, []);

  const updateColor = (id: string, newColor: string) => {
    const updated = colors.map((c) =>
      c.id === id ? { ...c, color: newColor } : c,
    );
    setColors(updated);
    saveHighlightColors(updated);
  };

  const cycleColor = (id: string) => {
    const current = colors.find((c) => c.id === id);
    if (!current) return;
    const idx = PRESET_COLORS.indexOf(current.color);
    const next = PRESET_COLORS[(idx + 1) % PRESET_COLORS.length];
    updateColor(id, next);
  };

  const updateLabel = (id: string, label: string) => {
    const updated = colors.map((c) =>
      c.id === id ? { ...c, label: label.slice(0, 12) } : c,
    );
    setColors(updated);
    saveHighlightColors(updated);
  };

  const addFourthSwatch = () => {
    if (colors.length >= 4) return;
    const updated = [
      ...colors,
      { id: '4', color: 'rgba(180, 90, 45, 0.18)', label: '' },
    ];
    setColors(updated);
    saveHighlightColors(updated);
  };

  const removeFourthSwatch = () => {
    const updated = colors.filter((c) => c.id !== '4');
    setColors(updated);
    saveHighlightColors(updated);
  };

  if (!mounted) return null;

  return (
    <section>
      <div className="studio-section-head" style={{ marginTop: 0 }}>
        <span className="studio-section-label">Highlight Colors</span>
        <span className="studio-section-line" />
      </div>
      <div
        style={{
          border: '1px solid var(--studio-border)',
          borderRadius: '6px',
          padding: '12px 14px',
          backgroundColor: 'var(--studio-surface)',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {colors.map((c) => (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => cycleColor(c.id)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  backgroundColor: c.color,
                  border: '2px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                  transition: 'transform 0.1s ease',
                }}
                title="Click to cycle color"
                aria-label={`Cycle color for swatch ${c.id}`}
              />
              <input
                type="text"
                value={c.label}
                onChange={(e) => updateLabel(c.id, e.target.value)}
                placeholder="Label"
                maxLength={12}
                style={{
                  width: '60px',
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '9px',
                  color: 'var(--studio-text-1)',
                  background: 'rgba(237, 231, 220, 0.06)',
                  border: '1px solid var(--studio-border)',
                  borderRadius: '3px',
                  padding: '2px 4px',
                  outline: 'none',
                  textAlign: 'center',
                }}
              />
            </div>
          ))}

          {colors.length < 4 && (
            <button
              type="button"
              onClick={addFourthSwatch}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                border: '1px dashed var(--studio-border)',
                background: 'transparent',
                color: 'var(--studio-text-3)',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Add 4th highlight color"
              aria-label="Add fourth highlight color"
            >
              +
            </button>
          )}

          {colors.length >= 4 && (
            <button
              type="button"
              onClick={removeFourthSwatch}
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '9px',
                color: 'var(--studio-text-3)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                alignSelf: 'center',
                textDecoration: 'underline',
              }}
              title="Remove 4th swatch"
            >
              Remove 4th
            </button>
          )}
        </div>

        <p style={{
          marginTop: '10px',
          marginBottom: 0,
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '9px',
          color: 'var(--studio-text-3)',
        }}>
          Click a swatch to cycle colors. Labels appear as tooltips in the editor.
        </p>
      </div>
    </section>
  );
}
