import type { CosmoLink } from '@/components/theseus/explorer/useGraphData';

/**
 * Keep the top-K strongest edges per node (by `weight`). An edge is kept
 * if it is in the top-K of *either* endpoint, so hub nodes don't lose
 * all connections and peripheral nodes keep their few links.
 *
 * At 3000 nodes / 83K edges, K=4 reduces the set to roughly 10-14K
 * without disconnecting any community. Exposed as a parameter for
 * tuning in CosmosGraphCanvas.
 */
export function topKPerNode(links: CosmoLink[], K: number): CosmoLink[] {
  if (K <= 0 || links.length === 0) return links;

  const perNode = new Map<string, CosmoLink[]>();
  const push = (key: string, link: CosmoLink) => {
    const list = perNode.get(key);
    if (list) {
      list.push(link);
    } else {
      perNode.set(key, [link]);
    }
  };
  for (const link of links) {
    push(link.source, link);
    push(link.target, link);
  }

  const kept = new Set<CosmoLink>();
  for (const list of perNode.values()) {
    if (list.length <= K) {
      for (const l of list) kept.add(l);
      continue;
    }
    list.sort((a, b) => b.weight - a.weight);
    for (let i = 0; i < K; i++) kept.add(list[i]);
  }

  return Array.from(kept);
}
