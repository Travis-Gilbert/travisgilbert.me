import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Auto Organize',
  description: 'CommonPlace auto-organize page: engine discoveries, recent captures, and system status.',
};

/**
 * CommonPlace Auto Organize.
 *
 * Renders nothing visible; the (commonplace) layout's ScreenRouter
 * handles the daily screen. Default activeScreen is 'daily'.
 */
export default function CommonPlacePage() {
  return <></>;
}
