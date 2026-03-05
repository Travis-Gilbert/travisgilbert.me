import type { Metadata } from 'next';
import ContentList from '@/components/studio/ContentList';

export const metadata: Metadata = {
  title: 'Toolkit',
};

export default function ToolkitPage() {
  return <ContentList contentType="toolkit" />;
}
