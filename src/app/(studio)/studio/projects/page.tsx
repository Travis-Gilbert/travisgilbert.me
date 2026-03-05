import type { Metadata } from 'next';
import ContentList from '@/components/studio/ContentList';

export const metadata: Metadata = {
  title: 'Projects',
};

export default function ProjectsPage() {
  return <ContentList contentType="project" />;
}
