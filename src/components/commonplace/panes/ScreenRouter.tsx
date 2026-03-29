'use client';

/**
 * ScreenRouter: renders the active screen when CommonPlace is in
 * screen mode. Screens replace the entire content area (no split panes).
 *
 * Library and Models have dedicated screen wrappers with extra chrome.
 * Notebooks, Projects, Engine, and Settings render existing views directly.
 */

import type { ScreenType } from '@/lib/commonplace';
import LibraryScreen from '../models/LibraryScreen';
import ModelsScreen from '../models/ModelsScreen';
import NotebookListView from '../views/NotebookListView';
import ProjectListView from '../views/ProjectListView';
import EngineDashboard from '../engine/EngineDashboard';
import DailyPage from '../views/DailyPage';

interface ScreenRouterProps {
  screen: ScreenType;
}

export default function ScreenRouter({ screen }: ScreenRouterProps) {
  switch (screen) {
    case 'daily':
      return <DailyPage />;
    case 'library':
      return <LibraryScreen />;
    case 'models':
      return <ModelsScreen />;
    case 'notebooks':
      return <NotebookListView />;
    case 'projects':
      return <ProjectListView />;
    case 'engine':
      return <EngineDashboard />;
    case 'settings':
      return <SettingsPlaceholder />;
    default:
      return <LibraryScreen />;
  }
}

function SettingsPlaceholder() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--cp-text-dim)',
        fontFamily: 'var(--font-metadata)',
        fontSize: 13,
      }}
    >
      Settings (coming soon)
    </div>
  );
}
