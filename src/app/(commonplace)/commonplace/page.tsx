import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Timeline',
  description: 'The immutable record of everything. Objects exist. Nodes happen.',
};

/**
 * CommonPlace home: The Timeline.
 *
 * Renders nothing visible; the (commonplace) layout's SplitPaneContainer
 * manages all pane content. Default layout preset opens a Timeline tab.
 */
export default function CommonPlacePage() {
  return <></>;
}
