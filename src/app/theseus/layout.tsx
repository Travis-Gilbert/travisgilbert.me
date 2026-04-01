import '../../styles/theseus.css';
import { TealDotGrid } from './TealDotGrid';

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
      <TealDotGrid />
      <div style={{ position: 'relative', zIndex: 1, width: '100vw', height: '100vh' }}>
        {children}
      </div>
    </div>
  );
}
