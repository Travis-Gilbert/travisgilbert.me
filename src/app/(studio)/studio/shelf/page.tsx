import type { Metadata } from 'next';
import ContentList from '@/components/studio/ContentList';

export const metadata: Metadata = {
  title: 'Shelf',
};

export default function ShelfPage() {
  return <ContentList contentType="shelf" />;
}
