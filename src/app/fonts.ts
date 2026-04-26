import { Vollkorn, Vollkorn_SC, IBM_Plex_Sans, IBM_Plex_Mono, Courier_Prime, JetBrains_Mono, Ysabeau, Caveat, Caudex, Literata, Lora } from 'next/font/google';
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

export const ysabeau = Ysabeau({
  subsets: ['latin'],
  variable: '--font-ysabeau',
  display: 'swap',
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

export const literata = Literata({
  subsets: ['latin'],
  variable: '--font-literata',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
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

// Apple Gothic Latin subset — only used by the /spacetime page hover
// marginalia. 22 KB; opentype.js re-serialized so Chrome's font sanitizer
// accepts it (the original AppleGothic.ttf carries AAT-only `morx`/`feat`
// tables that ship-blocked it).
export const appleGothic = localFont({
  src: '../../public/fonts/apple-gothic-subset.ttf',
  variable: '--font-apple-gothic',
  display: 'swap',
});

export const fontVariableClasses = [
  vollkorn.variable,
  vollkornSC.variable,
  ibmPlexSans.variable,
  ibmPlexMono.variable,
  ysabeau.variable,
  courierPrime.variable,
  jetBrainsMono.variable,
  caveat.variable,
  caudex.variable,
  literata.variable,
  lora.variable,
  amarna.variable,
  appleGothic.variable,
].join(' ');
