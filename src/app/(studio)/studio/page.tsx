import type { Metadata } from 'next';
import Dashboard from '@/components/studio/Dashboard';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/**
 * Studio dashboard: the landing view.
 * Shows ContinueCard, evidence cards, and pipeline stats.
 */
export default function StudioDashboardPage() {
  return <Dashboard />;
}
