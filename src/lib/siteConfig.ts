import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// ─────────────────────────────────────────────────
// Zod schemas for site configuration
// ─────────────────────────────────────────────────

const tokensSchema = z.object({
  colors: z.record(z.string()).default({}),
  fonts: z.record(z.string()).default({}),
  spacing: z.record(z.string()).default({}),
});

const navItemSchema = z.object({
  label: z.string(),
  path: z.string(),
  icon: z.string(),
  visible: z.boolean().default(true),
});

const footerSchema = z.object({
  tagline: z.string().default(''),
  links: z.array(z.object({
    label: z.string(),
    url: z.string(),
  })).default([]),
});

const seoSchema = z.object({
  titleTemplate: z.string().default('%s | Travis Gilbert'),
  description: z.string().default(''),
  ogImageFallback: z.string().optional(),
});

const siteConfigSchema = z.object({
  tokens: tokensSchema.default({}),
  nav: z.array(navItemSchema).default([]),
  footer: footerSchema.default({}),
  seo: seoSchema.default({}),
  pages: z.record(z.record(z.unknown())).default({}),
});

// ─────────────────────────────────────────────────
// Type exports
// ─────────────────────────────────────────────────

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type NavItem = z.infer<typeof navItemSchema>;
export type PageComposition = Record<string, unknown>;

// ─────────────────────────────────────────────────
// Default fallbacks (match current hardcoded values)
// ─────────────────────────────────────────────────

const DEFAULT_CONFIG: SiteConfig = {
  tokens: {
    colors: {
      terracotta: '#B45A2D',
      teal: '#2D5F6B',
      gold: '#C49A4A',
      green: '#5A7A4A',
      parchment: '#F5F0E8',
      darkGround: '#2A2824',
      cream: '#F0EBE3',
    },
    fonts: {
      title: 'Vollkorn',
      body: 'Cabin',
      mono: 'Courier Prime',
      annotation: 'Caveat',
      tagline: 'IBM Plex Sans',
    },
    spacing: {
      contentMaxWidth: '896px',
      heroMaxWidth: '1152px',
    },
  },
  nav: [
    { label: 'Essays on...', path: '/essays', icon: 'file-text', visible: true },
    { label: 'Field Notes', path: '/field-notes', icon: 'note-pencil', visible: true },
    { label: 'Projects', path: '/projects', icon: 'briefcase', visible: true },
    { label: 'Toolkit', path: '/toolkit', icon: 'wrench', visible: true },
    { label: 'Shelf', path: '/shelf', icon: 'book-open', visible: true },
    { label: 'Connect', path: '/connect', icon: 'chat-circle', visible: true },
  ],
  footer: {
    tagline: 'A living record of work, interests, and thinking.',
    links: [],
  },
  seo: {
    titleTemplate: '%s | Travis Gilbert',
    description: 'A creative workbench by Travis Gilbert: essays on design decisions, field notes, projects, and tools.',
  },
  pages: {},
};

// ─────────────────────────────────────────────────
// Config loader
// ─────────────────────────────────────────────────

let _cached: SiteConfig | null = null;

/**
 * Load and validate site configuration from src/config/site.json.
 * Falls back to hardcoded defaults if the file does not exist.
 * Result is cached for the lifetime of the process (build or dev server).
 */
export function getSiteConfig(): SiteConfig {
  if (_cached) return _cached;

  const configPath = path.join(process.cwd(), 'src', 'config', 'site.json');

  if (!fs.existsSync(configPath)) {
    _cached = DEFAULT_CONFIG;
    return _cached;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    _cached = siteConfigSchema.parse(raw);
  } catch {
    // On parse error, fall back to defaults so the site still builds
    console.warn('[siteConfig] Failed to parse site.json, using defaults');
    _cached = DEFAULT_CONFIG;
  }

  return _cached;
}

/**
 * Get the composition settings for a specific page key.
 * Returns an empty object if no composition is defined for that page.
 */
export function getPageComposition(pageKey: string): PageComposition {
  const config = getSiteConfig();
  return (config.pages[pageKey] as PageComposition) ?? {};
}

/**
 * Get visible nav items from the site config.
 * Filters out items where visible is false.
 */
export function getVisibleNav(): NavItem[] {
  const config = getSiteConfig();
  return config.nav.filter(item => item.visible);
}
