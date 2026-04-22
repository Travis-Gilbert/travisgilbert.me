'use client';

/**
 * Plugins panel placeholder.
 *
 * Per the Atlas design, this surface hosts an App-Store-style marketplace
 * of Theseus plugins. The plugin runtime isn't wired yet, so this panel
 * renders an honest empty state — no fake cards, no decorative buttons.
 */
export default function PluginsPanel() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--app-base)',
        color: 'var(--ink)',
      }}
    >
      <div className="atlas-topbar">
        <div className="atlas-crumbs">
          Plugins
          <span className="sep">/</span>
          <span className="active">marketplace</span>
        </div>
      </div>

      <div className="atlas-placeholder">
        <div className="eyebrow">Coming in a later pass</div>
        <h2>Plugin marketplace</h2>
        <p>
          The plugin runtime isn&rsquo;t connected yet. When it lands, this
          surface will host installable renderers, query languages, source
          bridges, and correspondence extras. For now, explore the Atlas
          design doc in the handoff bundle for a preview of the catalogue.
        </p>
      </div>
    </div>
  );
}
