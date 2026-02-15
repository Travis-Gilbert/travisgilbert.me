import type { Metadata } from 'next';
import { Wrench } from '@phosphor-icons/react/dist/ssr';
import { getCollection, renderMarkdown } from '@/lib/content';
import type { ToolkitEntry } from '@/lib/content';
import RoughBox from '@/components/rough/RoughBox';

export const metadata: Metadata = {
  title: 'Toolkit',
  description: 'How I work: tools, processes, and philosophy.',
};

const categories = [
  { key: 'production', label: 'Production Workflow' },
  { key: 'tools', label: 'Tools I Use' },
  { key: 'philosophy', label: 'How I Think About Design' },
  { key: 'automation', label: 'AI & Automation' },
] as const;

export default async function ToolkitPage() {
  const toolkitItems = getCollection<ToolkitEntry>('toolkit').sort(
    (a, b) => a.data.order - b.data.order
  );

  // Pre-render all markdown content
  const renderedItems = await Promise.all(
    toolkitItems.map(async (item) => ({
      ...item,
      html: await renderMarkdown(item.body),
    }))
  );

  return (
    <>
      <section className="py-8">
        <h1 className="font-title-alt text-3xl md:text-4xl font-semibold mb-2 flex items-center gap-3">
          <Wrench size={32} className="text-terracotta" />
          Toolkit
        </h1>
        <p className="text-ink-secondary mb-8">
          How I work: tools, processes, and philosophy.
        </p>
      </section>

      {categories.map((cat) => {
        const items = renderedItems.filter(
          (item) => item.data.category === cat.key
        );
        if (items.length === 0) return null;

        return (
          <section key={cat.key} className="mb-12">
            <h2 className="font-title-alt text-2xl font-semibold mb-6">
              {cat.label}
            </h2>
            <div className="space-y-4">
              {items.map((item) => (
                <RoughBox key={item.slug} padding={24}>
                  <div>
                    <div
                      className="prose prose-toolkit"
                      dangerouslySetInnerHTML={{ __html: item.html }}
                    />
                  </div>
                </RoughBox>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
