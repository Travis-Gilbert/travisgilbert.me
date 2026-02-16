import type { Metadata } from 'next';
import { fontVariableClasses } from './fonts';
import DotGrid from '@/components/DotGrid';
import TopNav from '@/components/TopNav';
import Footer from '@/components/Footer';
import ConsoleEasterEgg from '@/components/ConsoleEasterEgg';
import '@/styles/global.css';

export const metadata: Metadata = {
  title: {
    default: 'Travis Gilbert',
    template: '%s | Travis Gilbert',
  },
  description:
    'Investigating how design decisions shape human outcomes. Research, field notes, and projects at the intersection of design, policy, and technology.',
  metadataBase: new URL('https://travisgilbert.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Travis Gilbert',
  },
  twitter: {
    card: 'summary_large_image',
  },
  alternates: {
    types: {
      'application/rss+xml': '/rss.xml',
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fontVariableClasses}>
      {/* Built with curiosity and too much coffee. If you're reading this, we should talk. */}
      <body
        className="min-h-screen flex flex-col"
        style={{ isolation: 'isolate' }}
      >
        <DotGrid />
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <TopNav />
        <main
          id="main-content"
          className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8"
        >
          {children}
        </main>
        <Footer />
        <ConsoleEasterEgg />
      </body>
    </html>
  );
}
