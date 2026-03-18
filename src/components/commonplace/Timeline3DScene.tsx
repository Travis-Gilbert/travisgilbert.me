'use client';

/**
 * Timeline3DScene: The main R3F Canvas scene for the 3D timeline.
 *
 * Contains:
 *   Canvas with camera, fog, lighting
 *   TimelineCorridor (instanced objects along Z)
 *   TimelineEdges (connection arcs)
 *   Floating date labels (Drei Text)
 *   ExpandedObject (inline expansion with Drei Html)
 *   GSAP scroll integration (master timeline, scrubbed by scroll)
 *   Sobel post-processing (NPR edges)
 */

import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { MockNode } from '@/lib/commonplace';
import {
  computeTimeline3DLayout,
  type TimelineNode3D,
  type Timeline3DLayout,
} from '@/lib/timeline-3d-layout';
import Timeline3DObjects from './Timeline3DObjects';
import Timeline3DEdges from './Timeline3DEdges';
import Timeline3DExpander from './Timeline3DExpander';
import type { ThreeEvent } from '@react-three/fiber';

/* ─────────────────────────────────────────────────
   Ground plane with dot-grid pattern
   ───────────────────────────────────────────────── */

function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={false}>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial
        color="#F7F2EA"
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

/* ─────────────────────────────────────────────────
   Floating date labels
   ───────────────────────────────────────────────── */

function DateLabels({ markers }: { markers: Timeline3DLayout['dateMarkers'] }) {
  return (
    <group>
      {markers.map((marker) => (
        <Text
          key={marker.dateKey}
          position={marker.position}
          fontSize={0.5}
          color="#9A8E82"
          anchorX="left"
          anchorY="bottom"
          letterSpacing={0.08}
          material-transparent
          material-opacity={0.6}
          material-depthWrite={false}
        >
          {marker.label}
        </Text>
      ))}
    </group>
  );
}

/* ─────────────────────────────────────────────────
   GSAP Camera Controller
   ───────────────────────────────────────────────── */

interface CameraControllerProps {
  layout: Timeline3DLayout;
  scrollProgress: number;
  paused: boolean;
}

function CameraController({ layout, scrollProgress, paused }: CameraControllerProps) {
  const { camera } = useThree();
  const gsapTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const gsapLoadedRef = useRef(false);

  // Build GSAP master timeline when layout data is available
  useEffect(() => {
    if (layout.phases.length === 0) return;

    let cancelled = false;

    Promise.all([import('gsap')]).then(([{ gsap }]) => {
      if (cancelled) return;
      gsapLoadedRef.current = true;

      const tl = gsap.timeline({ paused: true });

      // Position the camera at the entry point
      const firstPhase = layout.phases[0];
      if (firstPhase) {
        camera.position.set(...firstPhase.cameraPosition);
        camera.lookAt(...firstPhase.cameraTarget);
      }

      // Chain camera movements through each phase
      for (const phase of layout.phases) {
        const duration = (phase.end - phase.start);
        tl.to(
          camera.position,
          {
            x: phase.cameraPosition[0],
            y: phase.cameraPosition[1],
            z: phase.cameraPosition[2],
            duration,
            ease: 'power2.inOut',
            onUpdate: () => {
              camera.lookAt(
                phase.cameraTarget[0],
                phase.cameraTarget[1],
                phase.cameraTarget[2],
              );
            },
          },
          phase.start, // position on timeline = scroll progress
        );
      }

      gsapTimelineRef.current = tl;
    });

    return () => {
      cancelled = true;
      gsapTimelineRef.current?.kill();
      gsapTimelineRef.current = null;
    };
  }, [layout.phases, camera]);

  // Seek the timeline to the current scroll progress each frame
  useFrame(() => {
    if (paused) return;
    if (gsapTimelineRef.current) {
      gsapTimelineRef.current.progress(scrollProgress);
    }
  });

  return null;
}

/* ─────────────────────────────────────────────────
   Inner scene (rendered inside Canvas)
   ───────────────────────────────────────────────── */

interface InnerSceneProps {
  layout: Timeline3DLayout;
  scrollProgress: number;
  onOpenDrawer: (slug: string) => void;
  onContextMenu: (x: number, y: number, node: TimelineNode3D) => void;
}

function InnerScene({
  layout,
  scrollProgress,
  onOpenDrawer,
  onContextMenu,
}: InnerSceneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TimelineNode3D | null>(null);

  // Connected IDs for edge highlighting
  const connectedIds = useMemo(() => {
    const ids = new Set<string>();
    const activeId = selectedNode?.id ?? hoveredId;
    if (!activeId) return ids;
    ids.add(activeId);
    for (const edge of layout.edges) {
      if (edge.sourceId === activeId) ids.add(edge.targetId);
      if (edge.targetId === activeId) ids.add(edge.sourceId);
    }
    return ids;
  }, [hoveredId, selectedNode, layout.edges]);

  const handleClick = useCallback((node: TimelineNode3D) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  const handleClose = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleContextMenu = useCallback(
    (event: ThreeEvent<MouseEvent>, node: TimelineNode3D) => {
      event.nativeEvent.preventDefault();
      onContextMenu(
        event.nativeEvent.clientX,
        event.nativeEvent.clientY,
        node,
      );
    },
    [onContextMenu],
  );

  const handleNavigateToNode = useCallback(
    (_nodeId: string) => {
      // Future: animate camera to the connected node
      // For now, close the expansion
      setSelectedNode(null);
    },
    [],
  );

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} color="#F7F2EA" />
      <directionalLight
        position={[5, 10, -5]}
        intensity={0.6}
        color="#FFF8F0"
      />
      <Environment preset="warehouse" />

      {/* Fog: objects in the deep past fade into the page */}
      <fog attach="fog" args={['#F7F2EA', 50, 100]} />

      {/* Camera controller */}
      <CameraController
        layout={layout}
        scrollProgress={scrollProgress}
        paused={!!selectedNode}
      />

      {/* Ground plane */}
      <GroundPlane />

      {/* Instanced objects */}
      <Timeline3DObjects
        nodes={layout.nodes}
        hoveredId={hoveredId}
        selectedId={selectedNode?.id ?? null}
        onHover={setHoveredId}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />

      {/* Connection arcs */}
      <Timeline3DEdges
        edges={layout.edges}
        hoveredId={hoveredId}
        selectedId={selectedNode?.id ?? null}
        connectedIds={connectedIds}
      />

      {/* Date markers */}
      <DateLabels markers={layout.dateMarkers} />

      {/* Expanded object detail */}
      {selectedNode && (
        <Timeline3DExpander
          node={selectedNode}
          onClose={handleClose}
          onOpenDrawer={onOpenDrawer}
          onNavigateToNode={handleNavigateToNode}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────
   Main exported scene component
   ───────────────────────────────────────────────── */

interface Timeline3DSceneProps {
  feedNodes: MockNode[];
  scrollProgress: number;
  onOpenDrawer: (slug: string) => void;
  onContextMenu: (x: number, y: number, node: TimelineNode3D) => void;
}

export default function Timeline3DScene({
  feedNodes,
  scrollProgress,
  onOpenDrawer,
  onContextMenu,
}: Timeline3DSceneProps) {
  const layout = useMemo(
    () => computeTimeline3DLayout(feedNodes),
    [feedNodes],
  );

  return (
    <Canvas
      camera={{
        position: [0, 6, -2],
        fov: 50,
        near: 0.1,
        far: 200,
      }}
      style={{
        width: '100%',
        height: '100%',
        background: '#F7F2EA',
      }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
    >
      <InnerScene
        layout={layout}
        scrollProgress={scrollProgress}
        onOpenDrawer={onOpenDrawer}
        onContextMenu={onContextMenu}
      />
    </Canvas>
  );
}

/** Re-export layout computation for the wrapper to read scrollHeight */
export { computeTimeline3DLayout };
