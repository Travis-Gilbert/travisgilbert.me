'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D, {
  type ForceGraphMethods,
  type GraphData,
  type LinkObject,
  type NodeObject,
} from 'react-force-graph-3d';
import {
  forceCenter,
  forceCollide,
} from 'd3-force-3d';
import * as THREE from 'three';
import type { TheseusResponse } from '@/lib/theseus-types';
import type {
  ForceConfig,
  NodeForceDirective,
  SceneDirective,
} from '@/lib/theseus-viz/SceneDirective';
import { createNodeObject, updateNodeObject } from './NodeMesh';
import {
  buildRendererGraph,
  getClusterCoalesceProgress,
  getEdgeRevealProgress,
  getNodeRevealProgress,
  getVisibleLabelIds,
  type ConstructionPlayback,
  type RendererEdge,
  type RendererNode,
} from './rendering';

interface GraphNode extends NodeObject<RendererNode> {
  id: string;
  __threeObject?: THREE.Object3D;
  visibleScale: number;
  visibleOpacity: number;
  visibleEmissive: number;
  showLabel: boolean;
  __mass?: number;
}

type GraphLink = LinkObject<GraphNode, Omit<RendererEdge, 'source' | 'target'>> & {
  source: string | GraphNode;
  target: string | GraphNode;
  id: string;
  drawProgress: number;
  dashScale: number;
  dashed: boolean;
  color: string;
  width: number;
};

interface ForceGraph3DRendererProps {
  directive: SceneDirective;
  response: TheseusResponse;
  playback: ConstructionPlayback;
  onSelectNode?: (nodeId: string) => void;
  onError?: (error: Error) => void;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function useViewportSize() {
  const [size, setSize] = useState(getViewportSize);

  useEffect(() => {
    const handleResize = () => setSize(getViewportSize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildTooltip(node: GraphNode): string {
  return `
    <div style="
      display:flex;
      flex-direction:column;
      gap:6px;
      padding:10px 12px;
      border-radius:12px;
      background:rgba(15,16,18,0.94);
      border:1px solid rgba(255,255,255,0.08);
      color:#e8e5e0;
      min-width:160px;
      box-shadow:0 18px 48px rgba(0,0,0,0.32);
    ">
      <strong style="font:600 13px 'IBM Plex Sans',sans-serif;">${escapeHtml(node.label)}</strong>
      <span style="
        width:max-content;
        border-radius:999px;
        padding:2px 8px;
        background:rgba(255,255,255,0.06);
        color:${node.color};
        font:11px 'Courier Prime',monospace;
        text-transform:uppercase;
      ">${escapeHtml(node.objectType)}</span>
    </div>
  `;
}

function getNodeDirective(
  directives: NodeForceDirective[],
  nodeId: string,
): NodeForceDirective | undefined {
  return directives.find((directive) => directive.node_id === nodeId);
}

function getLinkStrength(
  linkId: string,
  defaultStrength: number,
  forceConfig: ForceConfig,
): number {
  const override = forceConfig.link_strengths.find(
    (entry) => `${entry.from_id}->${entry.to_id}` === linkId,
  );
  return override?.strength ?? defaultStrength;
}

function createCenterPullForce(
  nodeDirectives: NodeForceDirective[],
): ((alpha: number) => void) & { initialize?: (nodes: GraphNode[]) => void } {
  let nodes: GraphNode[] = [];

  const force = (alpha: number) => {
    nodes.forEach((node) => {
      const directive = getNodeDirective(nodeDirectives, node.id);
      const pull = directive?.center_pull ?? 0;
      if (pull <= 0 || node.fx !== undefined || node.fy !== undefined || node.fz !== undefined) {
        return;
      }

      const mass = node.__mass ?? 1;
      node.vx = (node.vx ?? 0) + ((0 - (node.x ?? 0)) * 0.02 * pull * alpha) / mass;
      node.vy = (node.vy ?? 0) + ((0 - (node.y ?? 0)) * 0.02 * pull * alpha) / mass;
      node.vz = (node.vz ?? 0) + ((0 - (node.z ?? 0)) * 0.02 * pull * alpha) / mass;
    });
  };

  force.initialize = (nextNodes: GraphNode[]) => {
    nodes = nextNodes;
  };

  return force;
}

function createGroupForce(
  groups: SceneDirective['force_config']['groups'],
  clusterProgress: number,
): ((alpha: number) => void) & { initialize?: (nodes: GraphNode[]) => void } {
  let nodes: GraphNode[] = [];
  const nodeById = new Map<string, GraphNode>();

  const force = (alpha: number) => {
    groups.forEach((group) => {
      const members = group.node_ids
        .map((id) => nodeById.get(id))
        .filter((node): node is GraphNode => Boolean(node));

      if (members.length === 0) {
        return;
      }

      const center = group.center_hint
        ? { x: group.center_hint[0], y: group.center_hint[1], z: group.center_hint[2] }
        : members.reduce(
            (accumulator, node) => ({
              x: accumulator.x + (node.x ?? 0),
              y: accumulator.y + (node.y ?? 0),
              z: accumulator.z + (node.z ?? 0),
            }),
            { x: 0, y: 0, z: 0 },
          );

      if (!group.center_hint) {
        center.x /= members.length;
        center.y /= members.length;
        center.z /= members.length;
      }

      members.forEach((member) => {
        const mass = member.__mass ?? 1;
        const strength = group.cohesion * (0.02 + clusterProgress * 0.04) * alpha;
        member.vx = (member.vx ?? 0) + ((center.x - (member.x ?? 0)) * strength) / mass;
        member.vy = (member.vy ?? 0) + ((center.y - (member.y ?? 0)) * strength) / mass;
        member.vz = (member.vz ?? 0) + ((center.z - (member.z ?? 0)) * strength) / mass;
      });
    });
  };

  force.initialize = (nextNodes: GraphNode[]) => {
    nodes = nextNodes;
    nodeById.clear();
    nextNodes.forEach((node) => nodeById.set(node.id, node));
  };

  return force;
}

function buildDashedLink(
  link: GraphLink,
): THREE.Line {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));

  const material = new THREE.LineDashedMaterial({
    color: link.color,
    dashSize: 0.22 * link.dashScale,
    gapSize: 0.14 * link.dashScale,
    transparent: true,
    opacity: 0.8,
  });

  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}

function buildLinkOverlay(link: GraphLink): THREE.Object3D {
  if (link.dashed) {
    return buildDashedLink(link);
  }

  return new THREE.Group();
}

export default function ForceGraph3DRenderer({
  directive,
  response,
  playback,
  onSelectNode,
  onError,
}: ForceGraph3DRendererProps) {
  const { width, height } = useViewportSize();
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const { nodes, edges } = useMemo(
    () => buildRendererGraph(response, directive),
    [directive, response],
  );

  const labelIds = useMemo(
    () => getVisibleLabelIds(nodes, playback),
    [nodes, playback],
  );

  const graphData = useMemo<GraphData<GraphNode, GraphLink>>(() => {
    const clusterProgress = getClusterCoalesceProgress(playback);

    const graphNodes: GraphNode[] = nodes.map((node) => {
      const reveal = getNodeRevealProgress(node.id, directive, playback);
      const spreadFactor = 1 + (1 - clusterProgress) * 0.5;
      const nodeDirective = getNodeDirective(directive.force_config.node_forces, node.id);
      const graphNode: GraphNode = {
        ...node,
        x: node.initialPosition[0] * spreadFactor,
        y: node.initialPosition[1] * spreadFactor,
        z: node.initialPosition[2] * spreadFactor,
        fx: nodeDirective?.pin_position?.[0],
        fy: nodeDirective?.pin_position?.[1],
        fz: nodeDirective?.pin_position?.[2],
        __mass: nodeDirective?.mass ?? 1,
        visibleScale: Math.max(0.001, node.baseScale * reveal),
        visibleOpacity: node.opacity * reveal,
        visibleEmissive: node.emissive * reveal,
        showLabel: labelIds.has(node.id),
      };

      graphNode.__threeObject = createNodeObject({
        ...node,
        baseScale: graphNode.visibleScale,
        opacity: graphNode.visibleOpacity,
        emissive: graphNode.visibleEmissive,
      }, graphNode.showLabel);

      return graphNode;
    });

    const graphLinks: GraphLink[] = edges.map((edge) => ({
      ...edge,
      source: edge.source,
      target: edge.target,
      id: edge.id,
      drawProgress: getEdgeRevealProgress(edge.id, directive, playback),
      dashScale: edge.dashScale,
      dashed: edge.dashed,
      color: edge.color,
      width: edge.width,
    }));

    return {
      nodes: graphNodes,
      links: graphLinks,
    };
  }, [directive, edges, labelIds, nodes, playback]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    try {
      const clusterProgress = getClusterCoalesceProgress(playback);

      graphData.nodes.forEach((node) => {
        if (node.__threeObject) {
          updateNodeObject(node.__threeObject, {
            ...node,
            baseScale: node.visibleScale,
            opacity: node.visibleOpacity,
            emissive: node.visibleEmissive,
          }, node.showLabel);
        }
      });

      const chargeForce = graph.d3Force('charge');
      if (chargeForce && 'strength' in chargeForce && typeof chargeForce.strength === 'function') {
        chargeForce.strength((node: GraphNode) => directive.force_config.charge_strength / (node.__mass ?? 1));
      }

      const centerForce = graph.d3Force('center');
      if (centerForce && 'strength' in centerForce && typeof centerForce.strength === 'function') {
        centerForce.strength(directive.force_config.center_gravity);
      } else {
        graph.d3Force('center', forceCenter(0, 0, 0).strength(directive.force_config.center_gravity));
      }

      graph.d3Force('collision', forceCollide<GraphNode>(
        (node) => Math.max(1.2, node.visibleScale * 3) * directive.force_config.collision_radius_factor,
      ));

      const linkForce = graph.d3Force('link');
      if (linkForce && 'strength' in linkForce && typeof linkForce.strength === 'function') {
        linkForce.strength((link: GraphLink) => getLinkStrength(link.id, link.strength, directive.force_config));
      }

      graph.d3Force('center-pull', createCenterPullForce(directive.force_config.node_forces));
      graph.d3Force('grouping', createGroupForce(directive.force_config.groups, clusterProgress));
      graph.d3ReheatSimulation();
      graph.refresh();
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to configure 3D force graph'));
    }
  }, [directive, graphData, onError, playback]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    try {
      const scene = graph.scene();

      const planeGeometry = new THREE.PlaneGeometry(200, 200);
      const planeMaterial = new THREE.MeshBasicMaterial({
        color: 0x0f1012,
        transparent: true,
        opacity: 0.3,
      });
      const groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
      groundPlane.rotation.x = -Math.PI / 2;
      groundPlane.position.y = -10;
      scene.add(groundPlane);

      const particleCount = 200;
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = Math.random() * 100;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const particleMaterial = new THREE.PointsMaterial({
        size: 0.08,
        color: 0x4a8a96,
        transparent: true,
        opacity: 0.15,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
      directionalLight.position.set(5, 10, 7);
      scene.add(directionalLight);

      const tealFill = new THREE.PointLight(0x4a8a96, 0.3);
      tealFill.position.set(0, 5, 0);
      scene.add(tealFill);

      return () => {
        [groundPlane, particles, ambientLight, directionalLight, tealFill].forEach((obj) => {
          scene.remove(obj);
        });
        planeGeometry.dispose();
        planeMaterial.dispose();
        particleGeometry.dispose();
        particleMaterial.dispose();
        ambientLight.dispose();
        directionalLight.dispose();
        tealFill.dispose();
      };
    } catch {
      // graph.scene() unavailable before mount completes
    }
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    try {
      const zMultiplier = nodes.length < 4 ? 1.5 : 1;
      graph.cameraPosition(
        {
          x: directive.camera.initial_position[0],
          y: directive.camera.initial_position[1],
          z: directive.camera.initial_position[2] * zMultiplier,
        },
        {
          x: directive.camera.initial_look_at[0],
          y: directive.camera.initial_look_at[1],
          z: directive.camera.initial_look_at[2],
        },
        0,
      );
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to position 3D camera'));
    }
  }, [directive.camera, nodes.length, onError]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    onSelectNode?.(node.id);

    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const distance = Math.max(4, 12 * node.baseScale * directive.camera.distance_factor);
    const divisor = Math.hypot(node.x ?? 0, node.y ?? 0, node.z ?? 0) || 1;

    graph.cameraPosition(
      {
        x: (node.x ?? 0) + ((node.x ?? 0) / divisor) * distance,
        y: (node.y ?? 0) + ((node.y ?? 0) / divisor) * distance,
        z: (node.z ?? 0) + ((node.z ?? 0) / divisor) * distance,
      },
      {
        x: node.x ?? 0,
        y: node.y ?? 0,
        z: node.z ?? 0,
      },
      directive.camera.transition_duration_ms,
    );
  }, [directive.camera, onSelectNode]);

  return (
    <div className="theseus-interactive" style={{ position: 'absolute', inset: 0 }}>
      <ForceGraph3D<GraphNode, GraphLink>
        ref={graphRef}
        width={width}
        height={height}
        backgroundColor="#0f1012"
        graphData={graphData}
        warmupTicks={directive.force_config.warmup_ticks}
        cooldownTicks={0}
        nodeOpacity={1}
        linkOpacity={0.35}
        nodeThreeObject={(node) => node.__threeObject ?? createNodeObject(node, node.showLabel)}
        linkWidth={(link) => link.width * clamp(link.drawProgress)}
        linkColor={(link) => link.color}
        linkVisibility={(link) => link.drawProgress > 0.01}
        linkThreeObject={buildLinkOverlay}
        linkThreeObjectExtend
        linkPositionUpdate={(object, { start, end }, link) => {
          if (!(object instanceof THREE.Line)) {
            return false;
          }

          const progress = clamp(link.drawProgress);
          const positions = object.geometry.getAttribute('position') as THREE.BufferAttribute;
          positions.setXYZ(0, start.x, start.y, start.z);
          positions.setXYZ(
            1,
            start.x + (end.x - start.x) * progress,
            start.y + (end.y - start.y) * progress,
            start.z + (end.z - start.z) * progress,
          );
          positions.needsUpdate = true;
          object.computeLineDistances();
          return true;
        }}
        nodeLabel={buildTooltip}
        onNodeHover={(node) => setHoveredNodeId(node?.id ?? null)}
        onNodeClick={handleNodeClick}
        showPointerCursor={(item) => Boolean(item)}
        enableNavigationControls
        d3AlphaDecay={directive.force_config.simulation_alpha_decay}
      />

      {hoveredNodeId && (
        <div
          style={{
            position: 'absolute',
            right: 24,
            top: 24,
            padding: '6px 10px',
            borderRadius: 999,
            background: 'rgba(15,16,18,0.72)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#E8E5E0',
            fontFamily: 'var(--vie-font-mono)',
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            pointerEvents: 'none',
          }}
        >
          {hoveredNodeId}
        </div>
      )}
    </div>
  );
}
