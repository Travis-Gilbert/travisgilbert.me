import type { Metadata } from 'next';
import { getItemBySlug } from '@/lib/studio-mock-data';
import { getContentTypeIdentity } from '@/lib/studio';
import Editor from '@/components/studio/Editor';

interface EditorPageProps {
  params: Promise<{ type: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: EditorPageProps): Promise<Metadata> {
  const { type, slug } = await params;
  const item = getItemBySlug(type, slug);
  const title = item
    ? item.title
    : slug.startsWith('new-')
      ? `New ${getContentTypeIdentity(type).label}`
      : slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return { title: `${title} | Studio` };
}

/**
 * Dynamic editor route.
 *
 * Loads mock content item by type + slug and renders the
 * full Tiptap editor with stage bar, toolbar, and word count.
 * Supports both existing items and new content creation
 * (slug starting with "new-" opens a blank editor).
 */
export default async function EditorPage({ params }: EditorPageProps) {
  const { type, slug } = await params;
  const item = getItemBySlug(type, slug);

  /* New content: blank editor with Idea stage */
  if (!item) {
    const typeInfo = getContentTypeIdentity(type);
    const isNew = slug.startsWith('new-');

    if (!isNew) {
      return (
        <div style={{ padding: '32px 40px' }}>
          <div className="studio-section-head">
            <span className="studio-section-label">Not Found</span>
            <span className="studio-section-line" />
          </div>
          <p
            style={{
              fontFamily: 'var(--studio-font-body)',
              fontSize: '14px',
              color: 'var(--studio-text-2)',
              marginTop: '16px',
            }}
          >
            No {type} found with slug &ldquo;{slug}&rdquo;.
          </p>
        </div>
      );
    }

    return (
      <Editor
        slug={slug}
        contentType={type}
        title={`Untitled ${typeInfo.label}`}
        initialContent=""
        initialStage="idea"
      />
    );
  }

  return (
    <Editor
      slug={item.slug}
      contentType={item.contentType}
      title={item.title}
      initialContent={item.body}
      initialStage={item.stage}
    />
  );
}
