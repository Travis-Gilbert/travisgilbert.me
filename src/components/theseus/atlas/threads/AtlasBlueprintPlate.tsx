'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, type CSSProperties } from 'react';
import type { Group } from 'three';

const CANVAS_CAMERA = { position: [0, 0, 6] as [number, number, number], fov: 45 };
const CANVAS_GL = { antialias: true, alpha: true };
const LIGHT_POSITION: [number, number, number] = [3, 4, 5];

type AnnotationPosition = 'top-left' | 'bottom-left' | 'center' | 'bottom-right';

const ANNOTATION_ANCHORS: Record<AnnotationPosition, CSSProperties> = {
  'top-left': { top: 16, left: 22 },
  'bottom-left': { bottom: 16, left: 22 },
  center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  'bottom-right': { bottom: 10, right: 30 },
};

const CORNER_BRACKETS: Array<{ key: string; style: CSSProperties }> = [
  { key: 'tl', style: { top: 10, left: 10, borderRight: 'none', borderBottom: 'none' } },
  { key: 'tr', style: { top: 10, right: 10, borderLeft: 'none', borderBottom: 'none' } },
  { key: 'bl', style: { bottom: 10, left: 10, borderRight: 'none', borderTop: 'none' } },
  { key: 'br', style: { bottom: 10, right: 10, borderLeft: 'none', borderTop: 'none' } },
];

const DEFAULT_ANNOTATIONS: Array<{ position: AnnotationPosition; label: string; hot?: boolean; muted?: boolean }> = [
  { position: 'top-left', label: 'ROW 0 · Writer heads' },
  { position: 'bottom-left', label: 'ROW 1 · Reader heads' },
  { position: 'center', label: 'Bound pair · stable ≥ 120 steps', hot: true },
  { position: 'bottom-right', label: 'R3F · three 0.183', muted: true },
];

export interface BlueprintNode {
  id: string;
  position: [number, number, number];
  /** Whether this node is part of a "bound pair" highlight. */
  paired?: boolean;
}

export interface AtlasBlueprintPlateProps {
  /** Figure number, e.g. "Fig. 14". */
  figure: string;
  /** Technical drawing title, e.g. "Attention-head pairing · epochs 13-15". */
  title: string;
  /** Caption under the plate (rendered by the caller if preferred). */
  caption?: string;
  /** Nodes plotted inside the plate. If omitted, the plate renders a
   *  waiting state — no fake scatter. */
  nodes?: BlueprintNode[];
  /** Explicit height; defaults to 320. */
  height?: number;
  /** Quiet the useFrame tick (respect prefers-reduced-motion). */
  reducedMotion?: boolean;
}

/**
 * Atlas blueprint plate — a paper-taped technical drawing rendered in
 * React Three Fiber. Matches the Atlas reference (Fig. 14 "Attention-head
 * pairing") structurally: deckle edge via CSS, dark blue ground, grid
 * overlay, annotation chips, nodes in two classes (writer/reader or
 * paired/unpaired).
 *
 * Runs off the main app R3F stack (three + @react-three/fiber +
 * @react-three/drei). When no node payload is supplied the canvas
 * renders only the chrome so we don't fake content — the plate appears
 * only when a response actually brings artifact data.
 */
export default function AtlasBlueprintPlate({
  figure,
  title,
  caption,
  nodes,
  height = 320,
  reducedMotion = false,
}: AtlasBlueprintPlateProps) {
  const plateStyle: CSSProperties = {
    position: 'relative',
    margin: '28px 0',
    background: 'var(--paper-3)',
    borderRadius: 2,
    boxShadow:
      '0 1px 0 rgba(255, 252, 242, 0.6) inset, 0 2px 4px -2px rgba(30, 22, 18, 0.12), 0 18px 36px -24px rgba(30, 22, 18, 0.28)',
  };

  return (
    <figure style={plateStyle}>
      <figcaption
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'baseline',
          gap: 14,
          padding: '12px 16px 10px',
          font: '500 10px/1 var(--font-mono)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--paper-ink-3)',
          borderBottom: '1px dashed var(--paper-rule)',
        }}
      >
        <span style={{ color: 'var(--paper-pencil)', fontWeight: 600 }}>{figure}</span>
        <span
          style={{
            font: '500 14px/1.2 var(--font-display)',
            color: 'var(--paper-ink)',
            textTransform: 'none',
            letterSpacing: 0,
          }}
        >
          {title}
        </span>
        <span style={{ opacity: 0.7 }}>Blueprint · R3F · live</span>
      </figcaption>

      <div
        style={{
          position: 'relative',
          margin: 8,
          border: '1px solid rgba(205, 227, 244, 0.22)',
          background:
            'radial-gradient(120% 80% at 50% 0%, #24496c 0%, #1d3c5b 65%, #15304a 100%)',
          overflow: 'hidden',
          height,
        }}
      >
        {/* Grid overlay */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(to right, #7faac8 1px, transparent 1px), linear-gradient(to bottom, #7faac8 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            opacity: 0.4,
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(to right, #507a9a 1px, transparent 1px), linear-gradient(to bottom, #507a9a 1px, transparent 1px)',
            backgroundSize: '16px 16px',
            opacity: 0.28,
            pointerEvents: 'none',
          }}
        />

        {CORNER_BRACKETS.map((b) => (
          <span
            key={b.key}
            aria-hidden
            style={{
              position: 'absolute',
              width: 14,
              height: 14,
              border: '1px solid #cde3f4',
              opacity: 0.8,
              ...b.style,
            }}
          />
        ))}

        {DEFAULT_ANNOTATIONS.map((a) => (
          <AnnotationChip
            key={a.position}
            position={a.position}
            label={a.label}
            hot={a.hot}
            muted={a.muted}
          />
        ))}

        <Canvas
          camera={CANVAS_CAMERA}
          style={{ position: 'absolute', inset: 0, zIndex: 2 }}
          gl={CANVAS_GL}
        >
          <ambientLight intensity={0.65} />
          <directionalLight position={LIGHT_POSITION} intensity={0.8} />
          {nodes && nodes.length > 0 && (
            <NodeField nodes={nodes} reducedMotion={reducedMotion} />
          )}
        </Canvas>

        {(!nodes || nodes.length === 0) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: '500 10px/1 var(--font-mono)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'rgba(234, 242, 250, 0.55)',
              zIndex: 3,
              pointerEvents: 'none',
            }}
          >
            Awaiting artifact payload
          </div>
        )}
      </div>

      {caption && (
        <div
          style={{
            padding: '12px 18px 16px',
            font: '400 14px/1.55 var(--font-body)',
            color: 'var(--paper-ink-2)',
            borderTop: '1px dashed var(--paper-rule)',
          }}
        >
          {caption}
        </div>
      )}
    </figure>
  );
}

function AnnotationChip({
  position,
  label,
  hot,
  muted,
}: {
  position: AnnotationPosition;
  label: string;
  hot?: boolean;
  muted?: boolean;
}) {
  const style: CSSProperties = {
    position: 'absolute',
    zIndex: 3,
    font: '500 10px/1 var(--font-mono)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: muted ? 'rgba(168, 192, 214, 0.9)' : '#eaf2fa',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 9px',
    background: 'rgba(29, 60, 91, 0.82)',
    border: '1px solid #7faac8',
    pointerEvents: 'none',
    ...ANNOTATION_ANCHORS[position],
  };

  return (
    <span style={style}>
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: hot ? '#ffb070' : '#cde3f4',
          boxShadow: hot ? '0 0 8px 2px rgba(255, 176, 112, 0.6)' : undefined,
        }}
      />
      {label}
    </span>
  );
}

function NodeField({ nodes, reducedMotion }: { nodes: BlueprintNode[]; reducedMotion?: boolean }) {
  const groupRef = useRef<Group | null>(null);
  useFrame((_, delta) => {
    if (reducedMotion) return;
    const g = groupRef.current;
    if (!g) return;
    g.rotation.y += delta * 0.12;
  });

  return (
    <group ref={groupRef}>
      {nodes.map((n) => (
        <mesh key={n.id} position={n.position}>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial
            color={n.paired ? '#ffb070' : '#e8e8e8'}
            emissive={n.paired ? '#ff8040' : '#ffffff'}
            emissiveIntensity={n.paired ? 0.35 : 0.1}
            metalness={0.1}
            roughness={0.55}
          />
        </mesh>
      ))}
    </group>
  );
}
