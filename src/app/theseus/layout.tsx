import '../../styles/theseus.css';
import TheseusShell from '@/components/theseus/TheseusShell';

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
      <TheseusShell>{children}</TheseusShell>
    </div>
  );
}
