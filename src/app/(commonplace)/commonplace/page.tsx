import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Index',
  description: 'CommonPlace index page: engine discoveries, recent captures, and system status.',
};

/**
 * CommonPlace Index.
 *
 * Renders nothing visible; the (commonplace) layout's ScreenRouter
 * handles the daily screen. Default activeScreen is 'daily'.
 */
export default function CommonPlacePage() {
  return <></>;
}
