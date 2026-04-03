'use client';

import * as THREE from 'three';
import type { RendererNode } from './rendering';

const LABEL_NAME = '__label';
const WIRE_NAME = '__wire';
const MESH_NAME = '__mesh';
const GLOW_NAME = '__glow';

function buildGeometry(objectType: string): THREE.BufferGeometry {
  switch (objectType) {
    case 'source':
      return new THREE.OctahedronGeometry(1, 0);
    case 'concept':
      return new THREE.IcosahedronGeometry(1, 0);
    case 'person':
      return new THREE.SphereGeometry(1, 20, 20);
    case 'hunch':
      return new THREE.DodecahedronGeometry(1, 0);
    case 'note':
      return new THREE.BoxGeometry(1.5, 1, 0.1);
    default:
      return new THREE.SphereGeometry(1, 18, 18);
  }
}

function buildLabelSprite(text: string, color: string, scale: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;

  const context = canvas.getContext('2d');
  if (!context) {
    return new THREE.Sprite();
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '42px "IBM Plex Sans", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.name = LABEL_NAME;
  sprite.position.set(0, scale * 1.8, 0);
  sprite.scale.set(
    Math.max(2.6, text.length * 0.18),
    0.8,
    1,
  );

  return sprite;
}

function buildHypothesisWireframe(
  geometry: THREE.BufferGeometry,
  color: string,
  dashScale: number,
): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineDashedMaterial({
    color,
    dashSize: 0.18 * dashScale,
    gapSize: 0.12 * dashScale,
    transparent: true,
    opacity: 0.65,
  });

  const wireframe = new THREE.LineSegments(edges, material);
  wireframe.name = WIRE_NAME;
  wireframe.computeLineDistances();
  return wireframe;
}

export function createNodeObject(
  node: RendererNode,
  showLabel: boolean,
): THREE.Object3D {
  const group = new THREE.Group();
  const geometry = buildGeometry(node.objectType);
  const material = new THREE.MeshStandardMaterial({
    color: node.color,
    emissive: node.color,
    emissiveIntensity: node.emissive,
    transparent: true,
    opacity: node.opacity,
    roughness: 0.7,
    metalness: 0.15,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = MESH_NAME;
  mesh.scale.setScalar(node.baseScale);
  group.add(mesh);

  if (node.emissive > 0.3) {
    const ringGeometry = new THREE.RingGeometry(node.baseScale * 1.1, node.baseScale * 1.6, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: node.color,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.name = GLOW_NAME;
    group.add(ring);
  }

  if (node.isHypothesis || node.objectType === 'hunch') {
    group.add(buildHypothesisWireframe(geometry, '#E8E5E0', 1.15));
  }

  if (showLabel) {
    group.add(buildLabelSprite(node.label, '#E8E5E0', node.baseScale));
  }

  group.userData.nodeId = node.id;
  return group;
}

function disposeObject(object: THREE.Object3D | undefined) {
  if (!object) return;

  const mesh = object as THREE.Mesh;
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }

  const disposeMaterial = (material: THREE.Material) => {
    const texturedMaterial = material as THREE.Material & { map?: THREE.Texture | null };
    texturedMaterial.map?.dispose();
    material.dispose();
  };

  const { material } = mesh;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
  } else if (material) {
    disposeMaterial(material);
  }
}

export function updateNodeObject(
  object: THREE.Object3D,
  node: RendererNode,
  showLabel: boolean,
): void {
  const group = object as THREE.Group;
  group.visible = node.opacity > 0.01;

  const mesh = group.getObjectByName(MESH_NAME) as THREE.Mesh | undefined;
  if (mesh) {
    mesh.scale.setScalar(node.baseScale);
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.color.set(node.color);
    material.emissive.set(node.color);
    material.emissiveIntensity = node.emissive;
    material.opacity = node.opacity;
    material.needsUpdate = true;
  }

  const existingGlow = group.getObjectByName(GLOW_NAME);
  const shouldGlow = node.emissive > 0.3;
  if (shouldGlow && !existingGlow) {
    const ringGeometry = new THREE.RingGeometry(node.baseScale * 1.1, node.baseScale * 1.6, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: node.color,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.name = GLOW_NAME;
    group.add(ring);
  } else if (!shouldGlow && existingGlow) {
    group.remove(existingGlow);
    disposeObject(existingGlow);
  }

  const existingLabel = group.getObjectByName(LABEL_NAME);
  if (showLabel && !existingLabel) {
    group.add(buildLabelSprite(node.label, '#E8E5E0', node.baseScale));
  } else if (!showLabel && existingLabel) {
    group.remove(existingLabel);
    disposeObject(existingLabel);
  } else if (showLabel && existingLabel) {
    existingLabel.position.set(0, node.baseScale * 1.8, 0);
    existingLabel.scale.set(
      Math.max(2.6, node.label.length * 0.18),
      0.8,
      1,
    );
  }
}
