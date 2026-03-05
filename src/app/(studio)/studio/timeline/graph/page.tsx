import type { Metadata } from 'next';
import TimelineModeTabs from '@/components/studio/TimelineModeTabs';
import TimelineGraph from '@/components/studio/TimelineGraph';

export const metadata: Metadata = {
  title: 'Timeline Graph',
};

export default function TimelineGraphPage() {
  return (
    <>
      <TimelineModeTabs mode="graph" />
      <TimelineGraph />
    </>
  );
}
