'use client';

import { useLayout } from '@/lib/providers/layout-provider';

/**
 * EngineAnalyzeTab: context-aware analysis of the current screen.
 *
 * Three sections:
 *   1. Currently on screen (objects visible, edge count, avg strength)
 *   2. Notable patterns (cluster overlaps, weak signals, tensions)
 *   3. Suggested actions (run engine, estimated connections, reviews)
 */

export default function EngineAnalyzeTab() {
  const { activeScreen } = useLayout();

  const screenLabel = activeScreen
    ? activeScreen.charAt(0).toUpperCase() + activeScreen.slice(1).replace(/-/g, ' ')
    : null;

  // Static analysis data (until live API integration)
  const sections = activeScreen ? getAnalysisForScreen(activeScreen) : null;

  if (!sections) {
    return (
      <div
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: 12,
          color: '#7A756E',
          padding: '14px 6px',
          lineHeight: 1.65,
        }}
      >
        Navigate to a view to see analysis. I will examine whatever objects are on screen.
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '14px 18px',
        fontFamily: 'var(--font-code)',
        fontSize: 12,
        color: '#C0BDB5',
        lineHeight: 1.6,
      }}
    >
      {/* Section: Currently on screen */}
      <AnalyzeSection
        label={`Currently on screen: ${screenLabel}`}
        delay={0}
      >
        {sections.onScreen.map((card, i) => (
          <AnalyzeCard key={i} title={card.title} detail={card.detail} />
        ))}
      </AnalyzeSection>

      {/* Section: Notable patterns */}
      <AnalyzeSection label="Notable patterns" delay={1}>
        {sections.patterns.map((card, i) => (
          <AnalyzeCard key={i} title={card.title} detail={card.detail} />
        ))}
      </AnalyzeSection>

      {/* Section: Suggested actions */}
      <AnalyzeSection label="Suggested actions" delay={2}>
        {sections.actions.map((card, i) => (
          <AnalyzeCard key={i} title={card.title} detail={card.detail} />
        ))}
      </AnalyzeSection>

      <style>{`
        @keyframes analyzeSlideUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .analyze-section-anim { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────────── */

function AnalyzeSection({
  label,
  delay,
  children,
}: {
  label: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="analyze-section-anim"
      style={{
        marginBottom: 16,
        animation: `analyzeSlideUp 0.35s ease ${delay * 0.12}s both`,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#3A7A88',
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#3A7A88',
          }}
        />
        {label}
      </div>
      {children}
    </div>
  );
}

function AnalyzeCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      style={{
        background: '#1E2028',
        border: '1px solid rgba(244,243,240,0.05)',
        borderRadius: 6,
        padding: '10px 14px',
        marginBottom: 6,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: 11,
          fontWeight: 500,
          color: '#F4F3F0',
          marginBottom: 3,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: 10,
          color: '#7A756E',
          lineHeight: 1.5,
        }}
      >
        {detail}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Static analysis data per screen
   ───────────────────────────────────────────────── */

interface CardData {
  title: string;
  detail: string;
}

interface ScreenAnalysis {
  onScreen: CardData[];
  patterns: CardData[];
  actions: CardData[];
}

function getAnalysisForScreen(screen: string): ScreenAnalysis {
  switch (screen) {
    case 'daily':
      return {
        onScreen: [
          { title: 'Daily feed active', detail: '12 objects visible. Combined edge count: 47. Average connection strength: 0.64.' },
        ],
        patterns: [
          { title: 'Cluster overlap detected', detail: 'Semiotics and game theory share 2 bridging objects. This is a structural hole worth exploring.' },
          { title: 'Weak signal', detail: '3 recent captures have no engine-generated connections yet. They may contain unlinked entities.' },
        ],
        actions: [
          { title: 'Run engine on visible objects', detail: 'Estimated 4-6 new connections. 2 captures are unprocessed.' },
          { title: 'Review pending candidates', detail: '2 candidates awaiting your feedback. Your reviews train the scorer.' },
        ],
      };
    case 'library':
      return {
        onScreen: [
          { title: 'Library view', detail: '52 objects in graph. 847 edges total. 7 unlinked objects.' },
        ],
        patterns: [
          { title: 'Density increasing', detail: 'Edge density grew 12% this week. Most growth in the information theory cluster.' },
          { title: 'Stale objects', detail: '5 objects have not been touched in 30+ days and have declining connection strength.' },
        ],
        actions: [
          { title: 'Run stress test', detail: 'Last stress test was 3 days ago. Drift may have changed with new captures.' },
          { title: 'Resurface forgotten objects', detail: '8 objects scored high on surprise value but have low recent activity.' },
        ],
      };
    case 'timeline':
      return {
        onScreen: [
          { title: 'Timeline view', detail: 'Showing 30 days of activity. 23 objects created. 89 connections formed.' },
        ],
        patterns: [
          { title: 'Activity burst', detail: 'You captured 8 objects in the last 48 hours, twice the weekly average.' },
          { title: 'Temporal clustering', detail: 'Objects created in the same session tend to connect. 3 session clusters visible.' },
        ],
        actions: [
          { title: 'Process new captures', detail: '3 objects from the latest session are unprocessed. Run the engine to find connections.' },
        ],
      };
    default:
      return {
        onScreen: [
          { title: `${screen} view`, detail: 'Analyzing visible content. Objects and connections are being scanned.' },
        ],
        patterns: [
          { title: 'Analysis available', detail: 'Navigate to a specific view for deeper pattern analysis.' },
        ],
        actions: [
          { title: 'Run engine', detail: 'Process visible objects through the connection engine for new discoveries.' },
        ],
      };
  }
}
