/**
 * CommonPlace Reader: shared types, constants, and visual identity.
 *
 * Central data file consumed by all Reader* components.
 * Font families reference CSS variables set in reader.css;
 * actual font loading happens via next/font in fonts.ts.
 */

/* ─────────────────────────────────────────────────
   Font options (selectable in the font picker)
   ───────────────────────────────────────────────── */

export interface ReaderFont {
  id: string;
  label: string;
  family: string;
}

export const READER_FONTS: ReaderFont[] = [
  {
    id: 'plex',
    label: 'IBM Plex Sans',
    family: "var(--font-ibm-plex), 'IBM Plex Sans', sans-serif",
  },
  {
    id: 'vollkorn',
    label: 'Vollkorn',
    family: "var(--font-vollkorn), 'Vollkorn', serif",
  },
  {
    id: 'lora',
    label: 'Lora',
    family: "var(--font-lora), 'Lora', serif",
  },
];

export const DEFAULT_FONT = READER_FONTS[0];
export const DEFAULT_FONT_SIZE = 18;
export const MIN_FONT_SIZE = 14;
export const MAX_FONT_SIZE = 26;

/* ─────────────────────────────────────────────────
   Pipeline stages (shared with ArtifactBrowserView)
   ───────────────────────────────────────────────── */

export const PIPELINE_STAGES = [
  'captured',
  'parsed',
  'extracted',
  'reviewed',
  'promoted',
  'compiled',
  'learned',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/* ─────────────────────────────────────────────────
   Parsed paragraph model
   ───────────────────────────────────────────────── */

export interface ReaderParagraph {
  id: string;
  type: 'heading' | 'body' | 'lead' | 'quote' | 'code';
  text: string;
  /** remark-processed HTML for body/lead paragraphs */
  html?: string;
}

/* ─────────────────────────────────────────────────
   Highlight model
   ───────────────────────────────────────────────── */

export type HighlightAction = 'highlight' | 'note' | 'claim' | 'connect';

export interface ReaderHighlight {
  paragraphId: string;
  text: string;
  action: HighlightAction;
  note?: string;
  timestamp: number;
}

/* ─────────────────────────────────────────────────
   Engine panel: color maps for claim status,
   entity kind, and edge type
   ───────────────────────────────────────────────── */

export const CLAIM_STATUS_COLORS: Record<string, string> = {
  supported: 'var(--r-green)',
  provisional: 'var(--r-gold)',
  contested: 'var(--r-red)',
};

export const ENTITY_KIND_COLORS: Record<string, string> = {
  person: 'var(--r-green)',
  concept: 'var(--r-purple)',
  place: 'var(--r-teal)',
  org: 'var(--r-red)',
  organization: 'var(--r-red)',
};

export const EDGE_TYPE_COLORS: Record<string, string> = {
  supports: 'var(--r-green)',
  semantic: 'var(--r-purple)',
  mentions: 'var(--r-teal)',
  contradicts: 'var(--r-red)',
  related: 'var(--r-text-faint)',
};
