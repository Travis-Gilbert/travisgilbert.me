import type { Metadata } from 'next';
import TimelineView from '@/components/studio/TimelineView';
import TimelineModeTabs from '@/components/studio/TimelineModeTabs';

export const metadata: Metadata = {
  title: 'Timeline',
};

export default function TimelinePage() {
  return (
    <>
      <TimelineModeTabs mode="list" />
      <TimelineView />
    </>
  );
}
