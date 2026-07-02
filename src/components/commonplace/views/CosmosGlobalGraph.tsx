'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Graph } from '@cosmos.gl/graph';
import type { GraphConfig } from '@cosmos.gl/graph';
import { getObjectTypeIdentity, type GraphLink, type GraphNode } from '@/lib/commonplace';
import styles from './GraphView.module.css';

const COMMUNITY_COLOR_TOKENS = [
  '--cp-teal',
  '--cp-gold',
  '--cp-purple',
  '--cp-red',
  '--cp-green',
  '--cp-blue',
  '--cp-pink',
  '--cp-steel',
  '--cp-orange',
  '--cp-text-muted',
];

type Rgba = [number, number, number, number];

interface ThemeGraphColors {
  communities: Rgba[];
  fallbackNode: Rgba;
  defaultLink: Rgba;
  tensionLink: Rgba;
  supportLink: Rgba;
  similarLink: Rgba;
  accentCss: string;
}

const FALLBACK_GRAPH_COLORS: ThemeGraphColors = {
  communities: [],
  fallbackNode: [0.42, 0.38, 0.34, 1],
  defaultLink: [0.42, 0.38, 0.34, 0.36],
  tensionLink: [0.65, 0.32, 0.14, 0.64],
  supportLink: [0.35, 0.48, 0.29, 0.58],
  similarLink: [0.55, 0.44, 0.63, 0.5],
  accentCss: 'currentColor',
};

interface CosmosGlobalGraphProps {
  graphNodes: GraphNode[];
  graphLinks: GraphLink[];
  selectedItems: Set<string>;
  onSelectNode?: (id: string) => void;
}

function nodeId(value: string | GraphNode): string {
  return typeof value === 'string' ? value : value.id;
}

function hashNumber(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unitPosition(id: string, axis: 'x' | 'y') {
  const hash = hashNumber(`${axis}:${id}`);
  return (hash / 0xffffffff - 0.5) * 900;
}

function rgbaWithAlpha(color: Rgba, alpha: number): Rgba {
  return [color[0], color[1], color[2], alpha];
}

function parseCssColor(value: string, alpha = 1): Rgba | null {
  const clean = value.trim();
  if (!clean) return null;
  const rgbMatch = clean.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch[1].split(',').map((part) => Number.parseFloat(part.trim()));
    if ([r, g, b].every(Number.isFinite)) return [r / 255, g / 255, b / 255, alpha];
  }
  if (!clean.startsWith('#')) return null;
  const tokenValue = clean.replace('#', '');
  const expanded = tokenValue.length === 3
    ? tokenValue.split('').map((char) => `${char}${char}`).join('')
    : tokenValue;
  const r = Number.parseInt(expanded.slice(0, 2), 16) / 255;
  const g = Number.parseInt(expanded.slice(2, 4), 16) / 255;
  const b = Number.parseInt(expanded.slice(4, 6), 16) / 255;
  if (![r, g, b].every(Number.isFinite)) return null;
  return [r, g, b, alpha];
}

function readThemeColors(host: HTMLElement): ThemeGraphColors {
  const themeRoot = host.closest('.commonplace-theme') ?? document.documentElement;
  const style = getComputedStyle(themeRoot);
  const read = (token: string, alpha = 1, fallback = FALLBACK_GRAPH_COLORS.fallbackNode) =>
    parseCssColor(style.getPropertyValue(token), alpha) ?? fallback;
  const accentCss = style.getPropertyValue('--cp-red').trim() || style.color || FALLBACK_GRAPH_COLORS.accentCss;
  return {
    communities: COMMUNITY_COLOR_TOKENS.map((token) => read(token)),
    fallbackNode: read('--cp-text-muted'),
    defaultLink: read('--cp-steel', 0.36, FALLBACK_GRAPH_COLORS.defaultLink),
    tensionLink: read('--cp-red', 0.64, FALLBACK_GRAPH_COLORS.tensionLink),
    supportLink: read('--cp-green', 0.58, FALLBACK_GRAPH_COLORS.supportLink),
    similarLink: read('--cp-purple', 0.5, FALLBACK_GRAPH_COLORS.similarLink),
    accentCss,
  };
}

function colorForNode(
  node: GraphNode,
  communityOrdinal: Map<string, number>,
  selectedItems: Set<string>,
  themeColors: ThemeGraphColors,
) {
  const hasSelection = selectedItems.size > 0;
  const selected = selectedItems.has(node.id) || (node.objectRef != null && selectedItems.has(String(node.objectRef)));
  const alpha = hasSelection && !selected ? 0.22 : 0.95;
  const community = node.communityId ?? node.objectType;
  const ordinal = communityOrdinal.get(community);
  const color = ordinal == null
    ? parseCssColor(getObjectTypeIdentity(node.objectType).color) ?? themeColors.fallbackNode
    : themeColors.communities[ordinal % themeColors.communities.length] ?? themeColors.fallbackNode;
  return rgbaWithAlpha(color, alpha);
}

function sizeForNode(node: GraphNode, maxCentrality: number) {
  const centrality = typeof node.centrality === 'number' ? node.centrality : undefined;
  if (centrality != null && maxCentrality > 0) {
    return 5 + Math.min(18, (centrality / maxCentrality) * 18);
  }
  return 5 + Math.min(12, Math.log2((node.edgeCount ?? 0) + 1) * 4);
}

function linkTone(link: GraphLink, themeColors: ThemeGraphColors): Rgba {
  const edgeType = (link.edge_type ?? '').toLowerCase();
  if (edgeType.includes('contradict') || edgeType.includes('tension')) return themeColors.tensionLink;
  if (edgeType.includes('support')) return themeColors.supportLink;
  if (edgeType.includes('similar')) return themeColors.similarLink;
  return themeColors.defaultLink;
}

export default function CosmosGlobalGraph({
  graphNodes,
  graphLinks,
  selectedItems,
  onSelectNode,
}: CosmosGlobalGraphProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const nodesRef = useRef<GraphNode[]>(graphNodes);
  const selectRef = useRef<typeof onSelectNode>(onSelectNode);
  const [readySize, setReadySize] = useState(false);
  const [themeColors, setThemeColors] = useState<ThemeGraphColors>(FALLBACK_GRAPH_COLORS);

  useEffect(() => {
    nodesRef.current = graphNodes;
    selectRef.current = onSelectNode;
  }, [graphNodes, onSelectNode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setReadySize(entry.contentRect.width > 4 && entry.contentRect.height > 4);
    });
    observer.observe(host);
    setThemeColors(readThemeColors(host));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !readySize || graphRef.current) return undefined;

    const config: GraphConfig = {
      backgroundColor: [0, 0, 0, 0],
      pointDefaultSize: 5,
      pointSizeScale: 1,
      pointOpacity: 1,
      linkDefaultColor: themeColors.defaultLink,
      linkDefaultWidth: 1,
      linkOpacity: 1,
      curvedLinks: true,
      curvedLinkSegments: 12,
      renderHoveredPointRing: true,
      hoveredPointRingColor: themeColors.accentCss,
      focusedPointRingColor: themeColors.accentCss,
      hoveredPointCursor: 'pointer',
      simulationGravity: 0.18,
      simulationRepulsion: 0.9,
      simulationLinkSpring: 0.72,
      simulationLinkDistance: 18,
      fitViewOnInit: true,
      fitViewDelay: 260,
      fitViewPadding: 0.16,
      onPointClick: (index) => {
        if (index == null) return;
        const node = nodesRef.current[index];
        if (node) selectRef.current?.(node.id);
      },
    };

    const graph = new Graph(host, config);
    graphRef.current = graph;

    return () => {
      graph.destroy();
      graphRef.current = null;
    };
  }, [readySize, themeColors]);

  const buffers = useMemo(() => {
    const indexById = new Map(graphNodes.map((node, index) => [node.id, index]));
    const communities = Array.from(new Set(graphNodes.map((node) => node.communityId ?? node.objectType)));
    const communityOrdinal = new Map(communities.map((community, index) => [community, index]));
    const maxCentrality = graphNodes.reduce(
      (max, node) => Math.max(max, typeof node.centrality === 'number' ? node.centrality : 0),
      0,
    );
    const positions = new Float32Array(graphNodes.length * 2);
    const colors = new Float32Array(graphNodes.length * 4);
    const sizes = new Float32Array(graphNodes.length);

    graphNodes.forEach((node, index) => {
      positions[index * 2] = typeof node.x === 'number' ? node.x : unitPosition(node.id, 'x');
      positions[index * 2 + 1] = typeof node.y === 'number' ? node.y : unitPosition(node.id, 'y');
      colors.set(colorForNode(node, communityOrdinal, selectedItems, themeColors), index * 4);
      sizes[index] = sizeForNode(node, maxCentrality);
    });

    const validLinks = graphLinks
      .map((link) => ({
        link,
        source: indexById.get(nodeId(link.source)),
        target: indexById.get(nodeId(link.target)),
      }))
      .filter((entry): entry is { link: GraphLink; source: number; target: number } =>
        entry.source != null && entry.target != null,
      );
    const links = new Float32Array(validLinks.length * 2);
    const linkColors = new Float32Array(validLinks.length * 4);
    const linkWidths = new Float32Array(validLinks.length);

    validLinks.forEach((entry, index) => {
      links[index * 2] = entry.source;
      links[index * 2 + 1] = entry.target;
      linkColors.set(linkTone(entry.link, themeColors), index * 4);
      linkWidths[index] = 0.7 + Math.max(0, Math.min(1, entry.link.strength ?? 0.35)) * 2.8;
    });

    return { positions, colors, sizes, links, linkColors, linkWidths };
  }, [graphLinks, graphNodes, selectedItems, themeColors]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.setPointPositions(buffers.positions);
    graph.setPointColors(buffers.colors);
    graph.setPointSizes(buffers.sizes);
    graph.setLinks(buffers.links);
    graph.setLinkColors(buffers.linkColors);
    graph.setLinkWidths(buffers.linkWidths);
    graph.render(1);
    graph.start(0.45);
  }, [buffers]);

  if (graphNodes.length === 0) {
    return <div className={styles.empty}>No graph nodes are available.</div>;
  }

  return <div ref={hostRef} className={styles.cosmosHost} aria-label="Global graph" />;
}
