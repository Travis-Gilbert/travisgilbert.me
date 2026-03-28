import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Daily',
  description: 'CommonPlace daily page: engine discoveries, recent captures, and system status.',
};

/**
 * CommonPlace home: Daily Page.
 *
 * Renders nothing visible; the (commonplace) layout's ScreenRouter
 * handles the daily screen. Default activeScreen is 'daily'.
 */
export default function CommonPlacePage() {
  return <></>;
}
