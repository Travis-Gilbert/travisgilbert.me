import type { Metadata } from 'next';
import ContentList from '@/components/studio/ContentList';

export const metadata: Metadata = {
  title: 'Essays',
};

export default function EssaysPage() {
  return <ContentList contentType="essay" />;
}
