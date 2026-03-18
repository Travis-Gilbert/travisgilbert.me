'use client';

/**
 * Timeline3DObjects: InstancedMesh rendering for all 11 object types.
 *
 * One InstancedMesh per object type. Per-frame distance-based LOD
 * controls opacity, scale, and label visibility. Hover detection
 * via raycaster on each instance.
 */

import { useRef, useMemo, useCallback } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { OBJECT_TYPES } from '@/lib/commonplace';
import type { TimelineNode3D } from '@/lib/timeline-3d-layout';
import { applyWobble } from '@/shaders/wobbleMaterial';

/* ─────────────────────────────────────────────────
   Geometry factory per object type
   ───────────────────────────────────────────────── */

function createTypeGeometry(slug: string, r: number): THREE.BufferGeometry {
  switch (slug) {
    case 'note':       return new THREE.IcosahedronGeometry(r, 0);
    case 'source':     return new THREE.BoxGeometry(r, r * 1.4, r * 0.3);
    case 'person':     return new THREE.SphereGeometry(r, 8, 6);
    case 'place':      return new THREE.ConeGeometry(r, r * 1.2, 4);
    case 'organization': return new THREE.BoxGeometry(r, r, r);
    case 'concept':    return new THREE.OctahedronGeometry(r);
    case 'quote':      return new THREE.PlaneGeometry(r * 1.5, r * 0.8);
    case 'hunch':      return new THREE.TetrahedronGeometry(r);
    case 'event':      return new THREE.CylinderGeometry(r * 0.3, r, r * 0.8, 6);
    case 'script':     return new THREE.BoxGeometry(r * 1.2, r * 0.8, r * 0.15);
    case 'task':       return new THREE.TorusGeometry(r * 0.5, r * 0.2, 8, 6);
    default:           return new THREE.SphereGeometry(r, 8, 6);
  }
}

/* ─────────────────────────────────────────────────
   Distance LOD thresholds (squared to avoid sqrt)
   ───────────────────────────────────────────────── */

const LOD_LABEL_SQ = 15 * 15;     // < 15 units: show labels
const LOD_DETAIL_SQ = 30 * 30;    // < 30 units: show labels + badge
const BASE_EMISSIVE = 0.0;
const HOVER_EMISSIVE = 0.3;

/* ─────────────────────────────────────────────────
   Props
   ───────────────────────────────────────────────── */

interface Timeline3DObjectsProps {
  nodes: TimelineNode3D[];
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onClick: (node: TimelineNode3D) => void;
  onContextMenu: (event: ThreeEvent<MouseEvent>, node: TimelineNode3D) => void;
}

/* ─────────────────────────────────────────────────
   TypeInstanceGroup: one InstancedMesh per type
   ───────────────────────────────────────────────── */

interface TypeGroupProps {
  typeSlug: string;
  typeColor: string;
  typeNodes: TimelineNode3D[];
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onClick: (node: TimelineNode3D) => void;
  onContextMenu: (event: ThreeEvent<MouseEvent>, node: TimelineNode3D) => void;
}

const _tempMatrix = new THREE.Matrix4();
const _tempColor = new THREE.Color();
const _tempVec = new THREE.Vector3();

function TypeInstanceGroup({
  typeSlug,
  typeColor,
  typeNodes,
  hoveredId,
  selectedId,
  onHover,
  onClick,
  onContextMenu,
}: TypeGroupProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  const geometry = useMemo(
    () => createTypeGeometry(typeSlug, 1),
    [typeSlug],
  );

  const maxInstances = Math.max(typeNodes.length, 1);

  // Node index map for raycaster lookups
  const nodeByIndex = useMemo(() => {
    const map = new Map<number, TimelineNode3D>();
    typeNodes.forEach((n, i) => map.set(i, n));
    return map;
  }, [typeNodes]);

  // Per-frame: update instance transforms based on camera distance
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const camPos = camera.position;

    for (let i = 0; i < typeNodes.length; i++) {
      const node = typeNodes[i];
      const [x, y, z] = node.position;

      // Squared distance to camera
      const dx = camPos.x - x;
      const dy = camPos.y - y;
      const dz = camPos.z - z;
      const distSq = dx * dx + dy * dy + dz * dz;

      // Scale based on distance (fade in as camera approaches)
      let scale = node.radius;
      if (distSq > LOD_DETAIL_SQ) {
        scale *= 0.6; // Far: smaller
      } else if (distSq > LOD_LABEL_SQ) {
        scale *= 0.8; // Mid: medium
      }

      // Hovered: slight scale boost
      const isHovered = hoveredId === node.id;
      const isSelected = selectedId === node.id;
      if (isHovered) scale *= 1.3;
      if (isSelected) scale = 0; // Hide selected (expanded object replaces it)

      _tempMatrix.makeScale(scale, scale, scale);
      _tempMatrix.setPosition(x, y, z);
      mesh.setMatrixAt(i, _tempMatrix);

      // Color: base type color, dimmed if something else is hovered
      _tempColor.set(typeColor);
      if (hoveredId && !isHovered) {
        _tempColor.multiplyScalar(0.4);
      }
      mesh.setColorAt(i, _tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = typeNodes.length;
  });

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined) {
        const node = nodeByIndex.get(e.instanceId);
        if (node) onHover(node.id);
      }
    },
    [nodeByIndex, onHover],
  );

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(null);
    },
    [onHover],
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined) {
        const node = nodeByIndex.get(e.instanceId);
        if (node) onClick(node);
      }
    },
    [nodeByIndex, onClick],
  );

  const handleContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined) {
        const node = nodeByIndex.get(e.instanceId);
        if (node) onContextMenu(e, node);
      }
    },
    [nodeByIndex, onContextMenu],
  );

  if (typeNodes.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, maxInstances]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      frustumCulled={false}
    >
      <meshStandardMaterial
        color={typeColor}
        roughness={0.85}
        metalness={0.05}
        onBeforeCompile={applyWobble}
      />
    </instancedMesh>
  );
}

/* ─────────────────────────────────────────────────
   Floating labels (Drei Text, distance-gated)
   ───────────────────────────────────────────────── */

function NodeLabel({ node }: { node: TimelineNode3D }) {
  const ref = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!ref.current) return;
    const [x, y, z] = node.position;
    const dx = camera.position.x - x;
    const dy = camera.position.y - y;
    const dz = camera.position.z - z;
    const distSq = dx * dx + dy * dy + dz * dz;

    // Only visible within label range
    const visible = distSq < LOD_LABEL_SQ;
    ref.current.visible = visible;

    if (visible) {
      // Opacity fade based on distance
      const t = Math.max(0, 1 - distSq / LOD_LABEL_SQ);
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      if (mat && 'opacity' in mat) {
        mat.opacity = t;
      }
    }
  });

  return (
    <Text
      ref={ref}
      position={[node.position[0], node.position[1] + node.radius + 0.3, node.position[2]]}
      fontSize={0.2}
      color={node.color}
      anchorX="center"
      anchorY="bottom"
      maxWidth={3}
      material-transparent
      material-depthWrite={false}
    >
      {node.title.length > 40 ? node.title.slice(0, 37) + '...' : node.title}
    </Text>
  );
}

/* ─────────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────────── */

export default function Timeline3DObjects({
  nodes,
  hoveredId,
  selectedId,
  onHover,
  onClick,
  onContextMenu,
}: Timeline3DObjectsProps) {
  // Group nodes by type for instancing
  const typeGroups = useMemo(() => {
    const groups = new Map<string, TimelineNode3D[]>();
    for (const node of nodes) {
      const existing = groups.get(node.objectType);
      if (existing) existing.push(node);
      else groups.set(node.objectType, [node]);
    }
    return groups;
  }, [nodes]);

  return (
    <group>
      {/* Instanced meshes per type */}
      {OBJECT_TYPES.map((typeInfo) => {
        const typeNodes = typeGroups.get(typeInfo.slug);
        if (!typeNodes || typeNodes.length === 0) return null;
        return (
          <TypeInstanceGroup
            key={typeInfo.slug}
            typeSlug={typeInfo.slug}
            typeColor={typeInfo.color}
            typeNodes={typeNodes}
            hoveredId={hoveredId}
            selectedId={selectedId}
            onHover={onHover}
            onClick={onClick}
            onContextMenu={onContextMenu}
          />
        );
      })}

      {/* Floating title labels */}
      {nodes.map((node) => (
        <NodeLabel key={`label-${node.id}`} node={node} />
      ))}
    </group>
  );
}
