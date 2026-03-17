'use client';

/**
 * TemporalEvolutionView (Surface 9): monitoring view showing how the
 * knowledge graph evolves over time.
 *
 * Three metric cards (objects, edges, density) with deltas, a Chart.js
 * multi-line growth chart, and a snapshot table. Window/step controls
 * let the user adjust the analysis window.
 *
 * Screen archetype: Monitoring. Chart gets the most visual weight.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchTemporalEvolution, useApiData } from '@/lib/commonplace-api';
import type { ApiTemporalSnapshot, ApiTemporalEvolution } from '@/lib/commonplace';

/* ────────────────────────────────────────────────────
   Props
   ──────────────────────────────────────────────────── */

interface TemporalEvolutionViewProps {
  notebookSlug?: string;
}

/* ────────────────────────────────────────────────────
   Window options
   ──────────────────────────────────────────────────── */

const WINDOW_OPTIONS = [7, 14, 30, 60, 90];
const STEP_OPTIONS = [1, 3, 7, 14];

/* ────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────── */

export default function TemporalEvolutionView({
  notebookSlug,
}: TemporalEvolutionViewProps) {
  const [windowDays, setWindowDays] = useState(30);
  const [stepDays, setStepDays] = useState(7);

  const { data, loading, error, refetch } = useApiData(
    () =>
      notebookSlug
        ? fetchTemporalEvolution(notebookSlug, windowDays, stepDays)
        : Promise.resolve({ snapshots: [], trajectory: [], summary: '' }),
    [notebookSlug, windowDays, stepDays],
  );

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="cp-temporal-view cp-scrollbar">
        <h2 className="cp-list-view-title">Temporal Evolution</h2>
        <div className="cp-temporal-stats">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="cp-loading-skeleton" style={{ flex: 1, height: 80, borderRadius: 8 }} />
          ))}
        </div>
        <div className="cp-loading-skeleton" style={{ width: '100%', height: 300, borderRadius: 8, marginTop: 16 }} />
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="cp-temporal-view">
        <h2 className="cp-list-view-title">Temporal Evolution</h2>
        <div className="cp-error-banner" style={{ margin: 16 }}>
          <p>{error.isNetworkError ? 'Could not reach CommonPlace API.' : `Error: ${error.message}`}</p>
          <button type="button" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  /* ── Empty ── */
  if (!data || data.snapshots.length === 0) {
    return (
      <div className="cp-temporal-view">
        <h2 className="cp-list-view-title">Temporal Evolution</h2>
        <div className="cp-empty-state">
          Run the engine to see how your knowledge graph evolves over time.
        </div>
      </div>
    );
  }

  const snapshots = data.snapshots;
  const latest = snapshots[snapshots.length - 1];
  const prev = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;

  return (
    <div className="cp-temporal-view cp-scrollbar">
      <h2 className="cp-list-view-title">Temporal Evolution</h2>

      {/* ── Metric cards ── */}
      <div className="cp-temporal-stats">
        <MetricCard
          label="Objects"
          value={latest.object_count}
          delta={prev ? latest.object_count - prev.object_count : null}
          large
        />
        <MetricCard
          label="Edges"
          value={latest.edge_count}
          delta={prev ? latest.edge_count - prev.edge_count : null}
        />
        <MetricCard
          label="Density"
          value={(latest.density * 100).toFixed(1) + '%'}
          delta={
            prev
              ? ((latest.density - prev.density) * 100).toFixed(1) + '%'
              : null
          }
          deltaRaw={prev ? latest.density - prev.density : 0}
        />
      </div>

      {/* ── Window controls ── */}
      <div className="cp-temporal-controls">
        <label className="cp-temporal-control">
          <span>Window</span>
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(parseInt(e.target.value, 10))}
            className="cp-temporal-select"
          >
            {WINDOW_OPTIONS.map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
        </label>
        <label className="cp-temporal-control">
          <span>Step</span>
          <select
            value={stepDays}
            onChange={(e) => setStepDays(parseInt(e.target.value, 10))}
            className="cp-temporal-select"
          >
            {STEP_OPTIONS.map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
        </label>
      </div>

      {/* ── Chart (Canvas) ── */}
      <GrowthChart snapshots={snapshots} />

      {/* ── Snapshot table ── */}
      <div className="cp-temporal-table-wrap">
        <table className="cp-temporal-table">
          <thead>
            <tr>
              <th>Window</th>
              <th>Objects</th>
              <th>Edges</th>
              <th>Density</th>
              <th>Components</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snap, i) => {
              const p = i > 0 ? snapshots[i - 1] : null;
              const start = new Date(snap.window_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const end = new Date(snap.window_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <tr key={snap.window_start}>
                  <td className="cp-temporal-td-date">{start} – {end}</td>
                  <td>
                    {snap.object_count}
                    <Delta value={p ? snap.object_count - p.object_count : null} />
                  </td>
                  <td>
                    {snap.edge_count}
                    <Delta value={p ? snap.edge_count - p.edge_count : null} />
                  </td>
                  <td>
                    {(snap.density * 100).toFixed(1)}%
                    <Delta value={p ? (snap.density - p.density) * 100 : null} suffix="%" />
                  </td>
                  <td>{snap.component_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Summary ── */}
      {data.summary && (
        <p className="cp-temporal-summary">{data.summary}</p>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────
   Metric card
   ──────────────────────────────────────────────────── */

function MetricCard({
  label,
  value,
  delta,
  deltaRaw,
  large,
}: {
  label: string;
  value: number | string;
  delta: number | string | null;
  deltaRaw?: number;
  large?: boolean;
}) {
  const numDelta = typeof deltaRaw === 'number' ? deltaRaw : typeof delta === 'number' ? delta : 0;
  return (
    <div className={`cp-temporal-card ${large ? 'cp-temporal-card--large' : ''}`}>
      <span className="cp-temporal-card-value">{value}</span>
      <span className="cp-temporal-card-label">{label}</span>
      {delta != null && (
        <span
          className="cp-temporal-card-delta"
          data-positive={numDelta >= 0}
        >
          {numDelta >= 0 ? '+' : ''}{delta}
        </span>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────
   Delta badge (inline in table cells)
   ──────────────────────────────────────────────────── */

function Delta({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  if (value == null || value === 0) return null;
  const formatted = typeof value === 'number' && !suffix
    ? (value > 0 ? '+' + value : String(value))
    : (value > 0 ? '+' : '') + (typeof value === 'number' ? value.toFixed(1) : value) + suffix;
  return (
    <span className="cp-temporal-delta" data-positive={value >= 0}>
      {formatted}
    </span>
  );
}

/* ────────────────────────────────────────────────────
   Growth chart (Canvas, no Chart.js dependency)
   Renders a simple multi-line chart using raw canvas API.
   ──────────────────────────────────────────────────── */

function GrowthChart({ snapshots }: { snapshots: ApiTemporalSnapshot[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || snapshots.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.min(rect.width, 8192);
    const h = Math.min(rect.height, 8192);
    if (w < 1 || h < 1) return;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Margins
    const ml = 50, mr = 20, mt = 20, mb = 40;
    const cw = w - ml - mr;
    const ch = h - mt - mb;

    // Data series
    const objects = snapshots.map((s) => s.object_count);
    const edges = snapshots.map((s) => s.edge_count);
    const densityScaled = snapshots.map((s) => s.density * 100);
    const dates = snapshots.map((s) => new Date(s.window_start));

    const maxCount = Math.max(...objects, ...edges, 1);
    const maxDensity = Math.max(...densityScaled, 1);

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#2A2A30';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = mt + (ch / 4) * i;
      ctx.beginPath();
      ctx.moveTo(ml, y);
      ctx.lineTo(ml + cw, y);
      ctx.stroke();
    }

    // X-axis labels
    ctx.fillStyle = '#7A786F';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.floor(snapshots.length / 6));
    for (let i = 0; i < snapshots.length; i += labelStep) {
      const x = ml + (i / (snapshots.length - 1)) * cw;
      const label = dates[i].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      ctx.fillText(label, x, h - 10);
    }

    // Y-axis labels (left: counts)
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = mt + (ch / 4) * i;
      const val = Math.round(maxCount * (1 - i / 4));
      ctx.fillText(String(val), ml - 8, y + 3);
    }

    // Draw line helper
    function drawLine(series: number[], max: number, color: string, dashed = false) {
      if (!ctx) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dashed ? [4, 4] : []);
      ctx.beginPath();
      for (let i = 0; i < series.length; i++) {
        const x = ml + (i / (series.length - 1)) * cw;
        const y = mt + ch - (series[i] / max) * ch;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Objects (teal)
    drawLine(objects, maxCount, '#2D5F6B');
    // Edges (terracotta)
    drawLine(edges, maxCount, '#B45A2D');
    // Density x100 (purple, dashed, scaled to its own max)
    drawLine(densityScaled, maxDensity, '#8B6FA0', true);

    // Legend
    const legendY = mt + ch + 28;
    const legends = [
      { label: 'Objects', color: '#2D5F6B' },
      { label: 'Edges', color: '#B45A2D' },
      { label: 'Density', color: '#8B6FA0' },
    ];
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    let lx = ml;
    for (const { label, color } of legends) {
      ctx.fillStyle = color;
      ctx.fillRect(lx, legendY - 6, 12, 3);
      ctx.fillStyle = '#7A786F';
      ctx.fillText(label, lx + 16, legendY);
      lx += ctx.measureText(label).width + 32;
    }
  }, [snapshots]);

  if (snapshots.length < 2) {
    return (
      <div className="cp-empty-state" style={{ height: 200 }}>
        Not enough data points for a chart.
      </div>
    );
  }

  return (
    <div className="cp-temporal-chart">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 280 }}
      />
    </div>
  );
}
