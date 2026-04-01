'use client';

/**
 * R3FNode: Polymorphic node mesh for the R3F renderer.
 *
 * Geometry by object_type: source=Octahedron, concept=Icosahedron,
 * person=Sphere, hunch=Dodecahedron+wireframe, note=Box(1.5:1:0.1).
 * Hypothesis nodes get a dashed wireframe overlay via LineSegments.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneNode } from '@/lib/theseus-viz/SceneSpec';

const _tempVec = new THREE.Vector3();
const MAX_VISIBLE_LABELS = 15;
const LABEL_DISTANCE_THRESHOLD = 18;
const DASH_SIZE = 0.15;
const GAP_SIZE = 0.1;

interface R3FNodeProps {
  node: SceneNode;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  visibleLabelCountRef: React.MutableRefObject<number>;
}

function getGeometry(objectType: string): React.ReactNode {
  switch (objectType) {
    case 'source':
      return <octahedronGeometry args={[1, 0]} />;
    case 'concept':
      return <icosahedronGeometry args={[1, 0]} />;
    case 'person':
      return <sphereGeometry args={[1, 24, 24]} />;
    case 'hunch':
      return <dodecahedronGeometry args={[1, 0]} />;
    case 'note':
      return <boxGeometry args={[1.5, 1, 0.1]} />;
    default:
      return <sphereGeometry args={[1, 16, 16]} />;
  }
}

function HypothesisWireframe({ objectType }: { objectType: string }) {
  const geo = useMemo(() => {
    let baseGeo: THREE.BufferGeometry;
    switch (objectType) {
      case 'source':
        baseGeo = new THREE.OctahedronGeometry(1.05, 0);
        break;
      case 'concept':
        baseGeo = new THREE.IcosahedronGeometry(1.05, 0);
        break;
      case 'person':
        baseGeo = new THREE.SphereGeometry(1.05, 12, 12);
        break;
      case 'hunch':
        baseGeo = new THREE.DodecahedronGeometry(1.05, 0);
        break;
      case 'note':
        baseGeo = new THREE.BoxGeometry(1.55, 1.05, 0.15);
        break;
      default:
        baseGeo = new THREE.SphereGeometry(1.05, 12, 12);
    }
    const edges = new THREE.EdgesGeometry(baseGeo);
    baseGeo.dispose();
    return edges;
  }, [objectType]);

  /* Dispose EdgesGeometry on unmount to prevent GPU memory leak */
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <lineSegments geometry={geo}>
      <lineDashedMaterial
        color="#e8e5e0"
        dashSize={DASH_SIZE}
        gapSize={GAP_SIZE}
        opacity={0.5}
        transparent
      />
    </lineSegments>
  );
}

export default function R3FNode({
  node,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  visibleLabelCountRef,
}: R3FNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const camera = useThree((s) => s.camera);

  const baseScale = node.scale;
  const targetScale = isSelected ? baseScale * 1.2 : isHovered ? baseScale * 1.1 : baseScale;
  const emissiveTarget = isSelected ? 0.4 : isHovered ? 0.4 : 0.15;

  useFrame(() => {
    if (!groupRef.current) return;

    const s = groupRef.current.scale.x;
    groupRef.current.scale.setScalar(s + (targetScale - s) * 0.12);

    if (materialRef.current) {
      const ei = materialRef.current.emissiveIntensity;
      materialRef.current.emissiveIntensity = ei + (emissiveTarget - ei) * 0.12;
    }

    if (labelRef.current) {
      _tempVec.set(node.position[0], node.position[1], node.position[2]);
      const dist = camera.position.distanceTo(_tempVec);
      const shouldShow =
        dist < LABEL_DISTANCE_THRESHOLD &&
        visibleLabelCountRef.current < MAX_VISIBLE_LABELS;
      const isVisible = labelRef.current.style.display !== 'none';

      if (shouldShow && !isVisible) {
        labelRef.current.style.display = '';
        visibleLabelCountRef.current++;
      } else if (!shouldShow && isVisible) {
        labelRef.current.style.display = 'none';
        if (visibleLabelCountRef.current > 0) visibleLabelCountRef.current--;
      }
    }
  });

  const showWireframe = node.object_type === 'hunch' || node.is_hypothesis;

  return (
    <group ref={groupRef} position={node.position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(node.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = 'default';
        }}
      >
        {getGeometry(node.object_type)}
        <meshStandardMaterial
          ref={materialRef}
          color={node.color}
          emissive={node.color}
          emissiveIntensity={0.15}
          roughness={0.7}
          opacity={node.opacity}
          transparent={node.opacity < 1}
        />
      </mesh>

      {showWireframe && <HypothesisWireframe objectType={node.object_type} />}

      <Html
        center
        position={[0, -(baseScale + 0.6), 0]}
        style={{ pointerEvents: 'none', whiteSpace: 'nowrap', userSelect: 'none' }}
      >
        <div
          ref={labelRef}
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: '11px',
            color: '#e8e5e0',
            textAlign: 'center',
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {node.label}
        </div>
      </Html>
    </group>
  );
}
