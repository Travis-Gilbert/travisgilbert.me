import { Vollkorn, Cabin, IBM_Plex_Sans, Courier_Prime, Space_Mono, Ysabeau, Caveat } from 'next/font/google';
import localFont from 'next/font/local';

export const vollkorn = Vollkorn({
  subsets: ['latin'],
  variable: '--font-vollkorn',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

export const cabin = Cabin({
  subsets: ['latin'],
  variable: '--font-cabin',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
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

export const spaceMono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
  weight: ['400', '700'],
});

export const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const amarna = localFont({
  src: '../../public/fonts/Amarna-Variable.ttf',
  variable: '--font-amarna',
  display: 'swap',
});

export const fontVariableClasses = [
  vollkorn.variable,
  cabin.variable,
  ibmPlexSans.variable,
  ysabeau.variable,
  courierPrime.variable,
  spaceMono.variable,
  caveat.variable,
  amarna.variable,
].join(' ');
