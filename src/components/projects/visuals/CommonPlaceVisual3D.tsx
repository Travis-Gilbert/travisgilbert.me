'use client';

import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/*
 * Pure D3 force-directed tree on Canvas 2D.
 * ~300 nodes for dense branching. Interactive drag on nodes.
 * Observable canonical pattern: distance(0), strength(1), charge(-50).
 *
 * No R3F. No Three.js. D3 handles layout, simulation, drag, and rendering.
 */

/* ---- Seeded PRNG ---- */

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- Build a deep tree with ~300 nodes ---- */

interface RawNode {
  name: string;
  children?: RawNode[];
}

function buildTree(): RawNode {
  const rng = mulberry32(42);

  function leafCluster(n: number): RawNode[] {
    return Array.from({ length: n }, () => ({ name: '' }));
  }

  function sub(name: string, leafRange: [number, number]): RawNode {
    const n = leafRange[0] + Math.floor(rng() * (leafRange[1] - leafRange[0] + 1));
    return { name, children: leafCluster(n) };
  }

  function typeBranch(name: string, subs: RawNode[]): RawNode {
    return { name, children: subs };
  }

  return {
    name: 'CommonPlace',
    children: [
      typeBranch('Source', [
        sub('PDF', [4, 7]), sub('OCR', [3, 6]), sub('Meta', [3, 5]),
        sub('SHA', [2, 4]), sub('URL', [2, 4]),
      ]),
      typeBranch('Claim', [
        sub('NLI', [4, 7]), sub('Dedup', [3, 5]), sub('Status', [3, 5]),
        sub('Pair', [3, 6]), sub('Index', [2, 4]),
      ]),
      typeBranch('Concept', [
        sub('NER', [5, 8]), sub('Phrase', [4, 6]), sub('Graph', [3, 5]),
        sub('Match', [3, 5]),
      ]),
      typeBranch('Tension', [
        sub('Contra', [4, 7]), sub('Diverge', [3, 5]),
        sub('Temporal', [3, 5]), sub('Tag', [2, 4]),
      ]),
      typeBranch('Note', [
        sub('Timeline', [3, 6]), sub('Immutable', [3, 5]),
        sub('Fork', [2, 4]), sub('Retro', [2, 4]),
      ]),
      typeBranch('Hunch', [
        sub('Low', [3, 5]), sub('Promote', [3, 6]),
        sub('Score', [2, 4]), sub('Evidence', [2, 4]),
      ]),
      typeBranch('Model', [
        sub('Assume', [4, 7]), sub('Stress', [3, 5]),
        sub('Propose', [3, 5]), sub('Confirm', [3, 5]),
      ]),
      typeBranch('Data', [
        sub('pgvec', [3, 6]), sub('Embed', [3, 5]),
        sub('PostGIS', [2, 4]), sub('Redis', [2, 4]),
      ]),
    ],
  };
}

/* ---- Types for D3 simulation ---- */

interface SimNode extends d3.SimulationNodeDatum {
  depth: number;
  data: RawNode;
  children?: SimNode[];
}

/* ---- Component ---- */

interface Props {
  isHovered: boolean;
}

export default function CommonPlaceVisual3D({ isHovered }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* ---- Build hierarchy ---- */
    const treeData = buildTree();
    const root = d3.hierarchy(treeData);
    const links = root.links();
    const nodes = root.descendants() as unknown as SimNode[];

    /* Tag depth for rendering */
    nodes.forEach((n) => {
      const hn = n as unknown as d3.HierarchyNode<RawNode>;
      n.depth = hn.depth;
      n.data = hn.data;
      n.children = (hn.children as unknown as SimNode[]) ?? undefined;
    });

    /* ---- Sizing ---- */
    let W = 0;
    let H = 0;
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();

    /* ---- D3 Simulation: Observable canonical pattern ---- */
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id((_d, i) => String(i))
        .distance(0)
        .strength(1))
      .force('charge', d3.forceManyBody().strength(-50))
      .force('x', d3.forceX())
      .force('y', d3.forceY());

    /* ---- Render ---- */

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      ctx.save();
      ctx.translate(W / 2, H / 2);

      /* Links */
      ctx.strokeStyle = '#99999966';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const link of links) {
        const s = link.source as unknown as SimNode;
        const t = link.target as unknown as SimNode;
        ctx.moveTo(s.x!, s.y!);
        ctx.lineTo(t.x!, t.y!);
      }
      ctx.stroke();

      /* Nodes */
      for (const node of nodes) {
        const isLeaf = !node.children || node.children.length === 0;
        const isRoot = node.depth === 0;
        const r = isRoot ? 6 : node.depth === 1 ? 4.5 : isLeaf ? 2.8 : 3.5;

        ctx.beginPath();
        ctx.arc(node.x!, node.y!, r, 0, Math.PI * 2);

        if (isLeaf) {
          /* Filled (Observable leaf style) */
          ctx.fillStyle = '#2C2824';
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        } else {
          /* Hollow parent (Observable parent style) */
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = '#2C2824';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      /* Labels: root always, depth-1 when hovered */
      const showLabels = hoveredRef.current;
      for (const node of nodes) {
        const isRoot = node.depth === 0;
        if (isRoot || (showLabels && node.depth === 1)) {
          if (!node.data.name) continue;
          const r = isRoot ? 6 : 4.5;
          ctx.font = isRoot
            ? '600 11px "JetBrains Mono", monospace'
            : '500 8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = isRoot ? '#2D5F6B' : '#5C5650';
          ctx.fillText(node.data.name, node.x!, node.y! - r - 5);
        }
      }

      ctx.restore();
    }

    simulation.on('tick', draw);

    /* ---- Drag interaction ---- */

    function findNode(mx: number, my: number): SimNode | undefined {
      /* Convert mouse coords to simulation space (centered) */
      const sx = mx - W / 2;
      const sy = my - H / 2;
      let closest: SimNode | undefined;
      let closestDist = Infinity;
      for (const node of nodes) {
        const dx = node.x! - sx;
        const dy = node.y! - sy;
        const dist = dx * dx + dy * dy;
        const r = node.depth === 0 ? 10 : node.depth === 1 ? 8 : 6;
        if (dist < r * r && dist < closestDist) {
          closest = node;
          closestDist = dist;
        }
      }
      return closest;
    }

    let dragNode: SimNode | null = null;

    function onPointerDown(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const found = findNode(mx, my);
      if (found) {
        dragNode = found;
        dragNode.fx = dragNode.x;
        dragNode.fy = dragNode.y;
        simulation.alphaTarget(0.3).restart();
        canvas!.style.cursor = 'grabbing';
        e.preventDefault();
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragNode) return;
      const rect = canvas!.getBoundingClientRect();
      dragNode.fx = e.clientX - rect.left - W / 2;
      dragNode.fy = e.clientY - rect.top - H / 2;
      e.preventDefault();
    }

    function onPointerUp() {
      if (!dragNode) return;
      simulation.alphaTarget(0);
      dragNode.fx = null;
      dragNode.fy = null;
      dragNode = null;
      canvas!.style.cursor = 'grab';
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.style.cursor = 'grab';

    /* ---- Hover reheat ---- */
    let animId = 0;
    function frame() {
      if (hoveredRef.current && simulation.alpha() < 0.08 && !dragNode) {
        simulation.alpha(0.08).restart();
      }
      animId = requestAnimationFrame(frame);
    }

    if (!prefersReducedMotion) {
      animId = requestAnimationFrame(frame);
    } else {
      simulation.tick(300);
      draw();
      simulation.stop();
    }

    const handleResize = () => {
      resize();
      simulation.alpha(0.3).restart();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      simulation.stop();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', handleResize);
    };
  }, [prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        background: 'transparent',
        touchAction: 'none',
      }}
    />
  );
}
