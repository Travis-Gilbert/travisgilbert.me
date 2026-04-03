/**
 * ShapeGenerator interface and GraphShape implementation.
 *
 * ShapeGenerators compute target positions + colors for the ParticleField.
 * Each answer type provides a different generator; the particle field
 * itself is always the same.
 */

// d3-force-3d has no TS declarations; import what we need and type manually
const d3Force3d = require('d3-force-3d') as {
  forceSimulation: (nodes: unknown[], numDimensions?: number) => D3Simulation;
  forceManyBody: () => { strength: (v: number) => unknown };
  forceCenter: (x: number, y: number, z: number) => { strength: (v: number) => unknown };
  forceCollide: () => { radius: (fn: (d: unknown) => number) => unknown };
  forceLink: (links: unknown[]) => { id: (fn: (d: unknown) => string) => { strength: (fn: (l: unknown) => number) => unknown } };
};

interface D3Simulation {
  force: (name: string, force: unknown) => D3Simulation;
  alpha: (v: number) => D3Simulation;
  alphaDecay: (v: number) => D3Simulation;
  tick: () => void;
}
import { mulberry32 } from '@/lib/prng';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import type { TheseusResponse } from '@/lib/theseus-types';
import { buildRendererGraph, TYPE_COLORS, type RendererNode, type RendererEdge } from './rendering';

// ── Public types ──

export interface ShapeRegion {
  id: number;
  label: string;
  center: [number, number, number];
  radius: number;
  objectIds: string[];
  color: string;
}

export interface ShapeResult {
  target: Float32Array;
  targetColor: Float32Array;
  alpha: Float32Array;
  regions: ShapeRegion[];
  cameraPosition: [number, number, number];
  cameraLookAt: [number, number, number];
}

export interface ShapeContext {
  response: TheseusResponse;
  directive: SceneDirective;
  particleCount: number;
}

export interface ShapeGenerator {
  generate(context: ShapeContext): ShapeResult;
}

// ── Color utils ──

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

const AMBIENT_COLOR: [number, number, number] = [0.22, 0.21, 0.20];

// ── d3-force-3d simulation (runs once, not per frame) ──

interface SimNode {
  id: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  isFocal: boolean;
  color: [number, number, number];
  label: string;
  objectIds: string[];
}

function runForceSimulation(
  nodes: RendererNode[],
  edges: RendererEdge[],
  directive: SceneDirective,
): SimNode[] {
  const fc = directive.force_config;

  const simNodes = nodes.map((node, i) => ({
    id: node.id,
    x: node.initialPosition[0],
    y: node.initialPosition[1],
    z: node.initialPosition[2],
    scale: node.baseScale,
    isFocal: node.isFocal,
    color: hexToRgb(node.color),
    label: node.label,
    objectIds: [node.id],
  }));

  const nodeIds = new Set(simNodes.map((n) => n.id));
  const simLinks = edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
      strength: edge.strength,
    }));

  const simulation = d3Force3d.forceSimulation(simNodes, 3)
    .force('charge', d3Force3d.forceManyBody().strength(fc.charge_strength))
    .force('center', d3Force3d.forceCenter(0, 0, 0).strength(fc.center_gravity))
    .force('collide', d3Force3d.forceCollide().radius((d: unknown) => (d as SimNode).scale * fc.collision_radius_factor * 1.5))
    .force('link', d3Force3d.forceLink(simLinks)
      .id((d: unknown) => (d as SimNode).id)
      .strength((link: unknown) => (link as { strength: number }).strength * 0.3))
    .alpha(fc.simulation_alpha)
    .alphaDecay(fc.simulation_alpha_decay);

  // Run synchronously
  const ticks = Math.max(100, fc.warmup_ticks);
  for (let i = 0; i < ticks; i++) {
    simulation.tick();
  }

  return simNodes;
}

// ── GraphShape ──

function distributeParticlesAroundNode(
  rng: () => number,
  cx: number, cy: number, cz: number,
  count: number,
  radius: number,
  target: Float32Array,
  targetColor: Float32Array,
  alpha: Float32Array,
  color: [number, number, number],
  baseAlpha: number,
  startIdx: number,
): void {
  for (let i = 0; i < count; i++) {
    const idx = startIdx + i;
    const i3 = idx * 3;

    // Random point in sphere
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const r = radius * Math.cbrt(rng());

    target[i3] = cx + r * Math.sin(phi) * Math.cos(theta);
    target[i3 + 1] = cy + r * Math.sin(phi) * Math.sin(theta);
    target[i3 + 2] = cz + r * Math.cos(phi);

    targetColor[i3] = color[0];
    targetColor[i3 + 1] = color[1];
    targetColor[i3 + 2] = color[2];

    alpha[idx] = baseAlpha + rng() * 0.02;
  }
}

function distributeParticlesAlongEdge(
  rng: () => number,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  count: number,
  target: Float32Array,
  targetColor: Float32Array,
  alpha: Float32Array,
  color: [number, number, number],
  startIdx: number,
): void {
  for (let i = 0; i < count; i++) {
    const idx = startIdx + i;
    const i3 = idx * 3;
    const t = rng();
    const offset = 0.15;

    target[i3] = x1 + (x2 - x1) * t + (rng() - 0.5) * offset;
    target[i3 + 1] = y1 + (y2 - y1) * t + (rng() - 0.5) * offset;
    target[i3 + 2] = z1 + (z2 - z1) * t + (rng() - 0.5) * offset;

    targetColor[i3] = color[0] * 0.6;
    targetColor[i3 + 1] = color[1] * 0.6;
    targetColor[i3 + 2] = color[2] * 0.6;

    alpha[idx] = 0.015 + rng() * 0.01;
  }
}

export const graphShape: ShapeGenerator = {
  generate(context: ShapeContext): ShapeResult {
    const { response, directive, particleCount } = context;
    const { nodes, edges } = buildRendererGraph(response, directive);

    const target = new Float32Array(particleCount * 3);
    const targetColor = new Float32Array(particleCount * 3);
    const alpha = new Float32Array(particleCount);

    if (nodes.length === 0) {
      return {
        target, targetColor, alpha,
        regions: [],
        cameraPosition: [0, 8, 14],
        cameraLookAt: [0, 0, 0],
      };
    }

    // Run force simulation to get node positions
    const simNodes = runForceSimulation(nodes, edges, directive);
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));

    // Budget particles: focal get more, supporting less, edges get some, rest ambient
    const totalSalience = simNodes.reduce((sum, n) => sum + n.scale, 0);
    const edgeParticleBudget = Math.min(
      Math.floor(particleCount * 0.08),
      edges.length * 40,
    );
    const nodeParticleBudget = Math.floor(particleCount * 0.7);
    const ambientBudget = particleCount - nodeParticleBudget - edgeParticleBudget;

    // Distribute node particles proportional to salience
    let particleIdx = 0;
    const rng = mulberry32(42);
    const regions: ShapeRegion[] = [];

    for (const simNode of simNodes) {
      if (particleIdx >= particleCount) break;
      const share = simNode.scale / totalSalience;
      const count = Math.min(
        particleCount - particleIdx,
        Math.max(50, Math.floor(nodeParticleBudget * share)),
      );
      const radius = simNode.isFocal
        ? 0.8 + simNode.scale * 0.6
        : 0.4 + simNode.scale * 0.4;
      const baseAlpha = simNode.isFocal ? 0.04 : 0.025;

      distributeParticlesAroundNode(
        rng,
        simNode.x, simNode.y, simNode.z,
        count, radius, target, targetColor, alpha,
        simNode.color, baseAlpha, particleIdx,
      );

      regions.push({
        id: regions.length,
        label: simNode.label,
        center: [simNode.x, simNode.y, simNode.z],
        radius,
        objectIds: simNode.objectIds,
        color: `rgb(${Math.round(simNode.color[0] * 255)},${Math.round(simNode.color[1] * 255)},${Math.round(simNode.color[2] * 255)})`,
      });

      particleIdx += count;
    }

    // Distribute edge particles
    const edgeParticlesEach = edges.length > 0
      ? Math.floor(edgeParticleBudget / edges.length)
      : 0;

    for (const edge of edges) {
      const src = nodeById.get(edge.source);
      const tgt = nodeById.get(edge.target);
      if (!src || !tgt || particleIdx >= particleCount) break;

      const count = Math.min(edgeParticlesEach, particleCount - particleIdx);
      const edgeColor = hexToRgb(edge.color);

      distributeParticlesAlongEdge(
        rng,
        src.x, src.y, src.z,
        tgt.x, tgt.y, tgt.z,
        count, target, targetColor, alpha, edgeColor, particleIdx,
      );

      particleIdx += count;
    }

    // Fill remaining as ambient scatter
    for (let i = particleIdx; i < particleCount; i++) {
      const i3 = i * 3;
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const r = 8 + rng() * 6;

      target[i3] = r * Math.sin(phi) * Math.cos(theta);
      target[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      target[i3 + 2] = r * Math.cos(phi);

      targetColor[i3] = AMBIENT_COLOR[0];
      targetColor[i3 + 1] = AMBIENT_COLOR[1];
      targetColor[i3 + 2] = AMBIENT_COLOR[2];

      alpha[i] = 0.004 + rng() * 0.006;
    }

    // Camera: look at center, positioned to see the full graph
    const maxDist = simNodes.reduce(
      (max, n) => Math.max(max, Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z)),
      0,
    );
    const camDist = Math.max(12, maxDist * 2.2) * directive.camera.distance_factor;

    return {
      target,
      targetColor,
      alpha,
      regions,
      cameraPosition: [camDist * 0.3, camDist * 0.5, camDist],
      cameraLookAt: [0, 0, 0],
    };
  },
};
