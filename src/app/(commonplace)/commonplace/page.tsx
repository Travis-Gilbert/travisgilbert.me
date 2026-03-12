import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Library',
  description: 'CommonPlace library for capture, resurfacing, and connection work.',
};

/**
 * CommonPlace home: Library.
 *
 * Renders nothing visible; the (commonplace) layout's SplitPaneContainer
 * manages all pane content. Default layout preset opens the Library tab.
 */
export default function CommonPlacePage() {
  return <></>;
}
