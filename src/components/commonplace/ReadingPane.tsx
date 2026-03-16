'use client';

/**
 * ReadingPane: type-aware reading surface for CommonPlace objects.
 *
 * Renders markdown body, provenance cards (sources), terminal blocks (scripts),
 * metadata grids (PDFs / files), entity chips in a margin rail, tags, a reading
 * progress bar, and footer statistics. Layout and typography are handled by
 * reading-pane.css using --cp-* design tokens.
 *
 * Note: dangerouslySetInnerHTML is used to render remark-processed markdown.
 * The content originates from the user's own stored body text, processed
 * through remark (which strips raw HTML by default with remarkHtml).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiObjectDetail, ApiComponent } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Props
   ───────────────────────────────────────────────── */

interface ReadingPaneProps {
  detail: ApiObjectDetail;
  onEntityClick?: (text: string) => void;
}

/* ─────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────── */

/** Lazy-loaded remark processor (ESM-only packages need dynamic import). */
let _remarkProcessor: ((md: string) => Promise<string>) | null = null;

async function getRemarkProcessor(): Promise<(md: string) => Promise<string>> {
  if (_remarkProcessor) return _remarkProcessor;
  try {
    const { remark } = await import('remark');
    const remarkGfm = (await import('remark-gfm')).default;
    const remarkHtml = (await import('remark-html')).default;
    const processor = remark().use(remarkGfm).use(remarkHtml);
    _remarkProcessor = async (md: string) => {
      const file = await processor.process(md);
      return String(file);
    };
    return _remarkProcessor;
  } catch {
    // Fallback if remark fails to load
    _remarkProcessor = async (md: string) =>
      md
        .split(/\n\n+/)
        .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
    return _remarkProcessor;
  }
}

/** Simple paragraph fallback (no markdown, just line breaks). */
function plainTextToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * Detect "raw" body text: no markdown formatting, likely PDF/OCR extraction.
 * Raw text = no headings, no lists, no links, and very few paragraph breaks
 * relative to total length. Returns true for wall-of-text content.
 */
function isRawText(text: string): boolean {
  if (!text || text.length < 200) return false;
  const hasHeadings = /^#{1,6}\s/m.test(text);
  const hasLists = /^[\s]*[-*]\s/m.test(text);
  const hasLinks = /\[.+?\]\(.+?\)/.test(text);
  if (hasHeadings || hasLists || hasLinks) return false;
  // If the text has very few paragraph breaks relative to length, it's raw
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  const avgParaLen = text.length / Math.max(paragraphs.length, 1);
  return avgParaLen > 600;
}

/** Count words in a plain text string (strip markdown roughly). */
function wordCount(text: string): number {
  const stripped = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_~`>\[\]()!|]/g, ' ');
  return stripped.split(/\s+/).filter(Boolean).length;
}

/** Estimate reading time (minutes) at 238 wpm. */
function readTime(words: number): string {
  const minutes = Math.max(1, Math.round(words / 238));
  return `${minutes} min`;
}

/** Extract the site name from a URL string. */
function siteName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host;
  } catch {
    return '';
  }
}

/** Check if a component is an entity chip (person, place, org, entity). */
function isEntity(c: ApiComponent): boolean {
  const name = c.component_type_name.toLowerCase();
  return (
    name.includes('person') ||
    name.includes('place') ||
    name.includes('org') ||
    name.includes('entity')
  );
}

/** Check if a component is a tag. */
function isTag(c: ApiComponent): boolean {
  return c.component_type_name.toLowerCase().includes('tag');
}

/** Check if a component is a "property" (metadata) -- not an entity or tag. */
function isProperty(c: ApiComponent): boolean {
  return !isEntity(c) && !isTag(c);
}

/** Parse a comma/semicolon-separated tag value into individual tags. */
function parseTags(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/* ─────────────────────────────────────────────────
   Feature flags per object type slug
   ───────────────────────────────────────────────── */

interface TypeFeatures {
  provenance: boolean;
  terminal: boolean;
  metadataGrid: boolean;
  margin: boolean;
}

function typeFeatures(slug: string, detail: ApiObjectDetail): TypeFeatures {
  const hasOg = !!(detail.og_title || detail.og_description);
  const hasProps = detail.components.some(isProperty);

  switch (slug) {
    case 'source':
      return { provenance: hasOg, terminal: false, metadataGrid: hasProps, margin: true };
    case 'script':
      return { provenance: false, terminal: true, metadataGrid: hasProps, margin: false };
    case 'note':
      return { provenance: false, terminal: false, metadataGrid: false, margin: true };
    case 'person':
      return { provenance: false, terminal: false, metadataGrid: hasProps, margin: true };
    case 'concept':
      return { provenance: false, terminal: false, metadataGrid: false, margin: true };
    default:
      return { provenance: false, terminal: false, metadataGrid: hasProps, margin: true };
  }
}

/* ─────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────── */

export default function ReadingPane({ detail, onEntityClick }: ReadingPaneProps) {
  const slug = detail.object_type_data.slug;
  const features = useMemo(() => typeFeatures(slug, detail), [slug, detail]);

  /* ── Markdown body (async to handle ESM-only remark) ── */
  const [bodyHtml, setBodyHtml] = useState<string>(() => plainTextToHtml(detail.body || ''));

  useEffect(() => {
    if (!detail.body) {
      setBodyHtml('');
      return;
    }
    let cancelled = false;
    getRemarkProcessor().then((parse) => {
      if (cancelled) return;
      parse(detail.body || '').then((html) => {
        if (!cancelled) setBodyHtml(html);
      });
    });
    return () => { cancelled = true; };
  }, [detail.body]);

  const words = useMemo(() => wordCount(detail.body || ''), [detail.body]);
  const rawText = useMemo(() => isRawText(detail.body || ''), [detail.body]);
  const showProgress = words > 100;

  /* ── Components breakdown ── */
  const entityComponents = useMemo(
    () => detail.components.filter(isEntity),
    [detail.components],
  );
  const tagComponents = useMemo(
    () => detail.components.filter(isTag),
    [detail.components],
  );
  const propertyComponents = useMemo(
    () => detail.components.filter(isProperty),
    [detail.components],
  );
  const allTags = useMemo(
    () => tagComponents.flatMap((tc) => parseTags(tc.value)),
    [tagComponents],
  );

  /* ── Reading progress ── */
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Walk up to the nearest scrollable ancestor
    let scrollParent: HTMLElement | null = el.parentElement;
    while (scrollParent && scrollParent.scrollHeight <= scrollParent.clientHeight) {
      scrollParent = scrollParent.parentElement;
    }
    if (!scrollParent) return;

    const rect = el.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();

    // How far the container top has scrolled above the viewport vs total scrollable height
    const scrolled = parentRect.top - rect.top;
    const total = el.scrollHeight - scrollParent.clientHeight;
    if (total <= 0) {
      setProgress(100);
      return;
    }
    const pct = Math.min(100, Math.max(0, (scrolled / total) * 100));
    setProgress(pct);
  }, []);

  useEffect(() => {
    if (!showProgress) return;

    const el = containerRef.current;
    if (!el) return;

    let scrollParent: HTMLElement | null = el.parentElement;
    while (scrollParent && scrollParent.scrollHeight <= scrollParent.clientHeight) {
      scrollParent = scrollParent.parentElement;
    }
    if (!scrollParent) return;

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // initial measurement

    return () => {
      scrollParent!.removeEventListener('scroll', handleScroll);
    };
  }, [showProgress, handleScroll]);

  /* ── Render ── */

  return (
    <div className="rp-container" ref={containerRef}>
      {/* Progress bar */}
      {showProgress && (
        <div className="rp-progress-track">
          <div
            className="rp-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="rp-layout">
        {/* Main reading column */}
        <div className="rp-column">
          {/* Provenance card (sources with OG data) */}
          {features.provenance && (
            <div className="rp-provenance">
              {detail.url && (
                <div className="rp-provenance-site">{siteName(detail.url)}</div>
              )}
              {detail.og_title && (
                <div className="rp-provenance-title">{detail.og_title}</div>
              )}
              {detail.og_description && (
                <div className="rp-provenance-desc">{detail.og_description}</div>
              )}
            </div>
          )}

          {/* Metadata grid */}
          {features.metadataGrid && propertyComponents.length > 0 && (
            <div className="rp-metadata-grid">
              {propertyComponents.map((c) => (
                <MetadataRow key={c.id} label={c.key} value={c.value} />
              ))}
            </div>
          )}

          {/* Section rule: labeled divider before body */}
          {detail.body && (
            <div className="rp-section-rule">
              <span className="rp-section-rule-label">
                {features.terminal ? 'Code' : 'Body'}
              </span>
              <span className="rp-section-rule-line" />
            </div>
          )}

          {/* Terminal block (scripts) */}
          {features.terminal ? (
            <div className="rp-terminal">
              <code>{detail.body}</code>
            </div>
          ) : (
            /* Markdown body: rendered from user-owned markdown via remark
               (remarkHtml strips raw HTML by default; content is self-authored) */
            detail.body && (
              <div
                className={`rp-body${rawText ? ' rp-body--raw' : ''}`}
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            )
          )}

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="rp-tags-row">
              {allTags.map((tag, i) => (
                <span key={`${tag}-${i}`} className="rp-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Entity margin rail */}
        {features.margin && entityComponents.length > 0 && (
          <aside className="rp-margin">
            {entityComponents.map((ec) => (
              <button
                key={ec.id}
                type="button"
                className="rp-entity-chip"
                onClick={() => onEntityClick?.(ec.value)}
                title={`${ec.component_type_name}: ${ec.value}`}
              >
                {ec.value}
              </button>
            ))}
          </aside>
        )}
      </div>

      {/* Footer stats */}
      <footer className="rp-footer">
        <span className="rp-stat">
          <span className="rp-stat-value">{words.toLocaleString()}</span>
          <span className="rp-stat-label">words</span>
        </span>
        <span className="rp-stat">
          <span className="rp-stat-value">{readTime(words)}</span>
          <span className="rp-stat-label">read</span>
        </span>
        {entityComponents.length > 0 && (
          <span className="rp-stat">
            <span className="rp-stat-value">{entityComponents.length}</span>
            <span className="rp-stat-label">
              {entityComponents.length === 1 ? 'entity' : 'entities'}
            </span>
          </span>
        )}
        {detail.edges.length > 0 && (
          <span className="rp-stat">
            <span className="rp-stat-value">{detail.edges.length}</span>
            <span className="rp-stat-label">
              {detail.edges.length === 1 ? 'connection' : 'connections'}
            </span>
          </span>
        )}
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────────── */

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div className="rp-metadata-key">{label}</div>
      <div className="rp-metadata-val">{value}</div>
    </>
  );
}
