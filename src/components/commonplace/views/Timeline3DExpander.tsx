'use client';

/**
 * Timeline3DExpander: Inline 3D expansion component.
 *
 * When a user clicks an object mesh, this component renders a
 * standalone mesh at the object's position that "unfolds" from
 * the compact geometry into a card plane. Drei Html renders the
 * detail content on the unfolded surface.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { TimelineNode3D } from '@/lib/timeline-3d-layout';
import { getObjectTypeIdentity } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Props
   ───────────────────────────────────────────────── */

interface Timeline3DExpanderProps {
  node: TimelineNode3D;
  onClose: () => void;
  onOpenDrawer: (slug: string) => void;
  onNavigateToNode: (nodeId: string) => void;
}

/* ─────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────── */

export default function Timeline3DExpander({
  node,
  onClose,
  onOpenDrawer,
  onNavigateToNode,
}: Timeline3DExpanderProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [visible, setVisible] = useState(false);

  const typeInfo = getObjectTypeIdentity(node.objectType);

  // Animate camera to frame the object on mount
  useEffect(() => {
    const [x, y, z] = node.position;
    const targetCamPos = new THREE.Vector3(x + 1, y + 1, z - 3);

    // Simple lerp animation via requestAnimationFrame
    let frame: number;
    const startPos = camera.position.clone();
    const startTime = performance.now();
    const duration = 600;

    function animate() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = t * (2 - t); // ease out quad

      camera.position.lerpVectors(startPos, targetCamPos, ease);
      camera.lookAt(x, y, z);

      if (t < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        setVisible(true);
      }
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [node.position, camera]);

  // Escape key closes
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if clicking the background, not content
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <group ref={groupRef} position={node.position}>
      {/* Card plane (unfolded surface) */}
      <mesh>
        <planeGeometry args={[3, 2]} />
        <meshStandardMaterial
          color={typeInfo.color}
          roughness={0.9}
          metalness={0}
          transparent
          opacity={visible ? 0.95 : 0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Emissive glow ring */}
      <mesh>
        <ringGeometry args={[1.6, 1.7, 32]} />
        <meshBasicMaterial
          color={typeInfo.color}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* HTML detail panel via Drei */}
      {visible && (
        <Html
          transform
          position={[0, 0, 0.01]}
          distanceFactor={4}
          style={{
            width: 320,
            pointerEvents: 'auto',
          }}
        >
          <div
            className="commonplace-theme"
            style={{
              background: 'var(--cp-surface)',
              border: '1px solid var(--cp-border)',
              borderRadius: 8,
              padding: 16,
              color: 'var(--cp-text)',
              fontFamily: 'var(--cp-font-body, sans-serif)',
              maxHeight: 300,
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: type badge + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: 'var(--cp-font-mono, monospace)',
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: typeInfo.color,
                  border: `1px solid ${typeInfo.color}40`,
                  borderRadius: 3,
                  padding: '1px 5px',
                }}
              >
                {typeInfo.label}
              </span>
              {node.edgeCount > 0 && (
                <span
                  style={{
                    fontFamily: 'var(--cp-font-mono, monospace)',
                    fontSize: 8,
                    color: 'var(--cp-text-faint)',
                    letterSpacing: '0.06em',
                  }}
                >
                  {node.edgeCount} {node.edgeCount === 1 ? 'CONNECTION' : 'CONNECTIONS'}
                </span>
              )}
            </div>

            {/* Title */}
            <h3
              style={{
                fontFamily: 'var(--cp-font-title, serif)',
                fontSize: 16,
                fontWeight: 600,
                margin: '0 0 8px 0',
                lineHeight: 1.3,
              }}
            >
              {node.title}
            </h3>

            {/* Body / summary */}
            {node.summary && (
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--cp-text-muted)',
                  margin: '0 0 10px 0',
                }}
              >
                {node.summary.length > 200
                  ? node.summary.slice(0, 197) + '...'
                  : node.summary}
              </p>
            )}

            {/* Connections list */}
            {node.edges.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontFamily: 'var(--cp-font-mono, monospace)',
                    fontSize: 8,
                    letterSpacing: '0.08em',
                    color: 'var(--cp-text-faint)',
                    marginBottom: 4,
                  }}
                >
                  CONNECTIONS
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {node.edges.slice(0, 6).map((edge) => {
                    const otherId =
                      edge.sourceId === node.id ? edge.targetId : edge.sourceId;
                    return (
                      <button
                        key={edge.id}
                        type="button"
                        onClick={() => onNavigateToNode(otherId)}
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 3,
                          border: '1px solid var(--cp-border)',
                          background: 'transparent',
                          color: 'var(--cp-text-muted)',
                          cursor: 'pointer',
                          fontFamily: 'var(--cp-font-body, sans-serif)',
                        }}
                        title={edge.reason ?? undefined}
                      >
                        {edge.reason
                          ? edge.reason.slice(0, 30)
                          : `Connection ${otherId.slice(0, 8)}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => onOpenDrawer(node.objectSlug)}
                style={{
                  fontSize: 10,
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: '1px solid var(--cp-border)',
                  background: 'var(--cp-surface-raised)',
                  color: 'var(--cp-text)',
                  cursor: 'pointer',
                  fontFamily: 'var(--cp-font-mono, monospace)',
                  letterSpacing: '0.04em',
                }}
              >
                Open in Drawer
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  fontSize: 10,
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: '1px solid var(--cp-border)',
                  background: 'transparent',
                  color: 'var(--cp-text-faint)',
                  cursor: 'pointer',
                  fontFamily: 'var(--cp-font-mono, monospace)',
                  letterSpacing: '0.04em',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
