import type { Metadata } from 'next';
import type { StudioContentItem } from '@/lib/studio';
import { fetchContentItem } from '@/lib/studio-api';
import {
  getContentTypeIdentity,
  normalizeStudioContentType,
} from '@/lib/studio';
import Editor from '@/components/studio/Editor';

interface EditorPageProps {
  params: Promise<{ type: string; slug: string }>;
}

async function loadContentItem(
  contentType: string,
  slug: string,
): Promise<StudioContentItem | null> {
  try {
    return await fetchContentItem(contentType, slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: EditorPageProps): Promise<Metadata> {
  const { type, slug } = await params;
  const normalizedType = normalizeStudioContentType(type);
  const item = await loadContentItem(normalizedType, slug);

  const title = item
    ? item.title
    : slug.startsWith('new-')
      ? `New ${getContentTypeIdentity(normalizedType).label}`
      : slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return { title: `${title} | Studio` };
}

/**
 * Dynamic editor route.
 */
export default async function EditorPage({ params }: EditorPageProps) {
  const { type, slug } = await params;
  const normalizedType = normalizeStudioContentType(type);
  const item = await loadContentItem(normalizedType, slug);

  if (!item) {
    const typeInfo = getContentTypeIdentity(normalizedType);
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
            No {typeInfo.label.toLowerCase()} found with slug &ldquo;{slug}&rdquo;.
          </p>
        </div>
      );
    }

    return (
      <Editor
        slug={slug}
        contentType={normalizedType}
        title={`Untitled ${typeInfo.label}`}
        initialContent=""
        initialStage="idea"
        contentItem={null}
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
      contentItem={item}
    />
  );
}
