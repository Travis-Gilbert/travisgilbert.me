import type { Metadata } from 'next';
import ContentList from '@/components/studio/ContentList';

export const metadata: Metadata = {
  title: 'Field Notes',
};

export default function FieldNotesPage() {
  return <ContentList contentType="field-note" />;
}
