'use client';

import Image from 'next/image';
import { useCallback, useMemo, useState } from 'react';
import {
  AtSign,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Filter,
  History,
  Home,
  Inbox,
  MoreHorizontal,
  MousePointer2,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  Star,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ScreenType, ViewType } from '@/lib/commonplace';
import {
  clearCommonPlaceInstanceSettings,
  DEFAULT_LOCAL_COMMONPLACE_INSTANCE,
  probeCommonPlaceInstance,
  readCommonPlaceInstanceSettings,
  saveCommonPlaceInstanceSettings,
  type CommonPlaceInstanceSettings,
} from '@/lib/commonplace-instance';
import { runTheoremAgent } from '@/lib/theorem-agent';
import { useLayout } from '@/lib/providers/layout-provider';
import styles from './CommonPlaceMobileApp.module.css';

type MobileSurface = 'home' | 'data' | 'projects' | 'issues' | 'favorites' | 'search' | 'settings';
type MobileFileIconName = 'artisan' | 'database' | 'atom' | 'awk' | 'devicetree';

interface DockItem {
  key: MobileSurface;
  label: string;
  icon?: LucideIcon;
  fileIcon?: MobileFileIconName;
}

interface MenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  fileIcon?: MobileFileIconName;
  count?: number;
  surface?: MobileSurface;
  screen?: ScreenType;
  view?: ViewType;
  action?: 'agent';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  text: string;
}

const DOCK_ITEMS: DockItem[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'data', label: 'Data', fileIcon: 'database' },
  { key: 'projects', label: 'Projects', fileIcon: 'artisan' },
  { key: 'search', label: 'Search', icon: Search },
];

const MENU_ITEMS: MenuItem[] = [
  { key: 'inbox', label: 'Inbox', icon: Inbox, count: 1, surface: 'issues' },
  { key: 'issues', label: 'My Issues', icon: CircleDashed, surface: 'issues' },
  { key: 'favorites', label: 'Favorites', icon: Star, surface: 'favorites' },
  { key: 'projects', label: 'Projects', fileIcon: 'artisan', surface: 'projects' },
  { key: 'data', label: 'Data', fileIcon: 'database', surface: 'data' },
  { key: 'agent', label: 'CommonPlace Chat', fileIcon: 'atom', action: 'agent' },
  { key: 'code', label: 'Code', fileIcon: 'awk', view: 'code' },
  { key: 'graph', label: 'Graph', fileIcon: 'devicetree', view: 'network' },
  { key: 'vector-space', label: 'Vector Space', fileIcon: 'database', view: 'vector-space' },
  { key: 'settings', label: 'Settings', icon: Settings, surface: 'settings' },
  { key: 'search', label: 'Search', icon: Search, surface: 'search' },
];

const RECENT_ACTIVITY = [
  { title: 'Travis Gilbert', meta: 'Project', fileIcon: 'artisan' as const },
  { title: 'CommonPlace + Theorems Harness', meta: 'Project', fileIcon: 'atom' as const },
  { title: 'UI', meta: 'Work item  COMMONPLAC-1', fileIcon: 'awk' as const },
];

const SEARCH_RESULTS = [
  { title: 'CommonPlace + Theorems Harness', meta: 'Project' },
  { title: 'Plane feature parity', meta: 'Sticky' },
  { title: 'Complete graph view', meta: 'Project note' },
];

const DATA_ITEMS = [
  { title: 'All objects', meta: '52 stored records', fileIcon: 'database' as const, view: 'files' as const },
  { title: 'Vector Space', meta: 'Embedding atlas and semantic neighbors', fileIcon: 'database' as const, view: 'vector-space' as const },
  { title: 'Code', meta: 'Scripts and implementation notes', fileIcon: 'awk' as const, view: 'code' as const },
  { title: 'Graph', meta: 'Connections and device-tree structure', fileIcon: 'devicetree' as const, view: 'network' as const },
];

const PROJECT_ITEMS = [
  { title: 'Travis Gilbert', meta: 'Project', fileIcon: 'artisan' as const },
  { title: 'CommonPlace + Theorems Harness', meta: 'Project', fileIcon: 'atom' as const },
  { title: 'Plane feature parity', meta: 'Mobile shell', fileIcon: 'artisan' as const },
];

export default function CommonPlaceMobileApp() {
  const { navigateToScreen, launchView } = useLayout();
  const [surface, setSurface] = useState<MobileSurface>('home');
  const [issueTab, setIssueTab] = useState<'assigned' | 'created' | 'subscribed'>('assigned');
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [composer, setComposer] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [instanceSettings, setInstanceSettings] = useState<CommonPlaceInstanceSettings>(() =>
    readCommonPlaceInstanceSettings(),
  );

  const filteredSearchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return SEARCH_RESULTS;
    return SEARCH_RESULTS.filter((item) =>
      `${item.title} ${item.meta}`.toLowerCase().includes(query),
    );
  }, [searchTerm]);

  const openScreen = useCallback(
    (screen: ScreenType) => {
      navigateToScreen(screen);
      setMenuOpen(false);
    },
    [navigateToScreen],
  );

  const openView = useCallback(
    (view: ViewType) => {
      launchView(view);
      setMenuOpen(false);
    },
    [launchView],
  );

  const selectSurface = useCallback((nextSurface: MobileSurface) => {
    setSurface(nextSurface);
    setMenuOpen(nextSurface === 'favorites');
  }, []);

  const handleMenuItem = useCallback(
    (item: MenuItem) => {
      if (item.surface) {
        selectSurface(item.surface);
        return;
      }

      if (item.screen) {
        openScreen(item.screen);
        return;
      }

      if (item.view) {
        openView(item.view);
        return;
      }

      if (item.action === 'agent') {
        setChatOpen(true);
        setMenuOpen(false);
      }
    },
    [openScreen, openView, selectSurface],
  );

  const openCreatePrompt = useCallback(() => {
    setComposer('Create a new CommonPlace item');
    setChatOpen(true);
  }, []);

  const handleSendPrompt = useCallback(async () => {
    const text = composer.trim();
    if (!text || chatBusy) return;

    setChatMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text },
    ]);
    setComposer('');
    setChatBusy(true);

    try {
      const result = await runTheoremAgent({ task: text, mode: 'ask' });
      setChatMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          role: 'agent',
          text: result.answer || 'I did not get an answer back.',
        },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'system',
          text: 'I could not reach the agent right now. Check Accounts when you are ready to reconnect.',
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  }, [chatBusy, composer]);

  return (
    <div className={styles.mobileApp}>
      <section className={styles.screen} aria-label="CommonPlace mobile">
        {surface === 'home' && (
          <HomeScreen
            quickNote={quickNote}
            onQuickNoteChange={setQuickNote}
            onOpenProjects={() => selectSurface('projects')}
            onOpenData={() => selectSurface('data')}
            onOpenAgent={() => setChatOpen(true)}
            onOpenCode={() => openView('code')}
            onOpenGraph={() => openView('network')}
            onOpenActivity={() => selectSurface('projects')}
            onOpenMenu={() => setMenuOpen((open) => !open)}
          />
        )}

        {surface === 'data' && <DataScreen onOpenView={openView} />}

        {surface === 'projects' && <ProjectsScreen onOpenProjects={() => openScreen('projects')} />}

        {surface === 'issues' && (
          <IssuesScreen
            activeTab={issueTab}
            onTabChange={setIssueTab}
            onOpenCreate={openCreatePrompt}
          />
        )}

        {surface === 'favorites' && (
          <FavoritesScreen onToggleMenu={() => setMenuOpen((open) => !open)} />
        )}

        {surface === 'search' && (
          <SearchScreen
            searchTerm={searchTerm}
            results={filteredSearchResults}
            onSearchTermChange={setSearchTerm}
          />
        )}

        {surface === 'settings' && (
          <SettingsScreen
            instanceSettings={instanceSettings}
            onInstanceSettingsChange={setInstanceSettings}
          />
        )}

        <BottomDock
          activeSurface={surface}
          onSelectSurface={selectSurface}
          onCreate={openCreatePrompt}
        />

        {menuOpen && (
          <WorkspaceMenu
            activeSurface={surface}
            onSelectItem={handleMenuItem}
          />
        )}
      </section>

      {chatOpen && (
        <AgentChatOverlay
          composer={composer}
          busy={chatBusy}
          messages={chatMessages}
          onComposerChange={setComposer}
          onClose={() => setChatOpen(false)}
          onSend={handleSendPrompt}
        />
      )}
    </div>
  );
}

function HomeScreen({
  quickNote,
  onQuickNoteChange,
  onOpenProjects,
  onOpenData,
  onOpenAgent,
  onOpenCode,
  onOpenGraph,
  onOpenActivity,
  onOpenMenu,
}: {
  quickNote: string;
  onQuickNoteChange: (value: string) => void;
  onOpenProjects: () => void;
  onOpenData: () => void;
  onOpenAgent: () => void;
  onOpenCode: () => void;
  onOpenGraph: () => void;
  onOpenActivity: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <div className={styles.scroll}>
      <header className={styles.workspaceBar}>
        <button type="button" className={styles.workspaceIdentity} onClick={onOpenMenu}>
          <span className={styles.workspaceMark}>T</span>
          <span className={styles.workspaceName}>Travis Gilbert</span>
          <ChevronDown className={styles.chevron} strokeWidth={2} aria-hidden="true" />
        </button>
        <button type="button" className={styles.avatarButton} onClick={onOpenMenu} aria-label="Open profile and settings" />
      </header>

      <div className={styles.featureGrid} aria-label="CommonPlace sections">
        <FeatureTile fileIcon="artisan" label="Projects" onClick={onOpenProjects} />
        <FeatureTile fileIcon="database" label="Data" onClick={onOpenData} />
        <FeatureTile fileIcon="atom" label="Theorem AI" onClick={onOpenAgent} />
        <FeatureTile fileIcon="awk" label="Code" onClick={onOpenCode} />
        <FeatureTile fileIcon="devicetree" label="Graph" onClick={onOpenGraph} />
      </div>

      <SectionHeader title="Recent activity" onViewAll={onOpenActivity} />
      <div className={styles.activityList}>
        {RECENT_ACTIVITY.map((item) => (
          <ActivityItem
            key={item.title}
            title={item.title}
            meta={item.meta}
            fileIcon={item.fileIcon}
          />
        ))}
      </div>

      <SectionHeader title="Stickies" onViewAll={onOpenData} />
      <div className={styles.stickyGrid}>
        <label className={`${styles.stickyNote} ${styles.stickyTeal}`}>
          <textarea
            value={quickNote}
            onChange={(event) => onQuickNoteChange(event.target.value)}
            placeholder="Tap to type here"
            rows={3}
            aria-label="Quick sticky note"
          />
        </label>
        <button type="button" className={`${styles.stickyNote} ${styles.stickyBlue}`}>
          Plane feature Parity
        </button>
        <button type="button" className={`${styles.stickyNote} ${styles.stickyRed}`}>
          Complete graph view
        </button>
      </div>
    </div>
  );
}

function IssuesScreen({
  activeTab,
  onTabChange,
  onOpenCreate,
}: {
  activeTab: 'assigned' | 'created' | 'subscribed';
  onTabChange: (tab: 'assigned' | 'created' | 'subscribed') => void;
  onOpenCreate: () => void;
}) {
  return (
    <>
      <header className={styles.titleBar}>
        <h1 className={styles.pageTitle}>My issues</h1>
        <div className={styles.titleActions}>
          <button type="button" className={styles.roundIconButton} onClick={onOpenCreate} aria-label="Create issue">
            <SquarePen size={27} strokeWidth={2.2} />
          </button>
          <button type="button" className={styles.roundIconButton} aria-label="More issue actions">
            <MoreHorizontal size={31} strokeWidth={2.3} />
          </button>
        </div>
      </header>

      <div className={styles.issueTabs} role="tablist" aria-label="Issue filters">
        <IssueTab
          label="Assigned"
          active={activeTab === 'assigned'}
          onClick={() => onTabChange('assigned')}
          icon={Filter}
        />
        <IssueTab
          label="Created"
          active={activeTab === 'created'}
          onClick={() => onTabChange('created')}
        />
        <IssueTab
          label="Subscribed"
          active={activeTab === 'subscribed'}
          onClick={() => onTabChange('subscribed')}
        />
      </div>

      <EmptyIssuesState activeTab={activeTab} />
    </>
  );
}

function FavoritesScreen({ onToggleMenu }: { onToggleMenu: () => void }) {
  return (
    <>
      <header className={styles.titleBar}>
        <h1 className={styles.pageTitle}>Favorites</h1>
        <button type="button" className={styles.roundIconButton} onClick={onToggleMenu} aria-label="Toggle navigation menu">
          <SquarePen size={27} strokeWidth={2.2} />
        </button>
      </header>
      <div className={styles.favoritesBody}>
        <p className={styles.favoritesHint}>Your favorites will appear here.</p>
      </div>
    </>
  );
}

function DataScreen({ onOpenView }: { onOpenView: (view: ViewType) => void }) {
  return (
    <>
      <header className={styles.titleBar}>
        <h1 className={styles.pageTitle}>Data</h1>
        <button type="button" className={styles.roundIconButton} aria-label="Filter data">
          <SlidersHorizontal size={27} strokeWidth={2.2} />
        </button>
      </header>
      <div className={styles.browseBody}>
        <div className={styles.browseList}>
          {DATA_ITEMS.map((item) => (
            <button
              key={item.title}
              type="button"
              className={styles.browseItem}
              onClick={() => onOpenView(item.view)}
            >
              <span className={styles.browseIcon}>
                <MobileFileIcon name={item.fileIcon} />
              </span>
              <span className={styles.browseCopy}>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function ProjectsScreen({ onOpenProjects }: { onOpenProjects: () => void }) {
  return (
    <>
      <header className={styles.titleBar}>
        <h1 className={styles.pageTitle}>Projects</h1>
        <button type="button" className={styles.roundIconButton} onClick={onOpenProjects} aria-label="Open project board">
          <SquarePen size={27} strokeWidth={2.2} />
        </button>
      </header>
      <div className={styles.browseBody}>
        <div className={styles.browseList}>
          {PROJECT_ITEMS.map((item) => (
            <article key={item.title} className={styles.browseItem}>
              <span className={styles.browseIcon}>
                <MobileFileIcon name={item.fileIcon} />
              </span>
              <span className={styles.browseCopy}>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </span>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

function SettingsScreen({
  instanceSettings,
  onInstanceSettingsChange,
}: {
  instanceSettings: CommonPlaceInstanceSettings;
  onInstanceSettingsChange: (settings: CommonPlaceInstanceSettings) => void;
}) {
  const [url, setUrl] = useState(
    instanceSettings.url || DEFAULT_LOCAL_COMMONPLACE_INSTANCE.url,
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(
    instanceSettings.mode === 'self-hosted'
      ? 'Using a local CommonPlace backend.'
      : 'Using the configured cloud backend.',
  );

  const useLocalInstance = useCallback(async () => {
    const next: CommonPlaceInstanceSettings = {
      mode: 'self-hosted',
      url: url.trim(),
      apiKey: '',
    };
    setBusy(true);
    setStatus('Checking local instance.');
    try {
      const probe = await probeCommonPlaceInstance(next);
      if (!probe.ok) {
        setStatus(probe.message);
        return;
      }
      saveCommonPlaceInstanceSettings(next);
      onInstanceSettingsChange(next);
      setStatus('Connected. Reloading CommonPlace.');
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [onInstanceSettingsChange, url]);

  const useCloudInstance = useCallback(() => {
    const next: CommonPlaceInstanceSettings = { mode: 'cloud', url: '', apiKey: '' };
    clearCommonPlaceInstanceSettings();
    onInstanceSettingsChange(next);
    setStatus('Using cloud backend. Reloading CommonPlace.');
    window.location.reload();
  }, [onInstanceSettingsChange]);

  return (
    <>
      <header className={styles.titleBar}>
        <h1 className={styles.pageTitle}>Settings</h1>
        <button type="button" className={styles.roundIconButton} aria-label="Backend settings">
          <SlidersHorizontal size={27} strokeWidth={2.2} />
        </button>
      </header>
      <div className={styles.settingsBody}>
        <section className={styles.instancePanel} aria-label="Backend instance">
          <div className={styles.instanceHeader}>
            <span className={styles.instanceIcon}>
              <MobileFileIcon name="database" />
            </span>
            <div>
              <h2>Backend</h2>
              <p>{status}</p>
            </div>
          </div>

          <div className={styles.instanceMode} role="group" aria-label="Backend mode">
            <button
              type="button"
              className={styles.instanceModeButton}
              data-active={instanceSettings.mode !== 'self-hosted' ? 'true' : 'false'}
              onClick={() => setStatus('Using the configured cloud backend.')}
              disabled={busy}
            >
              Cloud
            </button>
            <button
              type="button"
              className={styles.instanceModeButton}
              data-active={instanceSettings.mode === 'self-hosted' ? 'true' : 'false'}
              onClick={() => setStatus('Enter a local URL, then connect.')}
              disabled={busy}
            >
              Local
            </button>
          </div>

          <div className={styles.instanceForm}>
            <label className={styles.instanceLabel}>
              <span>Instance URL</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={DEFAULT_LOCAL_COMMONPLACE_INSTANCE.url}
                autoCapitalize="none"
                autoComplete="url"
                inputMode="url"
              />
            </label>
          </div>

          <div className={styles.instanceActions}>
            <button type="button" onClick={useLocalInstance} disabled={busy || !url.trim()}>
              {busy ? 'Checking' : 'Connect URL'}
            </button>
            <button type="button" onClick={useCloudInstance} disabled={busy}>
              Use cloud
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

function SearchScreen({
  searchTerm,
  results,
  onSearchTermChange,
}: {
  searchTerm: string;
  results: typeof SEARCH_RESULTS;
  onSearchTermChange: (value: string) => void;
}) {
  return (
    <>
      <header className={styles.titleBar}>
        <h1 className={styles.pageTitle}>Search</h1>
      </header>
      <div className={styles.searchBody}>
        <label className={styles.searchField}>
          <Search size={21} strokeWidth={2.2} aria-hidden="true" />
          <input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search CommonPlace"
          />
        </label>
        <div className={styles.searchResults}>
          {results.map((result) => (
            <article key={result.title} className={styles.searchResult}>
              <strong>{result.title}</strong>
              <span>{result.meta}</span>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

function FeatureTile({
  fileIcon,
  label,
  onClick,
}: {
  fileIcon: MobileFileIconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.featureTile} onClick={onClick}>
      <MobileFileIcon name={fileIcon} className={styles.featureIcon} />
      <span className={styles.featureLabel}>{label}</span>
    </button>
  );
}

function SectionHeader({ title, onViewAll }: { title: string; onViewAll: () => void }) {
  return (
    <div className={styles.sectionHeader}>
      <h2 className={styles.sectionTitle}>
        {title}
        <ChevronDown size={15} strokeWidth={2.4} aria-hidden="true" />
      </h2>
      <button type="button" className={styles.viewAllButton} onClick={onViewAll}>
        View all
      </button>
    </div>
  );
}

function ActivityItem({
  title,
  meta,
  fileIcon,
}: {
  title: string;
  meta: string;
  fileIcon: MobileFileIconName;
}) {
  return (
    <article className={styles.activityItem}>
      <span className={styles.activityGlyph}>
        <MobileFileIcon name={fileIcon} />
      </span>
      <div>
        <h3 className={styles.activityName}>{title}</h3>
        <span className={styles.activityMeta}>{meta}</span>
      </div>
    </article>
  );
}

function IssueTab({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      className={styles.issueTab}
      data-active={active ? 'true' : 'false'}
      role="tab"
      aria-selected={active}
      onClick={onClick}
    >
      {label}
      {Icon && <Icon size={19} strokeWidth={2} aria-hidden="true" />}
    </button>
  );
}

function EmptyIssuesState({
  activeTab,
}: {
  activeTab: 'assigned' | 'created' | 'subscribed';
}) {
  const label =
    activeTab === 'assigned'
      ? 'No issues assigned to you'
      : activeTab === 'created'
        ? 'No issues created by you'
        : 'No subscribed issues';

  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyInner}>
        <span className={styles.emptyOrbit} aria-hidden="true">
          <svg viewBox="0 0 162 126" fill="none">
            <path d="M50 54C61 36 101 36 112 54" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            <path d="M50 72C61 90 101 90 112 72" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.45" />
            <ellipse cx="81" cy="63" rx="25" ry="14" stroke="currentColor" strokeWidth="4" />
            <ellipse cx="81" cy="63" rx="17" ry="8" stroke="currentColor" strokeWidth="3" opacity="0.42" />
            <path d="M28 51L14 62L28 73" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M134 51L148 62L134 73" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M60 36C72 24 91 24 102 36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.48" />
            <path d="M60 90C72 102 91 102 102 90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.28" />
            <path d="M81 78V94" stroke="currentColor" strokeWidth="2" strokeDasharray="2 5" opacity="0.35" />
          </svg>
        </span>
        <p className={styles.emptyCaption}>{label}</p>
      </div>
    </div>
  );
}

function BottomDock({
  activeSurface,
  onSelectSurface,
  onCreate,
}: {
  activeSurface: MobileSurface;
  onSelectSurface: (surface: MobileSurface) => void;
  onCreate: () => void;
}) {
  return (
    <nav className={styles.bottomDock} aria-label="CommonPlace mobile navigation">
      <div className={styles.dockPill}>
        {DOCK_ITEMS.map((item) => (
          <DockButton
            key={item.key}
            item={item}
            active={activeSurface === item.key}
            onSelect={() => onSelectSurface(item.key)}
          />
        ))}
      </div>
      <button type="button" className={styles.circleAction} onClick={onCreate} aria-label="Create item">
        <Plus size={34} strokeWidth={2.2} />
      </button>
    </nav>
  );
}

function DockButton({
  item,
  active,
  onSelect,
}: {
  item: DockItem;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      className={styles.dockButton}
      data-active={active ? 'true' : 'false'}
      aria-label={item.label}
      onClick={onSelect}
    >
      {item.fileIcon ? (
        <MobileFileIcon name={item.fileIcon} className={styles.dockFileIcon} />
      ) : Icon ? (
        <Icon size={31} strokeWidth={2.5} aria-hidden="true" />
      ) : null}
    </button>
  );
}

function WorkspaceMenu({
  activeSurface,
  onSelectItem,
}: {
  activeSurface: MobileSurface;
  onSelectItem: (item: MenuItem) => void;
}) {
  return (
    <aside className={styles.menuPanel} aria-label="CommonPlace navigation menu">
      <header className={styles.menuHeader}>
        <span className={styles.menuWorkspace}>
          Travis gilbert
          <ChevronUp size={17} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <button type="button" className={styles.textButton} aria-label="Workspace controls">
          <SlidersHorizontal size={24} strokeWidth={2.2} />
        </button>
      </header>

      <div className={styles.menuList}>
        {MENU_ITEMS.map((item) => {
          const isActive =
            (item.surface && item.surface === activeSurface) ||
            (item.key === 'favorites' && activeSurface === 'favorites');
          return (
            <button
              key={item.key}
              type="button"
              className={styles.menuItem}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => onSelectItem(item)}
            >
              <MenuIcon item={item} />
              <span>{item.label}</span>
              {item.count && <span className={styles.menuCount}>{item.count}</span>}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function AgentChatOverlay({
  composer,
  busy,
  messages,
  onComposerChange,
  onClose,
  onSend,
}: {
  composer: string;
  busy: boolean;
  messages: ChatMessage[];
  onComposerChange: (value: string) => void;
  onClose: () => void;
  onSend: () => Promise<void>;
}) {
  return (
    <section className={styles.chatOverlay} aria-label="CommonPlace chat">
      <header className={styles.chatHeader}>
        <button type="button" className={styles.roundIconButton} onClick={onClose} aria-label="Close chat">
          <X size={30} strokeWidth={2.4} />
        </button>
        <h1 className={styles.chatTitle}>New chat</h1>
        <button type="button" className={styles.roundIconButton} aria-label="Chat history">
          <History size={29} strokeWidth={2.4} />
        </button>
      </header>

      <div className={styles.chatBody}>
        {messages.length === 0 ? (
          <>
            <MousePointer2 className={styles.agentPointer} size={28} strokeWidth={1.9} aria-hidden="true" />
            <h2>Welcome to CommonPlace Chat</h2>
            <p>Ask anything or tell CommonPlace what you need</p>
            <div className={styles.promptChips}>
              <PromptChip icon={Settings} label="Project creation" onClick={() => onComposerChange('Create a project from my latest CommonPlace notes')} />
              <PromptChip icon={Search} label="Issue research" onClick={() => onComposerChange('Research the open CommonPlace mobile issues')} />
              <PromptChip icon={Sparkles} label="Situation report" onClick={() => onComposerChange('Give me a situation report for CommonPlace')} />
            </div>
            <span className={styles.mentionHint}>
              <AtSign size={19} strokeWidth={2.2} aria-hidden="true" />
              <span>to mention any issue, project, or document</span>
            </span>
          </>
        ) : (
          <div className={styles.chatMessages}>
            {messages.map((message) => (
              <article key={message.id} className={styles.chatMessage} data-role={message.role}>
                {message.text}
              </article>
            ))}
            {busy && (
              <article className={styles.chatMessage} data-role="system">
                CommonPlace is thinking.
              </article>
            )}
          </div>
        )}
      </div>

      <form
        className={styles.chatComposer}
        onSubmit={(event) => {
          event.preventDefault();
          void onSend();
        }}
      >
        <button type="button" className={styles.composerTool} aria-label="Attach file">
          <Paperclip size={27} strokeWidth={2.3} />
        </button>
        <button type="button" className={styles.composerTool} aria-label="Mention item">
          <AtSign size={29} strokeWidth={2.3} />
        </button>
        <textarea
          value={composer}
          onChange={(event) => onComposerChange(event.target.value)}
          placeholder="Ask CommonPlace..."
          rows={2}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void onSend();
            }
          }}
        />
        <button type="submit" className={styles.sendButton} disabled={!composer.trim() || busy} aria-label="Send prompt">
          <Send size={22} strokeWidth={2.6} />
        </button>
      </form>
    </section>
  );
}

function PromptChip({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.promptChip} onClick={onClick}>
      <Icon size={17} strokeWidth={2.2} aria-hidden="true" />
      {label}
    </button>
  );
}

function MenuIcon({ item }: { item: MenuItem }) {
  if (item.fileIcon) {
    return <MobileFileIcon name={item.fileIcon} className={styles.menuFileIcon} />;
  }

  if (!item.icon) return null;

  const Icon = item.icon;
  return <Icon size={27} strokeWidth={2.3} aria-hidden="true" />;
}

function MobileFileIcon({
  name,
  className,
}: {
  name: MobileFileIconName;
  className?: string;
}) {
  return (
    <Image
      src={`/commonplace/mobile-icons/${name}.svg`}
      alt=""
      width={24}
      height={24}
      unoptimized
      aria-hidden="true"
      className={`${styles.fileIcon}${className ? ` ${className}` : ''}`}
    />
  );
}
