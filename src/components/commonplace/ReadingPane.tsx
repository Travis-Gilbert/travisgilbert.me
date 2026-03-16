'use client';

/**
 * ReadingPane: type-aware reading surface for the Overview tab.
 *
 * Replaces the raw `<p>{detail.body}</p>` in ObjectDrawer/ObjectDetailView
 * with a structured reading experience:
 *
 *   1. Reading progress bar (sticky, 2px, red pencil fill)
 *   2. Provenance card for Source objects with OG metadata
 *   3. Metadata grid for PDFs/files (author, pages, publisher)
 *   4. Markdown rendering for body text (remark + remark-gfm + remark-html)
 *   5. TerminalBlock for Script objects (code body on dark surface)
 *   6. Entity chips in the right margin, positioned alongside relevant paragraphs
 *   7. Word count + read time + entity/connection counts at the footer
 *   8. Tag pills from the tag components
 *
 * The reading column is capped at 560px for comfortable line lengths.
 * Entity chips float in a 110px margin to the right when space permits,
 * otherwise they collapse into an inline row above the body.
 */

import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import type {
  ApiObjectDetail,
  ApiComponent,
  ApiEdgeCompact,
} from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Markdown rendering via remark (already in deps)
   ───────────────────────────────────────────────── */

let remarkProcessor: ((md: string) => string) | null = null;

async function loadRemark() {
  if (remarkProcessor) return remarkProcessor;
  try {
    const { remark } = await import('remark');
    const remarkGfm = (await import('remark-gfm')).default;
    const remarkHtml = (await import('remark-html')).default;
    const processor = remark().use(remarkGfm).use(remarkHtml, { sanitize: false });
    remarkProcessor = (md: string) => {
      const file = processor.processSync(md);
      return String(file);
    };
    return remarkProcessor;
  } catch {
    // Fallback: wrap paragraphs in <p> tags
    return (md: string) =>
      md
        .split(/\n\n+/)
        .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
  }
}

/* ─────────────────────────────────────────────────
   Entity extraction from components
   ───────────────────────────────────────────────── */

interface EntityChip {
  text: string;
  kind: 'PERSON' | 'ORG' | 'PLACE' | 'CONCEPT' | 'EVENT' | 'ENTITY';
  color: string;
}

const ENTITY_COLORS: Record<string, string> = {
  PERSON: '#C4503C',
  ORG: '#1A7A8A',
  PLACE: '#2E8A3E',
  CONCEPT: '#7050A0',
  EVENT: '#3858B8',
  ENTITY: '#68666E',
};

const ENTITY_KEYWORDS = ['person', 'people', 'place', 'location', 'org', 'company', 'entity', 'geo'];

function extractEntities(components: ApiComponent[]): EntityChip[] {
  const chips: EntityChip[] = [];
  for (const comp of components) {
    const lower = comp.component_type_name.toLowerCase();
    if (!ENTITY_KEYWORDS.some((k) => lower.includes(k))) continue;

    let kind: EntityChip['kind'] = 'ENTITY';
    if (lower.includes('person') || lower.includes('people')) kind = 'PERSON';
    else if (lower.includes('org') || lower.includes('company')) kind = 'ORG';
    else if (lower.includes('place') || lower.includes('location') || lower.includes('geo')) kind = 'PLACE';

    const value = typeof comp.value === 'string' ? comp.value : String(comp.value || '');
    if (value.trim()) {
      chips.push({
        text: value.trim(),
        kind,
        color: ENTITY_COLORS[kind] || ENTITY_COLORS.ENTITY,
      });
    }
  }
  return chips;
}

/* ─────────────────────────────────────────────────
   Tag extraction from components
   ───────────────────────────────────────────────── */

function extractTags(components: ApiComponent[]): string[] {
  const tagComps = components.filter(
    (c) => c.key === 'tags' || c.component_type_name.toLowerCase() === 'tags',
  );
  const tags: string[] = [];
  for (const comp of tagComps) {
    const val = typeof comp.value === 'string' ? comp.value : '';
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        tags.push(...parsed.map(String));
        continue;
      }
    } catch {
      // not JSON
    }
    tags.push(
      ...val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  return tags;
}

/* ─────────────────────────────────────────────────
   Word count and read time
   ───────────────────────────────────────────────── */

function computeReadingStats(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 250));
  return { words, minutes };
}

/* ─────────────────────────────────────────────────
   Metadata extraction for files/PDFs
   ───────────────────────────────────────────────── */

interface MetaItem {
  label: string;
  value: string;
}

function extractMetadata(detail: ApiObjectDetail): MetaItem[] {
  const items: MetaItem[] = [];
  const props = detail.properties || {};

  const fieldMap: Record<string, string> = {
    author: 'Author',
    authors: 'Authors',
    publisher: 'Publisher',
    isbn: 'ISBN',
    pages: 'Pages',
    year: 'Year',
    language: 'Language',
    file_type: 'File Type',
    file_size: 'Size',
  };

  for (const [key, label] of Object.entries(fieldMap)) {
    const val = props[key];
    if (val) items.push({ label, value: String(val) });
  }

  // Also check components for file-section metadata
  for (const comp of detail.components) {
    if (comp.key === 'extracted_sections' || comp.data_type === 'file') {
      continue; // Skip file sections (rendered separately)
    }
    if (comp.component_type_name.toLowerCase().includes('metadata')) {
      const val = typeof comp.value === 'string' ? comp.value : JSON.stringify(comp.value);
      items.push({ label: comp.key, value: val });
    }
  }

  return items;
}

/* ─────────────────────────────────────────────────
   Reading progress hook
   ───────────────────────────────────────────────── */

function useReadingProgress(ref: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function handleScroll() {
      if (!el) return;
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      if (scrollHeight <= 0) {
        setProgress(100);
        return;
      }
      setProgress(Math.round((scrollTop / scrollHeight) * 100));
    }

    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [ref]);

  return progress;
}

/* ─────────────────────────────────────────────────
   Section rule component
   ───────────────────────────────────────────────── */

function SectionRule({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '20px 0 16px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          letterSpacing: '0.06em',
          color: 'var(--cp-text-faint)',
          textTransform: 'uppercase' as const,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          height: 1,
          background: 'var(--cp-red-line, rgba(196,80,60,0.22))',
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Entity margin component
   ───────────────────────────────────────────────── */

function EntityMargin({
  entities,
  inline = false,
  onEntityClick,
}: {
  entities: EntityChip[];
  inline?: boolean;
  onEntityClick?: (text: string) => void;
}) {
  if (entities.length === 0) return null;

  if (inline) {
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          marginBottom: 12,
        }}
      >
        {entities.map((e, i) => (
          <button
            key={`${e.text}-${i}`}
            type="button"
            onClick={() => onEntityClick?.(e.text)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 3,
              background: `${e.color}0D`,
              border: '1px solid transparent',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 8,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              transition: 'border-color 150ms',
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: e.color,
                flexShrink: 0,
              }}
            />
            <span style={{ color: e.color, fontWeight: 600 }}>{e.kind}</span>
            <span
              style={{
                color: 'var(--cp-text-muted, #78767E)',
                maxWidth: 80,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap' as const,
              }}
            >
              {e.text}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className="cp-reading-entity-margin"
      style={{
        position: 'absolute',
        right: -120,
        top: 0,
        width: 110,
      }}
    >
      {entities.map((e, i) => (
        <button
          key={`${e.text}-${i}`}
          type="button"
          onClick={() => onEntityClick?.(e.text)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 3,
            background: `${e.color}0D`,
            border: '1px solid transparent',
            marginBottom: 4,
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 8,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            transition: 'border-color 150ms',
            width: '100%',
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: e.color,
              flexShrink: 0,
            }}
          />
          <span style={{ color: e.color, fontWeight: 600 }}>{e.kind}</span>
          <span
            style={{
              color: 'var(--cp-text-muted, #78767E)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const,
              flex: 1,
            }}
          >
            {e.text}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Main ReadingPane component
   ───────────────────────────────────────────────── */

interface ReadingPaneProps {
  detail: ApiObjectDetail;
  onEntityClick?: (text: string) => void;
}

export default function ReadingPane({ detail, onEntityClick }: ReadingPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const progress = useReadingProgress(scrollRef);
  const [bodyHtml, setBodyHtml] = useState<string>('');
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  const typeSlug = detail.object_type_data?.slug ?? 'note';
  const typeColor = detail.object_type_data?.color ?? '#68666E';
  const typeName = detail.object_type_data?.name ?? 'Note';

  const entities = useMemo(() => extractEntities(detail.components), [detail.components]);
  const tags = useMemo(() => extractTags(detail.components), [detail.components]);
  const metadata = useMemo(() => extractMetadata(detail), [detail]);
  const stats = useMemo(() => computeReadingStats(detail.body || ''), [detail.body]);
  const isCode = typeSlug === 'script';
  const isSource = typeSlug === 'source';
  const hasOg = isSource && (detail.og_title || detail.og_description);
  const showMarginEntities = containerWidth > 700 && entities.length > 0;

  // Parse markdown body
  useEffect(() => {
    if (!detail.body || isCode) {
      setBodyHtml('');
      return;
    }
    loadRemark().then((parse) => {
      setBodyHtml(parse(detail.body || ''));
    });
  }, [detail.body, isCode]);

  // Measure container width for entity margin responsiveness
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const edgeCount = detail.edges?.length ?? 0;
  const entityCount = entities.length;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Reading progress bar */}
      {stats.words > 100 && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'var(--cp-border-faint, #F0EEEA)',
            zIndex: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              height: '100%',
              background: 'var(--cp-red, #C4503C)',
              width: `${progress}%`,
              borderRadius: '0 1px 1px 0',
              transition: 'width 200ms ease-out',
            }}
          />
        </div>
      )}

      <div
        ref={scrollRef}
        className="cp-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 28px 32px',
          background: 'var(--cp-surface, #FEFEFE)',
        }}
      >
        {/* ── Provenance card (Source objects with OG data) ── */}
        {hasOg && (
          <div
            style={{
              margin: '0 0 24px',
              padding: '12px 14px',
              borderRadius: 4,
              borderLeft: `3px solid ${typeColor}`,
              background: `${typeColor}0D`,
            }}
          >
            {detail.og_site_name && (
              <div
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase' as const,
                  color: typeColor,
                  marginBottom: 4,
                }}
              >
                {detail.og_site_name}
              </div>
            )}
            {detail.og_title && (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--cp-text, #18181B)',
                  lineHeight: 1.4,
                  marginBottom: 4,
                }}
              >
                {detail.og_title}
              </div>
            )}
            {detail.og_description && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--cp-text-secondary, #48464E)',
                  lineHeight: 1.5,
                }}
              >
                {detail.og_description}
              </div>
            )}
            {detail.url && (
              <a
                href={detail.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  color: 'var(--cp-text-faint, #A8A6AE)',
                  marginTop: 6,
                  textDecoration: 'none',
                }}
              >
                {detail.url.length > 60 ? detail.url.slice(0, 57) + '...' : detail.url}
              </a>
            )}
          </div>
        )}

        {/* ── Metadata grid (for files/PDFs with structured metadata) ── */}
        {metadata.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: metadata.length > 2 ? '1fr 1fr' : '1fr',
              gap: '6px 16px',
              marginBottom: 20,
              padding: '10px 14px',
              background: 'var(--cp-bg-secondary, #F4F3F0)',
              borderRadius: 4,
            }}
          >
            {metadata.map((m, i) => (
              <div key={`${m.label}-${i}`}>
                <div
                  style={{
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 9,
                    color: 'var(--cp-text-faint, #A8A6AE)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {m.label}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--cp-font-body)',
                    fontSize: 12,
                    color: 'var(--cp-text-secondary, #48464E)',
                  }}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Section rule ── */}
        {detail.body && <SectionRule label={isCode ? 'Code' : 'Body'} />}

        {/* ── Inline entity chips (narrow containers) ── */}
        {!showMarginEntities && entities.length > 0 && (
          <EntityMargin entities={entities} inline onEntityClick={onEntityClick} />
        )}

        {/* ── Body content ── */}
        {detail.body && (
          <div style={{ position: 'relative', maxWidth: 560 }}>
            {/* Margin entity chips (wide containers) */}
            {showMarginEntities && (
              <EntityMargin entities={entities} onEntityClick={onEntityClick} />
            )}

            {isCode ? (
              /* Code objects: TerminalBlock-style dark surface */
              <div
                style={{
                  background: 'var(--cp-term, #1A1C22)',
                  border: '1px solid var(--cp-term-border, #2A2C32)',
                  borderRadius: 4,
                  padding: '12px 14px',
                  overflowX: 'auto',
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 11,
                    color: 'var(--cp-term-text, #C0C8D8)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {detail.body}
                </pre>
              </div>
            ) : bodyHtml ? (
              /* Markdown-rendered body */
              <div
                className="cp-reading-body"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            ) : (
              /* Fallback: plain text with paragraph breaks */
              <div className="cp-reading-body">
                {detail.body.split(/\n\n+/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── URL (for non-source objects that have one) ── */}
        {detail.url && !hasOg && (
          <div style={{ marginTop: 16 }}>
            <a
              href={detail.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 11,
                color: 'var(--cp-source, #1A7A8A)',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(26,122,138,0.25)',
              }}
            >
              {detail.url.length > 70 ? detail.url.slice(0, 67) + '...' : detail.url}
            </a>
          </div>
        )}

        {/* ── Footer: stats + tags ── */}
        {(stats.words > 10 || tags.length > 0) && (
          <div
            style={{
              marginTop: 24,
              paddingTop: 12,
              borderTop: '1px solid var(--cp-border-faint, #F0EEEA)',
            }}
          >
            {stats.words > 10 && (
              <div
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  color: 'var(--cp-text-faint, #A8A6AE)',
                }}
              >
                ~{stats.words} words · {stats.minutes} min read
                {entityCount > 0 && ` · ${entityCount} entities extracted`}
                {edgeCount > 0 && ` · ${edgeCount} connections`}
              </div>
            )}

            {tags.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 4,
                  marginTop: 8,
                }}
              >
                {tags.map((tag, i) => (
                  <span
                    key={`${tag}-${i}`}
                    style={{
                      fontFamily: 'var(--cp-font-mono)',
                      fontSize: 9,
                      padding: '2px 8px',
                      borderRadius: 10,
                      border: '1px solid var(--cp-border, #E6E4E0)',
                      color: 'var(--cp-text-muted, #78767E)',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
