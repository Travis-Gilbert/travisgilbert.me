import { Vollkorn, Vollkorn_SC, IBM_Plex_Sans, Courier_Prime, JetBrains_Mono, Ysabeau, Caveat, Caudex, Literata, Lora } from 'next/font/google';
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

export const fontVariableClasses = [
  vollkorn.variable,
  vollkornSC.variable,
  ibmPlexSans.variable,
  ysabeau.variable,
  courierPrime.variable,
  jetBrainsMono.variable,
  caveat.variable,
  caudex.variable,
  literata.variable,
  lora.variable,
  amarna.variable,
].join(' ');
