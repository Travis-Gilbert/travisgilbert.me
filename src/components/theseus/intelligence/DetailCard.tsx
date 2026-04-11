'use client';

import { useEffect, useRef } from 'react';
import type { Algorithm } from './algorithmRegions';
import { COMMUNITY_COLORS } from './algorithmRegions';

interface DetailCardProps {
  algorithm: Algorithm;
  onClose: () => void;
}

const TEAL = '#4A8A96';
const PAPER = '#F4F3F0';
const PAPER_DIM = 'rgba(244,243,240,0.55)';

const supplementalBoxStyle: React.CSSProperties = {
  background: 'rgba(45,95,107,0.08)',
  border: '1px solid rgba(45,95,107,0.12)',
  borderRadius: 10,
  padding: '12px 16px',
  fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
  fontSize: 13,
  lineHeight: 1.6,
  color: PAPER_DIM,
};

const FITNESS_TRAITS = [
  'Source Independence',
  'Temporal Spread',
  'Author Diversity',
  'Domain Breadth',
  'Methodological Variety',
];

function SupplementalContent({ id }: { id: string }) {
  if (id === 'anti-conspiracy') {
    return (
      <div style={supplementalBoxStyle}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px 16px',
            marginBottom: 8,
          }}
        >
          {FITNESS_TRAITS.map((trait) => (
            <div
              key={trait}
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                color: 'rgba(244,243,240,0.4)',
              }}
            >
              {trait}
            </div>
          ))}
        </div>
        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            color: '#C4503C',
          }}
        >
          Red = single source
        </div>
      </div>
    );
  }

  if (id === 'ppr') {
    return (
      <div style={supplementalBoxStyle}>
        The expanding ring shows the random walk spreading from the cursor.
        Nodes brighten as the walk reaches them, and the sustained glow near
        the center marks the nodes with the highest visit frequency. Move
        your cursor to explore importance from different starting points.
      </div>
    );
  }

  if (id === 'tms') {
    return (
      <div style={supplementalBoxStyle}>
        Your cursor marks the retraction point. The TMS withdraws
        justification from nearby nodes, then traces the dependency chain
        outward. Deeper fades indicate stronger dependency. Move your
        cursor to test different parts of the graph for fragility.
      </div>
    );
  }

  if (id === 'community') {
    return (
      <div style={supplementalBoxStyle}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {COMMUNITY_COLORS.map((color, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: color,
                }}
              />
              <span
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 10,
                  color: 'rgba(244,243,240,0.4)',
                }}
              >
                C{i}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            color: '#C49A4A',
          }}
        >
          Amber edges = cross-community bridges
        </div>
      </div>
    );
  }

  if (id === 'belief') {
    return (
      <div style={supplementalBoxStyle}>
        Particles traveling along edges represent confidence messages.
        Each node updates its belief based on incoming messages until
        the network stabilizes. Brighter nodes carry higher confidence.
        Color encodes certainty: teal (high), amber (uncertain), red (low).
      </div>
    );
  }

  return null;
}

export default function DetailCard({ algorithm, onClose }: DetailCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Entry animation
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(-50%) translateX(20px)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
      el.style.opacity = '1';
      el.style.transform = 'translateY(-50%) translateX(0)';
    });
  }, [algorithm.id]);

  return (
    <div
      ref={cardRef}
      style={{
        position: 'absolute',
        top: '50%',
        right: 24,
        transform: 'translateY(-50%)',
        width: 340,
        maxWidth: 'calc(100% - 48px)',
        background: 'rgba(15,16,18,0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(74,138,150,0.2)',
        borderRadius: 14,
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        padding: '20px 24px',
        zIndex: 10,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 12,
          right: 16,
          background: 'transparent',
          border: 'none',
          color: 'rgba(244,243,240,0.4)',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 14,
          cursor: 'pointer',
          padding: '4px 8px',
          lineHeight: 1,
        }}
      >
        x
      </button>

      {/* Category label */}
      <div
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10,
          color: TEAL,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: 6,
        }}
      >
        GRAPH ALGORITHM
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: 'Vollkorn, Georgia, serif',
          fontSize: 22,
          color: PAPER,
          marginBottom: 8,
        }}
      >
        {algorithm.label}
      </div>

      {/* Description */}
      <div
        style={{
          fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
          fontSize: 14,
          color: PAPER_DIM,
          lineHeight: 1.7,
          marginBottom: 16,
        }}
      >
        {algorithm.description}
      </div>

      {/* Supplemental content */}
      <SupplementalContent id={algorithm.id} />
    </div>
  );
}
