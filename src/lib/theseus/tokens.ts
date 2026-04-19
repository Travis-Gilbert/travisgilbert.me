// Theseus token contract. Every Theseus-scoped token maps to a main-site
// (Patent Parchment) token via CSS variables; this module re-exports the
// names as a TypeScript const so components can reference `theseusTokens.bg`
// rather than typing raw `var(--vie-bg)` strings.
//
// Source of truth for the actual colour values is src/styles/theseus.css,
// which forks the main-site tokens in src/styles/global.css.

export const theseusTokens = {
  // Surfaces
  bg: 'var(--vie-bg)',
  bgSubtle: 'var(--vie-bg-subtle)',
  card: 'var(--vie-card)',
  code: 'var(--vie-code)',
  chromeBg: 'var(--vie-chrome-bg)',
  panelBg: 'var(--vie-panel-bg)',
  heroGround: 'var(--vie-hero-ground)',
  heroText: 'var(--vie-hero-text)',

  // Text
  text: 'var(--vie-text)',
  textMuted: 'var(--vie-text-muted)',
  textDim: 'var(--vie-text-dim)',

  // Borders
  border: 'var(--vie-border)',
  borderLight: 'var(--vie-border-light)',
  borderActive: 'var(--vie-border-active)',
  borderFocus: 'var(--vie-border-focus)',

  // Shadows
  shadowSm: 'var(--vie-shadow-sm)',
  shadow: 'var(--vie-shadow)',
  shadowLg: 'var(--vie-shadow-lg)',

  // Brand
  terra: 'var(--vie-terra)',
  terraHover: 'var(--vie-terra-hover)',
  terraLight: 'var(--vie-terra-light)',
  teal: 'var(--vie-teal)',
  tealLight: 'var(--vie-teal-light)',
  amber: 'var(--vie-amber)',
  amberLight: 'var(--vie-amber-light)',

  // Semantic
  success: 'var(--vie-success)',
  error: 'var(--vie-error)',

  // Object-type colours (Cosmograph nodes)
  typeSource: 'var(--vie-type-source)',
  typePerson: 'var(--vie-type-person)',
  typeConcept: 'var(--vie-type-concept)',
  typeHunch: 'var(--vie-type-hunch)',
  typeNote: 'var(--vie-type-note)',
  typeClaim: 'var(--vie-type-claim)',
  typeTension: 'var(--vie-type-tension)',

  // Engine live state
  engineIdle: 'var(--vie-engine-idle)',
  engineActive: 'var(--vie-engine-active)',

  // Fonts
  fontTitle: 'var(--vie-font-title)',
  fontBody: 'var(--vie-font-body)',
  fontMono: 'var(--vie-font-mono)',
  fontCode: 'var(--vie-font-code)',
} as const;

export type TheseusToken = keyof typeof theseusTokens;
