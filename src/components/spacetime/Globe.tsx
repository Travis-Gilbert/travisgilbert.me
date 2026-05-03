'use client';

/**
 * Spacetime Atlas: sketched orthographic globe.
 *
 * Canvas-rendered earth (water gradient → graticule → land fill →
 * cross-hatch → noise stipple → coastline → day/night terminator) plus
 * SVG overlays for whirl/eddy rings, dotted geodesic trace lines,
 * cross-topic linkage arcs, and event dots.
 *
 * Trace lines are curvature-aware: each consecutive trace pair is sampled
 * along the great circle via d3.geoInterpolate, projected through the
 * orthographic camera, broken into runs of consecutive front-of-sphere
 * points, and drawn as dotted SVG paths with a slow staggered draw-in.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { SpacetimeTopic } from '@/lib/spacetime/types';
import DottedSegment from './DottedSegment';
import HoverNote from './HoverNote';

export interface HoveredId {
  topic: 'A' | 'B';
  id: number;
}

interface GlobeProps {
  size?: number;
  topicA: SpacetimeTopic | null;
  topicAColor: string;
  topicB: SpacetimeTopic | null;
  topicBColor: string;
  /** Current scrub year: events with year <= yearMax are "active". */
  yearMax: number;
  hoveredId: HoveredId | null;
  onHover: (h: HoveredId | null) => void;
  paused?: boolean;
  spinDirection?: 1 | -1;
  visibleWindows?: {
    first: { startYear: number; endYear: number };
    second: { startYear: number; endYear: number };
  } | null;
  prehistory?: boolean;
}

interface ProjectedEvent {
  id: number;
  city: string;
  lat: number;
  lon: number;
  year: number;
  papers: number;
  note: string;
  accent: 'terracotta' | 'teal';
  x: number | null;
  y: number | null;
  visible: boolean;
}

interface SegmentRun {
  d: string;
  startId: number;
  endId: number;
  topic: 'A' | 'B';
  color: string;
  subSegment: number;
}

interface LinkageRun {
  d: string;
  key: string;
  sameCity: boolean;
  closeTime: boolean;
}

const ROTATION_TILT = -12; // latitude tilt of the camera
const ROTATION_SPEED = 6;  // degrees per second
const TRACE_DUR = 1.6;     // seconds per segment to fully draw in
const SEGMENT_GAP = 0.45;  // stagger between segments

const LAND_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json';

export default function Globe({
  size = 400,
  topicA,
  topicAColor,
  topicB,
  topicBColor,
  yearMax,
  hoveredId,
  onHover,
  paused = false,
  spinDirection = 1,
  visibleWindows = null,
  prehistory = false,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(-30);
  const [eddyT, setEddyT] = useState(0);
  const [drawT, setDrawT] = useState(0);
  const [land, setLand] = useState<Feature<Geometry> | null>(null);

  const projection = useMemo(() => {
    const r = size / 2 - 6;
    return d3.geoOrthographic()
      .scale(r)
      .translate([size / 2, size / 2])
      .clipAngle(90);
  }, [size]);

  // Apply current rotation to the projection. Done outside useMemo so it
  // updates every render: the projection itself is stable.
  projection.rotate([rotation, ROTATION_TILT, 0]);

  // ─── Load world atlas once ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch(LAND_ATLAS_URL)
      .then(r => r.json())
      .then((world: { objects: { land: { type: string } } }) => {
        if (cancelled) return;
        // topojson.feature returns FeatureCollection or single Feature
        // depending on the object kind; world-atlas's land-110m is a
        // single `MultiPolygon` topology object.
        const feature = topojson.feature(
          world as unknown as Parameters<typeof topojson.feature>[0],
          (world as { objects: { land: object } }).objects.land as Parameters<typeof topojson.feature>[1],
        ) as Feature<Geometry> | FeatureCollection<Geometry>;
        const single = (feature as FeatureCollection).features
          ? ((feature as FeatureCollection).features[0] as Feature<Geometry>)
          : (feature as Feature<Geometry>);
        setLand(single);
      })
      .catch(err => {
        // Don't throw: the page still works without coastlines.
        console.warn('[spacetime] world atlas load failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Animation loop ─────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!paused) {
        setRotation(r => r + dt * ROTATION_SPEED * spinDirection);
        setEddyT(t => t + dt);
      }
      // drawT advances even when paused so trace draw-in completes if
      // the user hits pause mid-stroke.
      setDrawT(t => t + dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, spinDirection]);

  // ─── Earth canvas painter ──────────────────────────────────────
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.min(size, 8192));
    const h = Math.max(1, Math.min(size, 8192));
    cvs.width = w * dpr;
    cvs.height = h * dpr;
    cvs.style.width = `${w}px`;
    cvs.style.height = `${h}px`;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2 - 6;

    // Water radial gradient
    const waterGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx, cy, r);
    if (prehistory) {
      waterGrad.addColorStop(0, '#F2DDB8');
      waterGrad.addColorStop(0.7, '#D9BD8D');
      waterGrad.addColorStop(1, '#B89968');
    } else {
      waterGrad.addColorStop(0, '#FBF0E2');
      waterGrad.addColorStop(0.65, '#EBD8C0');
      waterGrad.addColorStop(1, '#C8B294');
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = waterGrad;
    ctx.fill();

    // Graticule
    const path = d3.geoPath(projection, ctx);
    ctx.beginPath();
    path(d3.geoGraticule10());
    ctx.strokeStyle = prehistory ? 'rgba(58, 54, 50, 0.10)' : 'rgba(45, 95, 107, 0.12)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    if (land) {
      // Land fill
      ctx.beginPath();
      path(land);
      ctx.fillStyle = prehistory ? '#B6986B' : '#D4B896';
      ctx.fill();

      // Hatched cross-hatch: clip to land
      ctx.save();
      ctx.beginPath();
      path(land);
      ctx.clip();

      ctx.strokeStyle = prehistory ? 'rgba(58, 40, 24, 0.28)' : 'rgba(74, 50, 30, 0.30)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      const hatch = 4;
      for (let d = -w; d < w * 2; d += hatch) {
        ctx.moveTo(d, 0);
        ctx.lineTo(d + w, h);
      }
      ctx.stroke();

      ctx.strokeStyle = prehistory ? 'rgba(58, 40, 24, 0.16)' : 'rgba(74, 50, 30, 0.18)';
      ctx.beginPath();
      for (let d = -w; d < w * 2; d += hatch * 1.7) {
        ctx.moveTo(d, 0);
        ctx.lineTo(d - w, h);
      }
      ctx.stroke();

      // Noise stipple: deterministic from rotation seed
      ctx.fillStyle = prehistory ? 'rgba(42, 28, 16, 0.5)' : 'rgba(58, 36, 18, 0.55)';
      const seed = Math.floor(rotation) % 360;
      for (let i = 0; i < 380; i++) {
        const a = (seed + i * 137.5) * Math.PI / 180;
        const rd = Math.sqrt((i * 9301 + 49297) % 233280 / 233280) * r * 0.95;
        const px = cx + Math.cos(a) * rd;
        const py = cy + Math.sin(a) * rd;
        ctx.beginPath();
        ctx.arc(px, py, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Coastline stroke
      ctx.beginPath();
      path(land);
      ctx.strokeStyle = prehistory ? 'rgba(28, 18, 8, 0.85)' : 'rgba(42, 24, 8, 0.85)';
      ctx.lineWidth = 0.9;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Soft offset shadow
      ctx.save();
      ctx.translate(0.6, 0.4);
      ctx.beginPath();
      path(land);
      ctx.strokeStyle = prehistory ? 'rgba(28, 18, 8, 0.30)' : 'rgba(42, 24, 8, 0.30)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
    }

    // Day/night terminator: multiplied gradient
    {
      const angle = (rotation * 1.3) * Math.PI / 180;
      const grad = ctx.createLinearGradient(
        cx + Math.cos(angle) * r, cy + Math.sin(angle) * r,
        cx - Math.cos(angle) * r, cy - Math.sin(angle) * r,
      );
      grad.addColorStop(0, 'rgba(28, 28, 32, 0)');
      grad.addColorStop(0.45, 'rgba(28, 28, 32, 0)');
      grad.addColorStop(0.62, 'rgba(28, 28, 32, 0.18)');
      grad.addColorStop(1, 'rgba(28, 28, 32, 0.42)');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.globalCompositeOperation = 'multiply';
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    // Final globe outline
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = prehistory ? 'rgba(28, 18, 8, 0.7)' : 'rgba(42, 24, 8, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }, [land, rotation, projection, size, prehistory]);

  // ─── Project events to screen ──────────────────────────────────
  function projectTopic(t: SpacetimeTopic | null): ProjectedEvent[] {
    if (!t) return [];
    const rot = d3.geoRotation([rotation, ROTATION_TILT, 0]);
    return t.events.map(ev => {
      const pt = projection([ev.lon, ev.lat]);
      const r0 = rot([ev.lon, ev.lat]);
      const visible = r0[0] > -90 && r0[0] < 90;
      return {
        ...ev,
        x: pt ? pt[0] : null,
        y: pt ? pt[1] : null,
        visible,
      };
    });
  }
  const evA = useMemo(
    () => projectTopic(topicA),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topicA, rotation, projection],
  );
  const evB = useMemo(
    () => projectTopic(topicB),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topicB, rotation, projection],
  );

  // ─── Geodesic trace builder ────────────────────────────────────
  function buildGeodesicSegments(t: SpacetimeTopic | null, label: 'A' | 'B', color: string): SegmentRun[] {
    if (!t) return [];
    const segs: SegmentRun[] = [];
    const eventsById: Record<number, typeof t.events[number]> = {};
    for (const e of t.events) eventsById[e.id] = e;
    const past = (id: number) => {
      const e = eventsById[id];
      return !!e && e.year <= yearMax;
    };
    const orderedIds = t.trace.filter(past);
    for (let i = 0; i < orderedIds.length - 1; i++) {
      const A = eventsById[orderedIds[i]];
      const B = eventsById[orderedIds[i + 1]];
      if (!A || !B) continue;

      const samples = 64;
      const interp = d3.geoInterpolate([A.lon, A.lat], [B.lon, B.lat]);
      const rot = d3.geoRotation([rotation, ROTATION_TILT, 0]);
      const pts: { x: number | null; y: number | null; onFront: boolean }[] = [];
      for (let s = 0; s <= samples; s++) {
        const ll = interp(s / samples);
        const screen = projection(ll);
        const rotated = rot(ll);
        const onFront = rotated[0] > -90 && rotated[0] < 90;
        pts.push({
          x: screen ? screen[0] : null,
          y: screen ? screen[1] : null,
          onFront,
        });
      }
      // Break into runs of consecutive on-front points.
      let run: { x: number; y: number }[] = [];
      const runs: { x: number; y: number }[][] = [];
      pts.forEach(p => {
        if (p.onFront && p.x != null && p.y != null) {
          run.push({ x: p.x, y: p.y });
        } else {
          if (run.length > 1) runs.push(run);
          run = [];
        }
      });
      if (run.length > 1) runs.push(run);

      runs.forEach((r, k) => {
        segs.push({
          d: r.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '),
          startId: A.id,
          endId: B.id,
          topic: label,
          color,
          subSegment: k,
        });
      });
    }
    return segs;
  }
  const segsA = useMemo(
    () => buildGeodesicSegments(topicA, 'A', topicAColor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topicA, topicAColor, projection, rotation, yearMax],
  );
  const segsB = useMemo(
    () => buildGeodesicSegments(topicB, 'B', topicBColor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topicB, topicBColor, projection, rotation, yearMax],
  );

  // ─── Cross-topic linkage arcs ──────────────────────────────────
  const linkages = useMemo<LinkageRun[]>(() => {
    if (!topicA || !topicB) return [];
    const out: LinkageRun[] = [];
    const rot = d3.geoRotation([rotation, ROTATION_TILT, 0]);
    topicA.events.forEach(a => {
      if (a.year > yearMax) return;
      topicB.events.forEach(b => {
        if (b.year > yearMax) return;
        const sameCity = a.city === b.city;
        const closeTime = Math.abs(a.year - b.year) <= 5;
        if (!sameCity && !closeTime) return;

        const samples = 32;
        const interp = d3.geoInterpolate([a.lon, a.lat], [b.lon, b.lat]);
        const pts: { x: number | null; y: number | null; onFront: boolean }[] = [];
        for (let s = 0; s <= samples; s++) {
          const ll = interp(s / samples);
          const screen = projection(ll);
          const rotated = rot(ll);
          const onFront = rotated[0] > -90 && rotated[0] < 90;
          pts.push({
            x: screen ? screen[0] : null,
            y: screen ? screen[1] : null,
            onFront,
          });
        }
        let run: { x: number; y: number }[] = [];
        const runs: { x: number; y: number }[][] = [];
        pts.forEach(p => {
          if (p.onFront && p.x != null && p.y != null) {
            run.push({ x: p.x, y: p.y });
          } else {
            if (run.length > 1) runs.push(run);
            run = [];
          }
        });
        if (run.length > 1) runs.push(run);
        runs.forEach((r, k) => {
          out.push({
            d: r.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '),
            key: `${a.id}-${b.id}-${k}`,
            sameCity,
            closeTime,
          });
        });
      });
    });
    return out;
  }, [topicA, topicB, projection, rotation, yearMax]);

  // ─── Whirl/eddy rings ──────────────────────────────────────────
  const eddyRings = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => {
      const phase = (eddyT * 0.18 + i * 0.25) % 1;
      const radius = (size / 2 - 4) + phase * 38;
      return { r: radius, o: (1 - phase) * 0.32, key: i };
    });
  }, [eddyT, size]);

  // ─── Hovered point lookup ──────────────────────────────────────
  const hoveredEvent = useMemo(() => {
    if (!hoveredId) return null;
    const list = hoveredId.topic === 'A' ? evA : evB;
    return list.find(p => p.id === hoveredId.id && p.visible) ?? null;
  }, [hoveredId, evA, evB]);
  const hoveredColor = hoveredEvent
    ? (hoveredId!.topic === 'A' ? topicAColor : topicBColor)
    : null;

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      {/* whirl rings + skewed eddies */}
      <svg
        viewBox={`0 0 ${size + 80} ${size + 80}`}
        style={{
          position: 'absolute',
          left: -40,
          top: -40,
          width: size + 80,
          height: size + 80,
          pointerEvents: 'none',
        }}
      >
        {eddyRings.map(ring => (
          <circle
            key={ring.key}
            cx={(size + 80) / 2}
            cy={(size + 80) / 2}
            r={ring.r}
            fill="none"
            stroke="#B45A2D"
            strokeWidth="0.8"
            strokeDasharray="2 6"
            opacity={ring.o * 0.7}
            style={{
              transform: `rotate(${eddyT * (10 + ring.key * 7)}deg)`,
              transformOrigin: 'center',
            }}
          />
        ))}
        {[0, 1, 2].map(i => (
          <ellipse
            key={`e-${i}`}
            cx={(size + 80) / 2}
            cy={(size + 80) / 2}
            rx={size / 2 + 14 + i * 6}
            ry={size / 2 + 4 + i * 4}
            fill="none"
            stroke={i === 1 ? '#2D5F6B' : '#B45A2D'}
            strokeWidth="0.5"
            opacity={0.25 - i * 0.06}
            style={{
              transformOrigin: 'center',
              transform: `rotate(${-eddyT * (8 + i * 3)}deg) skewX(${Math.sin(eddyT * 0.4 + i) * 4}deg)`,
            }}
          />
        ))}
      </svg>

      {/* canvas globe */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          boxShadow: '0 18px 48px rgba(42, 36, 32, 0.28), 0 0 60px rgba(196, 154, 74, 0.12)',
        }}
      />

      {/* dotted geodesic traces + linkage arcs */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{
          position: 'absolute',
          inset: 0,
          width: size,
          height: size,
          pointerEvents: 'none',
        }}
      >
        {linkages.map(lk => (
          <path
            key={lk.key}
            d={lk.d}
            fill="none"
            stroke={lk.sameCity ? '#7A4A8A' : '#9A7A6A'}
            strokeWidth="0.8"
            strokeDasharray="1 4"
            strokeLinecap="round"
            opacity="0.55"
          />
        ))}
        {segsA.map((seg, i) => (
          <DottedSegment
            key={`A-${seg.startId}-${seg.endId}-${seg.subSegment}`}
            d={seg.d}
            color={seg.color}
            drawT={drawT}
            delay={i * SEGMENT_GAP}
            dur={TRACE_DUR}
          />
        ))}
        {segsB.map((seg, i) => (
          <DottedSegment
            key={`B-${seg.startId}-${seg.endId}-${seg.subSegment}`}
            d={seg.d}
            color={seg.color}
            drawT={drawT}
            delay={(segsA.length + i) * SEGMENT_GAP}
            dur={TRACE_DUR}
          />
        ))}
      </svg>

      {/* event dots */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: 'absolute', inset: 0, width: size, height: size }}
      >
        {[
          ...evA.map(e => ({ e, t: 'A' as const })),
          ...evB.map(e => ({ e, t: 'B' as const })),
        ]
          .filter(({ e }) => {
            if (!e.visible || e.x == null || e.year > yearMax) return false;
            if (!visibleWindows) return true;
            return (
              (e.year >= visibleWindows.first.startYear && e.year <= visibleWindows.first.endYear) ||
              (e.year >= visibleWindows.second.startYear && e.year <= visibleWindows.second.endYear)
            );
          })
          .map(({ e, t }) => {
            const isHov = hoveredId && hoveredId.topic === t && hoveredId.id === e.id;
            const fill = t === 'A' ? topicAColor : topicBColor;
            const radius = 4 + Math.min(8, Math.log10(e.papers + 1) * 2.2);
            const inSecondWindow = visibleWindows
              ? e.year >= visibleWindows.second.startYear && e.year <= visibleWindows.second.endYear
              : false;
            return (
              <g
                key={`${t}-${e.id}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => onHover({ topic: t, id: e.id })}
                onMouseLeave={() => onHover(null)}
              >
                <circle cx={e.x!} cy={e.y!} r={radius + 6} fill={fill} opacity={isHov ? 0.18 : 0.10}>
                  <animate attributeName="r" values={`${radius + 4};${radius + 10};${radius + 4}`} dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.18;0.04;0.18" dur="3s" repeatCount="indefinite" />
                </circle>
                <circle
                  cx={e.x!}
                  cy={e.y!}
                  r={radius}
                  fill={fill}
                  stroke={inSecondWindow ? '#1F4148' : '#FBF0E2'}
                  strokeWidth={inSecondWindow ? 2 : 1}
                />
                {isHov && (
                  <circle cx={e.x!} cy={e.y!} r={radius + 3} fill="none" stroke={fill} strokeWidth="1.2" />
                )}
              </g>
            );
          })}
      </svg>

      {/* tooltip */}
      {hoveredEvent && hoveredColor && hoveredEvent.x != null && hoveredEvent.y != null && (
        <HoverNote
          event={hoveredEvent}
          x={hoveredEvent.x}
          y={hoveredEvent.y}
          color={hoveredColor}
          stageSize={size}
          prehistory={prehistory}
        />
      )}
    </div>
  );
}
