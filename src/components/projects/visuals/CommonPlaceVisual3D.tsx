'use client';

import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/* ---- Tree Data ---- */

interface TreeNode {
  id: string;
  label: string;
  color: string;
  depth: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface TreeLink {
  source: string | TreeNode;
  target: string | TreeNode;
}

function buildTree(): { nodes: TreeNode[]; links: TreeLink[] } {
  const nodes: TreeNode[] = [
    /* Root */
    { id: 'root', label: 'CommonPlace', color: '#2D5F6B', depth: 0 },
    /* Level 1: object types */
    { id: 'source',  label: 'Source',   color: '#1A7A8A', depth: 1 },
    { id: 'claim',   label: 'Claim',    color: '#3858B8', depth: 1 },
    { id: 'concept', label: 'Concept',  color: '#7050A0', depth: 1 },
    { id: 'tension', label: 'Tension',  color: '#B85C28', depth: 1 },
    { id: 'note',    label: 'Note',     color: '#68666E', depth: 1 },
    { id: 'hunch',   label: 'Hunch',    color: '#C07040', depth: 1 },
    { id: 'model',   label: 'Model',    color: '#C4503C', depth: 1 },
    { id: 'data',    label: 'Data',     color: '#4A7A5A', depth: 1 },
    /* Level 2: features (2-3 per type) */
    { id: 'src-pdf',   label: 'PDF',         color: '#1A7A8A', depth: 2 },
    { id: 'src-ocr',   label: 'OCR',         color: '#1A7A8A', depth: 2 },
    { id: 'src-meta',  label: 'Metadata',    color: '#1A7A8A', depth: 2 },
    { id: 'clm-nli',   label: 'NLI',         color: '#3858B8', depth: 2 },
    { id: 'clm-dedup', label: 'Dedup',       color: '#3858B8', depth: 2 },
    { id: 'con-ner',   label: 'NER',         color: '#7050A0', depth: 2 },
    { id: 'con-graph', label: 'Graph',       color: '#7050A0', depth: 2 },
    { id: 'ten-contra',label: 'Contradict',  color: '#B85C28', depth: 2 },
    { id: 'ten-div',   label: 'Diverge',     color: '#B85C28', depth: 2 },
    { id: 'note-time', label: 'Timeline',    color: '#68666E', depth: 2 },
    { id: 'note-immut',label: 'Immutable',   color: '#68666E', depth: 2 },
    { id: 'hun-low',   label: 'Low-conf',    color: '#C07040', depth: 2 },
    { id: 'hun-promo', label: 'Promote',     color: '#C07040', depth: 2 },
    { id: 'mod-assume',label: 'Assumptions', color: '#C4503C', depth: 2 },
    { id: 'mod-stress',label: 'Stress Test', color: '#C4503C', depth: 2 },
    { id: 'dat-pgv',   label: 'pgvector',    color: '#4A7A5A', depth: 2 },
    { id: 'dat-embed', label: 'Embeddings',  color: '#4A7A5A', depth: 2 },
  ];

  const links: TreeLink[] = [
    /* Root to types */
    { source: 'root', target: 'source' },
    { source: 'root', target: 'claim' },
    { source: 'root', target: 'concept' },
    { source: 'root', target: 'tension' },
    { source: 'root', target: 'note' },
    { source: 'root', target: 'hunch' },
    { source: 'root', target: 'model' },
    { source: 'root', target: 'data' },
    /* Types to features */
    { source: 'source', target: 'src-pdf' },
    { source: 'source', target: 'src-ocr' },
    { source: 'source', target: 'src-meta' },
    { source: 'claim', target: 'clm-nli' },
    { source: 'claim', target: 'clm-dedup' },
    { source: 'concept', target: 'con-ner' },
    { source: 'concept', target: 'con-graph' },
    { source: 'tension', target: 'ten-contra' },
    { source: 'tension', target: 'ten-div' },
    { source: 'note', target: 'note-time' },
    { source: 'note', target: 'note-immut' },
    { source: 'hunch', target: 'hun-low' },
    { source: 'hunch', target: 'hun-promo' },
    { source: 'model', target: 'mod-assume' },
    { source: 'model', target: 'mod-stress' },
    { source: 'data', target: 'dat-pgv' },
    { source: 'data', target: 'dat-embed' },
  ];

  return { nodes, links };
}

/* ---- Component ---- */

interface Props {
  isHovered: boolean;
}

export default function CommonPlaceVisual3D({ isHovered }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;
  const simRef = useRef<d3.Simulation<TreeNode, TreeLink> | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { nodes, links } = buildTree();

    /* ---- Sizing ---- */
    function getSize() {
      const rect = canvas!.getBoundingClientRect();
      return { w: rect.width, h: rect.height };
    }

    function resize() {
      const { w, h } = getSize();
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = w + 'px';
      canvas!.style.height = h + 'px';
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();

    /* ---- D3 Force Simulation ---- */
    const { w, h } = getSize();

    const simulation = d3.forceSimulation<TreeNode>(nodes)
      .force('link', d3.forceLink<TreeNode, TreeLink>(links)
        .id((d) => d.id)
        .distance((d) => {
          const src = d.source as TreeNode;
          const tgt = d.target as TreeNode;
          if (src.depth === 0 || tgt.depth === 0) return 70;
          return 35;
        })
        .strength(0.8)
      )
      .force('charge', d3.forceManyBody<TreeNode>()
        .strength((d) => d.depth === 0 ? -300 : d.depth === 1 ? -80 : -30)
      )
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collide', d3.forceCollide<TreeNode>()
        .radius((d) => d.depth === 0 ? 22 : d.depth === 1 ? 14 : 8)
      )
      .alphaDecay(0.02)
      .velocityDecay(0.35);

    /* Pin root roughly center */
    const root = nodes.find((n) => n.id === 'root');
    if (root) {
      root.fx = w / 2;
      root.fy = h / 2;
    }

    simRef.current = simulation;

    /* ---- Render ---- */

    let animId = 0;

    function draw() {
      if (!canvas || !ctx) return;
      const { w: cw, h: ch } = getSize();
      ctx.clearRect(0, 0, cw, ch);

      const showLabels = hoveredRef.current;

      /* Draw links */
      for (const link of links) {
        const src = link.source as TreeNode;
        const tgt = link.target as TreeNode;
        if (src.x == null || tgt.x == null) continue;

        ctx.beginPath();
        ctx.moveTo(src.x, src.y!);
        ctx.lineTo(tgt.x, tgt.y!);

        /* Depth-based opacity: root links brighter */
        const isRootLink = src.depth === 0 || tgt.depth === 0;
        ctx.strokeStyle = isRootLink
          ? 'rgba(45, 95, 107, 0.25)'
          : 'rgba(45, 95, 107, 0.12)';
        ctx.lineWidth = isRootLink ? 1.5 : 0.8;
        ctx.stroke();
      }

      /* Draw nodes */
      for (const node of nodes) {
        if (node.x == null) continue;
        const r = node.depth === 0 ? 16 : node.depth === 1 ? 8 : 4;

        /* Glow for depth-0 and depth-1 */
        if (node.depth < 2) {
          ctx.beginPath();
          ctx.arc(node.x, node.y!, r + (node.depth === 0 ? 10 : 5), 0, Math.PI * 2);
          ctx.fillStyle = node.color + (node.depth === 0 ? '18' : '0C');
          ctx.fill();
        }

        /* Node circle */
        ctx.beginPath();
        ctx.arc(node.x, node.y!, r, 0, Math.PI * 2);
        ctx.fillStyle = node.color + (node.depth === 2 ? '80' : 'CC');
        ctx.fill();

        /* Thin border on depth-1 nodes */
        if (node.depth === 1) {
          ctx.strokeStyle = node.color + '40';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        /* Labels */
        const alwaysLabel = node.depth === 0;
        if (alwaysLabel || (showLabels && node.depth <= 1)) {
          ctx.font = node.depth === 0
            ? '600 11px "JetBrains Mono", monospace'
            : '500 8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = node.color;
          ctx.fillText(node.label, node.x, node.y! + r + (node.depth === 0 ? 14 : 11));
        }

        /* Leaf labels only on hover */
        if (showLabels && node.depth === 2) {
          ctx.font = '400 6.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = node.color + '90';
          ctx.fillText(node.label, node.x, node.y! + r + 8);
        }
      }
    }

    /* Simulation tick handler */
    simulation.on('tick', () => {
      draw();
    });

    /* Animation loop for hover reheat and continuous rendering */
    function frame() {
      /* Gently reheat on hover so the tree breathes */
      if (hoveredRef.current && simulation.alpha() < 0.15) {
        simulation.alpha(0.15).restart();
      }
      animId = requestAnimationFrame(frame);
    }

    if (!prefersReducedMotion) {
      animId = requestAnimationFrame(frame);
    }

    /* Let simulation settle, then draw static frame for reduced-motion */
    if (prefersReducedMotion) {
      simulation.tick(120);
      draw();
      simulation.stop();
    }

    const handleResize = () => {
      resize();
      const { w: nw, h: nh } = getSize();
      const centerForce = simulation.force('center') as d3.ForceCenter<TreeNode> | undefined;
      if (centerForce) {
        centerForce.x(nw / 2).y(nh / 2);
      }
      if (root) {
        root.fx = nw / 2;
        root.fy = nh / 2;
      }
      simulation.alpha(0.3).restart();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      simulation.stop();
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
      }}
    />
  );
}
