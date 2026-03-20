import type { Metadata } from 'next';
import TheseusPost from '@/components/theseus-post/TheseusPost';

export const metadata: Metadata = {
  title: 'Theseus x CommonPlace',
  description:
    'A self-improving intelligence engine and a native knowledge interface. Two tools that work as one system.',
};

export default function TheseusExplainerPage() {
  return <TheseusPost />;
}
