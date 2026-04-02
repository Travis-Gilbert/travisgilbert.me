import type { Metadata } from 'next';
import SectionLabel from '@/components/SectionLabel';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import VisualizationTabs from '@/components/research/VisualizationTabs';
import {
  transformGraphResponse,
  type APIGraphResponse,
  type GraphNode,
  type GraphEdge,
} from '@/lib/graph/connectionTransform';

export const metadata: Metadata = {
  title: 'Paper Trails',
  description:
    'An interactive graph of sources, essays, and field notes. See how research connects to writing.',
};

const INDEX_API =
  process.env.NEXT_PUBLIC_INDEX_API_URL ?? 'https://index-api-production-a5f7.up.railway.app';

async function fetchConnectionGraph(): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
}> {
  try {
    const res = await fetch(
      `${INDEX_API}/api/v1/connections/graph/?semantic=false`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return { nodes: [], edges: [] };
    const data: APIGraphResponse = await res.json();
    return transformGraphResponse(data);
  } catch {
    return { nodes: [], edges: [] };
  }
}

export default async function ResearchPage() {
  const { nodes: connectionNodes, edges: connectionEdges } =
    await fetchConnectionGraph();

  return (
    <>
      <section className="py-8">
        <SectionLabel color="teal">Research Network</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="magnifying-glass" size={32} color="var(--color-teal)" />
          Paper Trails
        </h1>
        <p className="text-ink-secondary mb-6 max-w-prose">
          Six ways to explore how sources, essays, and field notes connect.
          Each visualization highlights a different dimension of the research.
        </p>
      </section>

      <VisualizationTabs
        connectionNodes={connectionNodes}
        connectionEdges={connectionEdges}
      />
    </>
  );
}
