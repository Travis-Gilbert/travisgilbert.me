import type { Metadata } from 'next';
import InboxFeed from '@/components/networks/InboxFeed';

export const metadata: Metadata = {
  title: 'Networks',
  description: 'Knowledge graph inbox and capture.',
};

/**
 * Networks home page: CaptureBar + InboxFeed.
 *
 * The layout provides the sidebar and dark theme wrapper.
 * This page renders the main content area with the capture
 * bar at the top and the filtered inbox feed below.
 */
export default function NetworksPage() {
  return <InboxFeed />;
}
