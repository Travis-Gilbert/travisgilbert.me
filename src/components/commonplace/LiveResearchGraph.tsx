'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as d3 from 'd3';
import type { ComposeLiveResult } from '@/lib/commonplace-api';

interface LiveResearchGraphProps {
  results: ComposeLiveResult[];
  loading: boolean;
  paused: boolean;
  activeSignals: string[];
  enableNli: boolean;
  onTogglePause: () => void;
  onToggleNli: () => void;
  onOpenObject?: (slug: string) => void;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  slug: string;
  title: string;
  explanation: string;
  signal: ComposeLiveResult['signal'];
  score: number;
  type: string;
  radius: number;
}

const SIGNAL_COLORS: Record<string, string> = {
  sbert: '#8B6FA0',
  kge: '#6B7A8A',
  tfidf: '#C49A4A',
  ner: '#2D5F6B',
  supports: '#5A8A5A',
  contradicts: '#B45A2D',
};

const DASHED_SIGNALS = new Set(['ner']);
const NLI_SIGNALS = new Set(['supports', 'contradicts']);

const TYPE_ICON_PATHS: Record<string, string> = {
  note: 'M2 14l1-4L11 2l3 3-8 8zM10 3l3 3',
  source: 'M2 3h4a2 2 0 012 2v9l-1-1H2zM14 3h-4a2 2 0 00-2 2v9l1-1h5z',
  person: 'M8 7a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3 14c0-2.8 2.2-5 5-5s5 2.2 5 5',
  place: 'M8 14s5-4.5 5-8A5 5 0 003 6c0 3.5 5 8 5 8zM8 8a2 2 0 100-4 2 2 0 000 4z',
  organization: 'M3 14V3h10v11M6 5h1M9 5h1M6 8h1M9 8h1M6 11h4v3H6z',
  concept: 'M8 1a4 4 0 00-2 7.5V11h4V8.5A4 4 0 008 1zM6 13h4M6 14.5h4',
  quote: 'M3 6c0-2 1.5-3 3-3M10 6c0-2 1.5-3 3-3M3 6v3a1.5 1.5 0 003 0V6M10 6v3a1.5 1.5 0 003 0V6',
  hunch: 'M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2',
  event: 'M2 5h12M2 3h12v11H2zM5 1v3M11 1v3',
  script: 'M5 4L1 8l4 4M11 4l4 4-4 4M9 2l-2 12',
  task: 'M8 15A7 7 0 108 1a7 7 0 000 14zM5.5 8l2 2 3.5-4',
};

export default function LiveResearchGraph({
  results,
  loading,
  paused,
  activeSignals,
  enableNli,
  onTogglePause,
  onToggleNli,
  onOpenObject,
}: LiveResearchGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 480, height: 360 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedEdge, setSelectedEdge] = useState<{
    x: number;
    y: number;
    node: SimNode;
  } | null>(null);

  const prevScoreRef = useRef<Map<string, number>>(new Map());
  const pulseIdsRef = useRef<Set<string>>(new Set());

  const nodes = useMemo<SimNode[]>(() => {
    return results.slice(0, 14).map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      explanation: item.explanation,
      signal: item.signal,
      score: item.score,
      type: item.type,
      radius: 16,
    }));
  }, [results]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      if (!rect.width || !rect.height) return;
      setSize({
        width: Math.max(320, Math.round(rect.width)),
        height: Math.max(260, Math.round(rect.height)),
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (nodes.length === 0 || paused) return;

    const centerX = size.width / 2;
    const centerY = size.height / 2;
    const seededNodes = nodes.map((node) => {
      const prior = positions[node.id];
      return {
        ...node,
        x: prior?.x ?? centerX,
        y: prior?.y ?? centerY,
      };
    });

    const sim = d3
      .forceSimulation(seededNodes)
      .force('center', d3.forceCenter(centerX, centerY).strength(0.08))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => d.radius + 12))
      .force('radial', d3.forceRadial(120, centerX, centerY).strength(0.4))
      .alphaDecay(0.02)
      .on('tick', () => {
        setPositions((prev) => {
          const next: Record<string, { x: number; y: number }> = { ...prev };
          for (const n of seededNodes) {
            next[n.id] = {
              x: n.x ?? centerX,
              y: n.y ?? centerY,
            };
          }
          return next;
        });
      });

    return () => {
      sim.stop();
    };
  }, [nodes, paused, size.height, size.width]);

  useEffect(() => {
    const nextPulseIds = new Set<string>();
    for (const node of nodes) {
      const prev = prevScoreRef.current.get(node.id);
      if (typeof prev === 'number' && node.score > prev + 0.01) {
        nextPulseIds.add(node.id);
      }
      prevScoreRef.current.set(node.id, node.score);
    }
    pulseIdsRef.current = nextPulseIds;
  }, [nodes]);

  const center = useMemo(
    () => ({ x: size.width / 2, y: size.height / 2 }),
    [size.height, size.width],
  );

  const visibleSignals = useMemo(
    () => Array.from(new Set(activeSignals)).slice(0, 5),
    [activeSignals],
  );

  return (
    <div className="cp-live-graph" ref={containerRef}>
      <div className="cp-live-graph-header">
        <button
          type="button"
          className={`cp-live-indicator${paused ? ' cp-live-indicator--paused' : ''}`}
          onClick={onTogglePause}
          title={paused ? 'Resume live updates' : 'Pause live updates'}
        >
          <span
            className={`cp-live-indicator-dot${loading ? ' cp-live-indicator-dot--loading' : ''}`}
          />
          {paused ? 'PAUSED' : 'LIVE'}
        </button>

        <div className="cp-live-graph-controls">
          {visibleSignals.map((signal) => (
            <span key={signal} className="cp-live-signal-chip">
              {signal}
            </span>
          ))}
          <button
            type="button"
            className={`cp-live-nli-toggle${enableNli ? ' cp-live-nli-toggle--active' : ''}`}
            onClick={onToggleNli}
          >
            NLI {enableNli ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <svg
        className="cp-live-graph-svg"
        viewBox={`0 0 ${size.width} ${size.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {nodes.map((node) => {
          const pos = positions[node.id] ?? center;
          const color = SIGNAL_COLORS[node.signal] ?? '#6B7A8A';
          const isDashed = DASHED_SIGNALS.has(node.signal);
          return (
            <g key={`edge-${node.id}`}>
              <line
                x1={center.x}
                y1={center.y}
                x2={pos.x}
                y2={pos.y}
                stroke={color}
                strokeWidth={0.5 + node.score * 2.5}
                strokeDasharray={isDashed ? '5 4' : undefined}
                strokeOpacity={0.62}
              />
              <line
                x1={center.x}
                y1={center.y}
                x2={pos.x}
                y2={pos.y}
                stroke="transparent"
                strokeWidth={16}
                onClick={(event) => {
                  const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  const midX = (center.x + pos.x) / 2;
                  const midY = (center.y + pos.y) / 2;
                  setSelectedEdge({
                    x: midX + 10,
                    y: midY - 10,
                    node,
                  });
                  if (rect.width === 0) {
                    setSelectedEdge(null);
                  }
                }}
              />
            </g>
          );
        })}

        <AnimatePresence>
          {nodes.map((node) => {
            const pos = positions[node.id] ?? center;
            const color = SIGNAL_COLORS[node.signal] ?? '#6B7A8A';
            const icon = TYPE_ICON_PATHS[node.type] ?? TYPE_ICON_PATHS.note;
            const isPulse = pulseIdsRef.current.has(node.id);

            return (
              <motion.g
                key={node.id}
                initial={{ opacity: 0, x: center.x, y: center.y, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  x: pos.x,
                  y: pos.y,
                  scale: isPulse ? 1.12 : 1,
                }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className={isPulse ? 'cp-live-node-pulse' : undefined}
                onClick={() => onOpenObject?.(node.slug)}
              >
                <circle
                  r={node.radius}
                  fill={color}
                  fillOpacity={NLI_SIGNALS.has(node.signal) ? 0.24 : 0.2}
                  stroke={color}
                  strokeWidth={1.3}
                />
                <path
                  d={icon}
                  transform="translate(-8,-8)"
                  fill="none"
                  stroke="#F7F2EA"
                  strokeWidth={1.35}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text
                  y={node.radius + 13}
                  textAnchor="middle"
                  className="cp-live-node-score"
                >
                  {Math.round(node.score * 100)}%
                </text>
              </motion.g>
            );
          })}
        </AnimatePresence>
      </svg>

      {selectedEdge && (
        <button
          type="button"
          className="cp-live-edge-tooltip"
          style={{ left: selectedEdge.x, top: selectedEdge.y }}
          onClick={() => setSelectedEdge(null)}
        >
          <div className="cp-live-edge-signal">
            {selectedEdge.node.signal.toUpperCase()}
          </div>
          <div className="cp-live-edge-title">{selectedEdge.node.title}</div>
          <div className="cp-live-edge-explanation">{selectedEdge.node.explanation}</div>
          <div className="cp-live-edge-score">
            Score {Math.round(selectedEdge.node.score * 100)}%
          </div>
        </button>
      )}
    </div>
  );
}
