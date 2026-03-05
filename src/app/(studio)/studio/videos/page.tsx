import type { Metadata } from 'next';
import ContentList from '@/components/studio/ContentList';

export const metadata: Metadata = {
  title: 'Videos',
};

export default function VideosPage() {
  return <ContentList contentType="video" />;
}
