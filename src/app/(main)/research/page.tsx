import type { Metadata } from 'next';
import { getCollection } from '@/lib/content';
import type { Essay, FieldNote, ShelfEntry, Project } from '@/lib/content';
import { computeThreadPairs, type AllContent } from '@/lib/connectionEngine';
import SectionLabel from '@/components/SectionLabel';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import VisualizationTabs from '@/components/research/VisualizationTabs';

export const metadata: Metadata = {
  title: 'Paper Trails',
  description:
    'An interactive graph of sources, essays, and field notes. See how research connects to writing.',
};

/** Map connection weight names to stroke widths (spec range: 0.5 to 1.5) */
const STROKE_MAP: Record<string, number> = {
  heavy: 1.5,
  medium: 1.0,
  light: 0.5,
};

export default function ResearchPage() {
  // ── Compute connection graph data (previously at /connections) ──

  const essays = getCollection<Essay>('essays').filter((e) => !e.data.draft);
  const fieldNotes = getCollection<FieldNote>('field-notes').filter(
    (n) => !n.data.draft,
  );
  const shelf = getCollection<ShelfEntry>('shelf');
  const projects = getCollection<Project>('projects').filter(
    (p) => !p.data.draft,
  );

  const content: AllContent = { essays, fieldNotes, shelf };
  const threadPairs = computeThreadPairs(content, 100);

  // Build node map
  type NodeType = 'essay' | 'field-note' | 'project' | 'shelf';
  interface NodeData {
    id: string;
    slug: string;
    title: string;
    type: NodeType;
    connectionCount: number;
    href: string;
  }

  const nodeMap = new Map<string, NodeData>();

  for (const e of essays) {
    nodeMap.set(`essay-${e.slug}`, {
      id: `essay-${e.slug}`,
      slug: e.slug,
      title: e.data.title,
      type: 'essay',
      connectionCount: 0,
      href: `/essays/${e.slug}`,
    });
  }

  for (const n of fieldNotes) {
    nodeMap.set(`field-note-${n.slug}`, {
      id: `field-note-${n.slug}`,
      slug: n.slug,
      title: n.data.title,
      type: 'field-note',
      connectionCount: 0,
      href: `/field-notes/${n.slug}`,
    });
  }

  for (const s of shelf) {
    nodeMap.set(`shelf-${s.slug}`, {
      id: `shelf-${s.slug}`,
      slug: s.slug,
      title: s.data.title,
      type: 'shelf',
      connectionCount: 0,
      href: '/shelf',
    });
  }

  for (const p of projects) {
    nodeMap.set(`project-${p.slug}`, {
      id: `project-${p.slug}`,
      slug: p.slug,
      title: p.data.title,
      type: 'project',
      connectionCount: 0,
      href: '/projects',
    });
  }

  // Build edges and count connections
  const connectionEdges = threadPairs
    .map((pair) => {
      const sourceId =
        pair.type === 'essay'
          ? `essay-${pair.fromSlug}`
          : pair.type === 'field-note'
            ? `field-note-${pair.fromSlug}`
            : `shelf-${pair.fromSlug}`;
      const targetId = `essay-${pair.toSlug}`;

      const src = nodeMap.get(sourceId);
      const tgt = nodeMap.get(targetId);
      if (src) src.connectionCount++;
      if (tgt) tgt.connectionCount++;

      return {
        source: sourceId,
        target: targetId,
        type: pair.type,
        strokeWidth: STROKE_MAP[pair.weight] ?? 1.0,
      };
    })
    .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target));

  const connectionNodes = [...nodeMap.values()];

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
