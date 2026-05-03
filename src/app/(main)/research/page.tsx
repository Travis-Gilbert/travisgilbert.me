import type { Metadata } from 'next';
import SectionLabel from '@/components/SectionLabel';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import VisualizationTabs from '@/components/research/VisualizationTabs';
import { fetchPublicIndexJson } from '@/lib/index-api';
import type { ActivityDay, GraphResponse, ThreadListItem } from '@/lib/research';

export const metadata: Metadata = {
  title: 'Paper Trails',
  description:
    'An interactive graph of sources, essays, and field notes. See how research connects to writing.',
};

type PaperTrailState =
  | {
      status: 'ready';
      graph: GraphResponse;
      activity: ActivityDay[];
      threads: ThreadListItem[];
    }
  | {
      status: 'empty';
      graph: GraphResponse;
      activity: ActivityDay[];
      threads: ThreadListItem[];
    }
  | { status: 'unavailable' };

async function fetchPaperTrailData(): Promise<PaperTrailState> {
  try {
    const [graph, activity, threads] = await Promise.all([
      fetchPublicIndexJson<GraphResponse>('/api/v2/paper-trail/graph/'),
      fetchPublicIndexJson<ActivityDay[]>('/api/v2/paper-trail/activity/?days=365'),
      fetchPublicIndexJson<ThreadListItem[]>('/api/v2/paper-trail/threads/?status=active'),
    ]);

    if (
      graph.nodes.length === 0 &&
      graph.edges.length === 0 &&
      activity.length === 0 &&
      threads.length === 0
    ) {
      return { status: 'empty', graph, activity, threads };
    }

    return { status: 'ready', graph, activity, threads };
  } catch {
    return { status: 'unavailable' };
  }
}

export default async function ResearchPage() {
  const paperTrail = await fetchPaperTrailData();

  return (
    <>
      <section className="py-8">
        <SectionLabel color="teal">Research Network</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="magnifying-glass" size={32} color="var(--color-teal)" />
          Paper Trails
        </h1>
        <p className="text-ink-secondary mb-6 max-w-prose">
          Source-backed views of the essays and field notes that have been
          published into the public Paper Trails API.
        </p>
      </section>

      {paperTrail.status === 'unavailable' && (
        <PaperTrailStateNotice message="Index API is unavailable." />
      )}

      {paperTrail.status === 'empty' && (
        <PaperTrailStateNotice message="Index API has no public Paper Trails records yet." />
      )}

      {paperTrail.status === 'ready' && (
        <VisualizationTabs
          graph={paperTrail.graph}
          activity={paperTrail.activity}
          threads={paperTrail.threads}
        />
      )}
    </>
  );
}

function PaperTrailStateNotice({ message }: { message: string }) {
  return (
    <div className="border border-border bg-surface px-4 py-5">
      <p className="font-body-alt text-sm text-ink-secondary">{message}</p>
    </div>
  );
}
