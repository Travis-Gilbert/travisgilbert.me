import type { Metadata } from 'next';
import { fontVariableClasses } from './fonts';
import DotGrid from '@/components/DotGrid';
import TopNav from '@/components/TopNav';
import Footer from '@/components/Footer';
import ConsoleEasterEgg from '@/components/ConsoleEasterEgg';
import { getCollection } from '@/lib/content';
import type { Essay, FieldNote, Project } from '@/lib/content';
import '@/styles/global.css';

export const metadata: Metadata = {
  title: {
    default: 'Travis Gilbert',
    template: '%s | Travis Gilbert',
  },
  description:
    'Exploring how design decisions shape human outcomes. Essays, field notes, and projects on design, policy, and the built environment.',
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

// Compute site stats at build time for ConsoleEasterEgg
const essays = getCollection<Essay>('essays').filter((e) => !e.data.draft);
const fieldNotes = getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft);
const projects = getCollection<Project>('projects').filter((p) => !p.data.draft);

const latestEssay = essays.sort(
  (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
)[0];

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
        <ConsoleEasterEgg
          essayCount={essays.length}
          fieldNoteCount={fieldNotes.length}
          projectCount={projects.length}
          latestEssayTitle={latestEssay?.data.title ?? ''}
          latestEssaySlug={latestEssay?.slug ?? ''}
        />
      </body>
    </html>
  );
}
