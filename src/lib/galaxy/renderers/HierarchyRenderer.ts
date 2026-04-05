/**
 * HierarchyRenderer: Top-down tree with thick branches.
 *
 * "Should I learn Python or JavaScript first?" renders as a branching
 * decision tree. Root at top, leaves at bottom. Each node is a filled
 * circle, branches are thick lines.
 *
 * Hard edges, flat fills, no AA. Designed for stippling, not viewing.
 */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { OffscreenRenderResult, IdEntry } from './types';
import { createCanvasPair, indexToHex, OFFSCREEN_SIZE, centerOutwardPhaseTemplate } from './types';

interface TreeNode {
  id: string;
  children: TreeNode[];
  depth: number;
  x: number;
  y: number;
}

function buildTree(nodes: EvidenceNode[], edges: EvidenceEdge[]): TreeNode {
  const nodeMap = new Map(nodes.map((n) => [n.object_id, n]));
  const childMap = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const edge of edges) {
    const children = childMap.get(edge.from_id) ?? [];
    children.push(edge.to_id);
    childMap.set(edge.from_id, children);
    hasParent.add(edge.to_id);
  }

  // Find root: node with no parent
  let rootId = nodes.find((n) => !hasParent.has(n.object_id))?.object_id;
  if (!rootId) rootId = nodes[0]?.object_id ?? 'root';

  function makeTreeNode(id: string, depth: number, visited: Set<string>): TreeNode {
    visited.add(id);
    const childIds = childMap.get(id) ?? [];
    const children = childIds
      .filter((cid) => !visited.has(cid))
      .map((cid) => makeTreeNode(cid, depth + 1, visited));
    return { id, children, depth, x: 0, y: 0 };
  }

  return makeTreeNode(rootId, 0, new Set());
}

function layoutTree(root: TreeNode, width: number, height: number): void {
  // Compute max depth
  let maxDepth = 0;
  function findMaxDepth(node: TreeNode): void {
    if (node.depth > maxDepth) maxDepth = node.depth;
    for (const child of node.children) findMaxDepth(child);
  }
  findMaxDepth(root);

  const padX = width * 0.1;
  const padY = height * 0.12;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const depthStep = maxDepth > 0 ? usableH / maxDepth : 0;

  // Assign Y by depth, X by breadth position at each level
  function assignPositions(node: TreeNode, xMin: number, xMax: number): void {
    node.y = padY + node.depth * depthStep;
    node.x = (xMin + xMax) / 2;

    if (node.children.length === 0) return;
    const childWidth = (xMax - xMin) / node.children.length;
    for (let i = 0; i < node.children.length; i++) {
      assignPositions(node.children[i], xMin + i * childWidth, xMin + (i + 1) * childWidth);
    }
  }

  assignPositions(root, padX, padX + usableW);
}

function collectNodes(root: TreeNode): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(node: TreeNode): void {
    result.push(node);
    for (const child of node.children) walk(child);
  }
  walk(root);
  return result;
}

export function renderHierarchy(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): OffscreenRenderResult {
  const { visual, visualCtx, idMap, idCtx } = createCanvasPair();
  const S = OFFSCREEN_SIZE;
  const idLegend = new Map<string, IdEntry>();

  const root = buildTree(nodes, edges);
  layoutTree(root, S, S);
  const allTreeNodes = collectNodes(root);

  const nodeRadius = Math.min(S * 0.04, S / (allTreeNodes.length * 1.5));
  const branchWidth = Math.max(3, nodeRadius * 0.3);

  // Draw branches first (behind nodes)
  function drawBranches(node: TreeNode): void {
    for (const child of node.children) {
      visualCtx.strokeStyle = '#aaaaaa';
      visualCtx.lineWidth = branchWidth;
      visualCtx.beginPath();
      visualCtx.moveTo(node.x, node.y);
      visualCtx.lineTo(child.x, child.y);
      visualCtx.stroke();
      drawBranches(child);
    }
  }
  drawBranches(root);

  // Draw nodes as filled circles
  for (let i = 0; i < allTreeNodes.length; i++) {
    const tn = allTreeNodes[i];

    // Visual: white, root slightly larger
    const r = tn.depth === 0 ? nodeRadius * 1.4 : nodeRadius;
    visualCtx.fillStyle = '#ffffff';
    visualCtx.beginPath();
    visualCtx.arc(tn.x, tn.y, r, 0, Math.PI * 2);
    visualCtx.fill();

    // ID map
    const hex = indexToHex(i);
    idCtx.fillStyle = hex;
    idCtx.beginPath();
    idCtx.arc(tn.x, tn.y, r, 0, Math.PI * 2);
    idCtx.fill();
    idLegend.set(hex, { nodeId: tn.id });
  }

  // Phase: center-outward (root resolves first, leaves last)
  const maxDepth = Math.max(1, ...allTreeNodes.map((n) => n.depth));
  const phaseTemplate = centerOutwardPhaseTemplate(16, Math.min(5, maxDepth + 1));

  return { visual, idMap, idLegend, phaseTemplate };
}
