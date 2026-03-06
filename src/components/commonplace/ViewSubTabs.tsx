'use client';

/**
 * ViewSubTabs: internal toggle between sub-views (Objects / Timeline)
 * within a notebook or project detail view.
 *
 * Renders as a horizontal row of buttons with an active bottom border
 * accent. Stays within the pane tab (these are NOT independent
 * ViewTypes; they're sub-views of a single pane).
 */

interface SubTab {
  key: string;
  label: string;
}

interface ViewSubTabsProps {
  tabs: SubTab[];
  active: string;
  onChange: (key: string) => void;
}

export default function ViewSubTabs({ tabs, active, onChange }: ViewSubTabsProps) {
  return (
    <div className="cp-view-sub-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`cp-view-sub-tab ${tab.key === active ? 'cp-view-sub-tab--active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
