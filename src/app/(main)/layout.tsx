import DotGrid from '@/components/DotGrid';
import Terminal from '@/components/Terminal';
import TopNav from '@/components/TopNav';
import Footer from '@/components/Footer';
import ConsoleEasterEgg from '@/components/ConsoleEasterEgg';
import StudioShortcut from '@/components/StudioShortcut';
import ArchitectureEasterEgg from '@/components/ArchitectureEasterEgg';
import ResearchAPIEasterEgg from '@/components/ResearchAPIEasterEgg';
import SourceGraphEasterEgg from '@/components/SourceGraphEasterEgg';
import FigIndexEasterEgg from '@/components/FigIndexEasterEgg';
import { PersonJsonLd, WebSiteJsonLd } from '@/components/JsonLd';
import { getCollection } from '@/lib/content';
import { getVisibleNav } from '@/lib/siteConfig';
import type { Essay, FieldNote, Project } from '@/lib/content';

// Compute site stats at build time for ConsoleEasterEgg
const essays = getCollection<Essay>('essays').filter((e) => !e.data.draft);
const fieldNotes = getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft);
const projects = getCollection<Project>('projects').filter((p) => !p.data.draft);

const latestEssay = essays.sort(
  (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
)[0];

const visibleNav = getVisibleNav();

/**
 * Main site layout: parchment theme with TopNav, Footer, DotGrid, easter eggs.
 *
 * This is the chrome for the public facing site. The (networks) route group
 * uses a completely separate layout with its own dark theme.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PersonJsonLd />
      <WebSiteJsonLd />
      <DotGrid />
      <Terminal />
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <TopNav navItems={visibleNav} />
      <main
        id="main-content"
        className="main-content flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-8"
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
      <StudioShortcut />
      <ArchitectureEasterEgg />
      <ResearchAPIEasterEgg />
      <SourceGraphEasterEgg />
      <FigIndexEasterEgg />
    </>
  );
}
