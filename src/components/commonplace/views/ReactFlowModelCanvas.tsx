'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getObjectTypeIdentity, type GraphLink, type GraphNode } from '@/lib/commonplace';
import styles from './GraphView.module.css';

interface ReactFlowModelCanvasProps {
  graphNodes: GraphNode[];
  graphLinks: GraphLink[];
  selectedItems: Set<string>;
  onSelectNode?: (id: string) => void;
}

interface ModelNodeData extends Record<string, unknown> {
  title: string;
  objectType: string;
  communityId: string;
  centrality: number;
  edgeCount: number;
  color: string;
}

type ModelNode = Node<ModelNodeData, 'commonplaceModel'>;
type ModelEdge = Edge;

function nodeId(value: string | GraphNode): string {
  return typeof value === 'string' ? value : value.id;
}

function nodeRank(node: GraphNode) {
  return (node.centrality ?? 0) * 100 + node.edgeCount;
}

function buildNeighborMap(graphLinks: GraphLink[]) {
  const neighbors = new Map<string, Set<string>>();
  for (const link of graphLinks) {
    const source = nodeId(link.source);
    const target = nodeId(link.target);
    if (!neighbors.has(source)) neighbors.set(source, new Set());
    if (!neighbors.has(target)) neighbors.set(target, new Set());
    neighbors.get(source)?.add(target);
    neighbors.get(target)?.add(source);
  }
  return neighbors;
}

function visibleSeedIds(graphNodes: GraphNode[], selectedItems: Set<string>) {
  if (selectedItems.size > 0) {
    const selected = graphNodes
      .filter((node) => selectedItems.has(node.id) || (node.objectRef != null && selectedItems.has(String(node.objectRef))))
      .map((node) => node.id);
    if (selected.length > 0) return selected;
  }
  return [...graphNodes]
    .sort((a, b) => nodeRank(b) - nodeRank(a))
    .slice(0, 14)
    .map((node) => node.id);
}

function flowPosition(index: number, total: number) {
  const radius = Math.max(190, Math.min(420, total * 22));
  const angle = total <= 1 ? 0 : (index / total) * Math.PI * 2 - Math.PI / 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function ModelNodeView({ data, selected }: NodeProps<ModelNode>) {
  const style = { '--node-color': data.color } as CSSProperties;
  return (
    <div className={styles.flowNode} style={style} data-selected={selected ? 'true' : 'false'}>
      <strong title={data.title}>{data.title}</strong>
      <span>{data.objectType} · {data.communityId}</span>
      <span>{data.edgeCount} links · {Math.round(data.centrality * 100) / 100}</span>
    </div>
  );
}

const nodeTypes = { commonplaceModel: ModelNodeView };

export default function ReactFlowModelCanvas({
  graphNodes,
  graphLinks,
  selectedItems,
  onSelectNode,
}: ReactFlowModelCanvasProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [nodes, setNodes, onNodesChange] = useNodesState<ModelNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ModelEdge>([]);
  const neighborMap = useMemo(() => buildNeighborMap(graphLinks), [graphLinks]);
  const nodeById = useMemo(() => new Map(graphNodes.map((node) => [node.id, node])), [graphNodes]);

  const model = useMemo(() => {
    const visibleIds = new Set([...visibleSeedIds(graphNodes, selectedItems), ...expandedIds]);
    for (const id of [...expandedIds]) {
      for (const neighbor of neighborMap.get(id) ?? []) visibleIds.add(neighbor);
    }
    const visibleNodes = [...visibleIds]
      .map((id) => nodeById.get(id))
      .filter((node): node is GraphNode => !!node)
      .sort((a, b) => nodeRank(b) - nodeRank(a));

    const nextNodes: ModelNode[] = visibleNodes.map((node, index) => {
      const identity = getObjectTypeIdentity(node.objectType);
      const selected = selectedItems.has(node.id) || (node.objectRef != null && selectedItems.has(String(node.objectRef)));
      return {
        id: node.id,
        type: 'commonplaceModel',
        position: flowPosition(index, visibleNodes.length),
        selected,
        data: {
          title: node.title,
          objectType: identity.label,
          communityId: node.communityId ?? node.objectType,
          centrality: node.centrality ?? node.edgeCount,
          edgeCount: node.edgeCount,
          color: identity.color,
        },
      };
    });

    const nextEdges: ModelEdge[] = graphLinks
      .filter((link) => visibleIds.has(nodeId(link.source)) && visibleIds.has(nodeId(link.target)))
      .map((link, index) => {
        const source = nodeId(link.source);
        const target = nodeId(link.target);
        return {
          id: `${source}:${target}:${index}`,
          source,
          target,
          type: 'smoothstep',
          animated: (link.strength ?? 0) >= 0.7,
          label: link.edge_type ?? undefined,
          style: {
            strokeWidth: 1 + Math.max(0, Math.min(1, link.strength ?? 0.4)) * 2,
            stroke: 'var(--cp-text-faint)',
          },
        };
      });

    return { nodes: nextNodes, edges: nextEdges };
  }, [expandedIds, graphLinks, graphNodes, neighborMap, nodeById, selectedItems]);

  useEffect(() => {
    setNodes(model.nodes);
    setEdges(model.edges);
  }, [model, setEdges, setNodes]);

  const expandNode = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        for (const neighbor of neighborMap.get(id) ?? []) next.add(neighbor);
        return next;
      });
      onSelectNode?.(id);
    },
    [neighborMap, onSelectNode],
  );

  if (graphNodes.length === 0) {
    return <div className={styles.empty}>No graph nodes are available.</div>;
  }

  return (
    <div className={styles.flowHost}>
      <ReactFlow<ModelNode, ModelEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelectNode?.(node.id)}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          expandNode(node.id);
        }}
        fitView
        minZoom={0.18}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--cp-border-faint)" gap={28} />
        <MiniMap zoomable pannable />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
