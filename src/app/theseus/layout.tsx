import '../../styles/theseus.css';
import TheseusDotGrid from '@/components/theseus/TheseusDotGrid';

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
      <TheseusDotGrid />
      <div style={{ position: 'relative', zIndex: 1, width: '100vw', height: '100vh' }}>
        {children}
      </div>
    </div>
  );
}
