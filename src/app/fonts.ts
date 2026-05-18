import { Vollkorn, Vollkorn_SC, IBM_Plex_Sans, IBM_Plex_Mono, Courier_Prime, JetBrains_Mono, Caveat, Caudex, Lora } from 'next/font/google';
import localFont from 'next/font/local';

export const vollkorn = Vollkorn({
  subsets: ['latin'],
  variable: '--font-vollkorn',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

export const vollkornSC = Vollkorn_SC({
  subsets: ['latin'],
  variable: '--font-vollkorn-sc',
  display: 'swap',
  weight: ['400', '600', '700'],
});

export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-ibm-plex',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
});

export const courierPrime = Courier_Prime({
  subsets: ['latin'],
  variable: '--font-courier-prime',
  display: 'swap',
  weight: ['400', '700'],
  style: ['normal', 'italic'],
});

export const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
  display: 'swap',
  weight: ['400'],
});

export const caudex = Caudex({
  subsets: ['latin'],
  variable: '--font-caudex',
  display: 'swap',
  weight: ['400', '700'],
  style: ['normal', 'italic'],
});

export const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

export const amarna = localFont({
  src: '../../public/fonts/Amarna-Variable.ttf',
  variable: '--font-amarna',
  display: 'swap',
});

// Berthold Block: display face for the /act Retro Lab patent-instrument
// register. Shipped in the Retro Lab Design Scheme bundle from
// claude.ai/design (project/fonts/BertholdBlock.ttf, 200 KB). Used as
// the masthead display face on /act only; the rest of the site keeps
// Vollkorn as its brand serif.
export const bertholdBlock = localFont({
  src: '../../public/fonts/BertholdBlock.ttf',
  variable: '--font-berthold-block',
  display: 'swap',
});

// Apple Gothic Latin subset previously declared here was used only by
// the /spacetime page hover marginalia. The spacetime feature lives on
// a separate branch (claude/spacetime-execution) and re-introduces the
// font file plus this declaration; it stays out of the instant-kg
// branch to keep the two PRs scope-isolated.

export const fontVariableClasses = [
  vollkorn.variable,
  vollkornSC.variable,
  ibmPlexSans.variable,
  ibmPlexMono.variable,
  courierPrime.variable,
  jetBrainsMono.variable,
  caveat.variable,
  caudex.variable,
  lora.variable,
  amarna.variable,
  bertholdBlock.variable,
].join(' ');
