/**
 * Atlas source registry — shown in the sidebar `Connected` group and in
 * the Connections panel.
 *
 * These entries are real source integration concepts on the Theseus roadmap.
 * Item counts / lastSync / status are static placeholders here because the
 * backend source registry isn't wired to this surface yet. The list is
 * rendered read-only until that backend lands — per the project no-fake-UI
 * rule, nothing here triggers a fake action.
 */

export interface AtlasSource {
  id: string;
  name: string;
  kind: 'code' | 'papers' | 'email' | 'notes' | 'web';
  /** CSS colour — one of the Atlas kind variables or a raw value. */
  color: string;
  /** Descriptive line shown on the Connections detail panel. */
  detail: string;
}

export const ATLAS_SOURCES: AtlasSource[] = [
  {
    id: 'github',
    name: 'GitHub',
    kind: 'code',
    color: 'var(--ink)',
    detail: 'Repositories, stars, and issues.',
  },
  {
    id: 'arxiv',
    name: 'arXiv + Semantic',
    kind: 'papers',
    color: 'var(--indigo)',
    detail: 'Paper watchlist with citation traces.',
  },
  {
    id: 'email',
    name: 'Fastmail',
    kind: 'email',
    color: 'var(--sage)',
    detail: 'Primary inbox and conversation threads.',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    kind: 'notes',
    color: 'var(--ochre)',
    detail: 'Vaulted notes and backlinks.',
  },
  {
    id: 'highlights',
    name: 'Browser highlights',
    kind: 'web',
    color: 'var(--mauve)',
    detail: 'Web excerpts saved via the Theseus extension.',
  },
];

export const ATLAS_KINDS = {
  concept: { color: 'var(--indigo)', glyph: '◆' },
  finding: { color: 'var(--sage)', glyph: '●' },
  paper: { color: 'var(--ochre)', glyph: '▲' },
  person: { color: 'var(--teal)', glyph: '◉' },
  code: { color: 'var(--mauve)', glyph: '■' },
  note: { color: 'var(--lilac)', glyph: '◐' },
} as const;

export type AtlasKind = keyof typeof ATLAS_KINDS;
