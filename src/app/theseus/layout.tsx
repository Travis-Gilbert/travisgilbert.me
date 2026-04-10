import '../../styles/theseus.css';
import '../../styles/assistant-ui-theme.css';
// Studio CSS needed for TiptapEditor (slash popup, contain blocks, prose, word count)
import '../../styles/studio.css';
import TheseusShell from '@/components/theseus/TheseusShell';
import TheseusSidebar from '@/components/theseus/TheseusSidebar';
import TheseusMobileNav from '@/components/theseus/TheseusMobileNav';

export const metadata = {
  title: 'Theseus',
  description: 'Visual Intelligence Engine',
};

export default function TheseusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theseus-root">
      <TheseusSidebar />
      <TheseusShell>{children}</TheseusShell>
      <TheseusMobileNav />
    </div>
  );
}
