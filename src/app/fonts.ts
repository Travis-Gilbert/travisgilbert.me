import { Bricolage_Grotesque, IBM_Plex_Sans_Condensed, IBM_Plex_Mono } from 'next/font/google';
import localFont from 'next/font/local';

// The three product faces (SPEC-PARAMETRIC-DESIGN-SYSTEM D3).
// Display is a variable font whose opsz/wdth axes the token generator drives:
// tokens.gen.css maps opsz to the type-scale step and wdth to the seed density.
// The generated --font-display/--font-body/--font-mono tokens resolve through
// the *-src variables set here, so components never name a family directly.

export const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display-src',
  display: 'swap',
  axes: ['opsz', 'wdth'],
});

export const plexSansCondensed = IBM_Plex_Sans_Condensed({
  subsets: ['latin'],
  variable: '--font-body-src',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono-src',
  display: 'swap',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
});

// Self-hosted niche faces scoped to non-product surfaces. They stay declared
// at the root because they are consumed through CSS variables alone; browsers
// only fetch a face when a rendered rule uses it.

export const amarna = localFont({
  src: '../../public/fonts/Amarna-Variable.ttf',
  variable: '--font-amarna',
  display: 'swap',
});

// Berthold Block: masthead display face on /act only (Retro Lab bundle).
export const bertholdBlock = localFont({
  src: '../../public/fonts/BertholdBlock.ttf',
  variable: '--font-berthold-block',
  display: 'swap',
});

export const fontVariableClasses = [
  bricolage.variable,
  plexSansCondensed.variable,
  plexMono.variable,
  amarna.variable,
  bertholdBlock.variable,
].join(' ');
