import type { Metadata } from 'next';
import TimelineView from '@/components/studio/TimelineView';

export const metadata: Metadata = {
  title: 'Timeline',
};

export default function TimelinePage() {
  return <TimelineView />;
}
