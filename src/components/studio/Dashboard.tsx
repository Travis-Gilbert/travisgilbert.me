'use client';

import { getMockDashboardIntel } from '@/lib/studio-mock-data';
import { getContentTypeIdentity, getStage } from '@/lib/studio';
import type { StudioContentItemWithMetrics } from '@/lib/studio';
import StudioCard from './StudioCard';
import DashboardSection from './DashboardSection';

/**
 * Studio dashboard: intelligence-driven landing view at /studio.
 *
 * Five categorized sections surface actionable items:
 *   1. Next Session: active drafts/revisions to work on
 *   2. Stuck Items: pieces stalled too long in one stage
 *   3. Closest to Publish: revising/production items near done
 *   4. Research to Convert: research with rich sources
 *   5. Dormant Ideas Worth Reviving: old ideas with strong hooks
 *
 * Pipeline stats and activity feed live in the WorkbenchPanel
 * (collapsible right sidebar). This dashboard focuses on decisions.
 */
export default function Dashboard() {
  const intel = getMockDashboardIntel();

  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Page header */}
      <div className="studio-section-head" style={{ marginBottom: '28px' }}>
        <span className="studio-section-label">Dashboard</span>
        <span className="studio-section-line" />
      </div>

      {/* 1. Next Session */}
      <DashboardSection
        title="Next Session"
        count={intel.nextSession.length}
        emptyMessage="No active drafts or revisions. Start something new."
      >
        {intel.nextSession.length > 0
          ? intel.nextSession.map((item) => (
              <IntelCard key={item.id} item={item} />
            ))
          : null}
      </DashboardSection>

      {/* 2. Stuck Items */}
      <DashboardSection
        title="Stuck Items"
        count={intel.stuckItems.length}
        emptyMessage="Everything is moving. Nice work."
      >
        {intel.stuckItems.length > 0
          ? intel.stuckItems.map((item) => (
              <IntelCard key={item.id} item={item} variant="stuck" />
            ))
          : null}
      </DashboardSection>

      {/* 3. Closest to Publish */}
      <DashboardSection
        title="Closest to Publish"
        count={intel.closestToPublish.length}
        emptyMessage="Nothing in the home stretch yet."
      >
        {intel.closestToPublish.length > 0
          ? intel.closestToPublish.map((item) => (
              <IntelCard key={item.id} item={item} />
            ))
          : null}
      </DashboardSection>

      {/* 4. Research to Convert */}
      <DashboardSection
        title="Research to Convert"
        count={intel.researchToConvert.length}
        emptyMessage="No research items with enough sources to convert."
      >
        {intel.researchToConvert.length > 0
          ? intel.researchToConvert.map((item) => (
              <IntelCard key={item.id} item={item} variant="research" />
            ))
          : null}
      </DashboardSection>

      {/* 5. Dormant Ideas Worth Reviving */}
      <DashboardSection
        title="Dormant Ideas Worth Reviving"
        count={intel.dormantIdeas.length}
        emptyMessage="No dormant ideas with strong hooks."
      >
        {intel.dormantIdeas.length > 0
          ? intel.dormantIdeas.map((item) => (
              <IntelCard key={item.id} item={item} variant="dormant" />
            ))
          : null}
      </DashboardSection>
    </div>
  );
}

/* ── Intelligence card ─────────────────────────── */

type IntelVariant = 'default' | 'stuck' | 'research' | 'dormant';

function IntelCard({
  item,
  variant = 'default',
}: {
  item: StudioContentItemWithMetrics;
  variant?: IntelVariant;
}) {
  const typeInfo = getContentTypeIdentity(item.contentType);
  const stage = getStage(item.stage);

  return (
    <StudioCard
      typeColor={typeInfo.color}
      href={`/studio/${typeInfo.route}/${item.slug}`}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: 'var(--studio-font-title)',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--studio-text-bright)',
          marginBottom: '6px',
          lineHeight: 1.3,
        }}
      >
        {item.title}
      </div>

      {/* Metadata row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <span className="studio-stage-badge" data-stage={item.stage}>
          {stage.label}
        </span>

        {/* Variant-specific metrics */}
        {variant === 'stuck' && (
          <MetricChip
            label={`${item.metrics.stageAgeDays}d in stage`}
            warn
          />
        )}

        {variant === 'research' && (
          <>
            <MetricChip
              label={`${item.metrics.sourcesCollected} sources`}
            />
            <MetricChip
              label={`${item.metrics.linkedNotes} notes`}
            />
          </>
        )}

        {variant === 'dormant' && (
          <>
            <MetricChip
              label={`${item.metrics.daysSinceLastTouched}d dormant`}
            />
            <HookDots strength={item.metrics.hookStrength} />
          </>
        )}

        {variant === 'default' && (
          <MetricChip
            label={`${item.metrics.daysSinceLastTouched}d ago`}
          />
        )}

        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '11px',
            color: 'var(--studio-text-3)',
            marginLeft: 'auto',
          }}
        >
          {item.wordCount.toLocaleString()}w
        </span>
      </div>
    </StudioCard>
  );
}

/* ── Metric chip: compact metadata pill ───────── */

function MetricChip({
  label,
  warn = false,
}: {
  label: string;
  warn?: boolean;
}) {
  return (
    <span
      style={{
        fontFamily: 'var(--studio-font-mono)',
        fontSize: '10px',
        fontWeight: 600,
        color: warn ? 'var(--studio-gold)' : 'var(--studio-text-3)',
        backgroundColor: warn
          ? 'rgba(212, 170, 74, 0.12)'
          : 'var(--studio-surface)',
        border: `1px solid ${
          warn ? 'rgba(212, 170, 74, 0.2)' : 'var(--studio-border)'
        }`,
        borderRadius: '3px',
        padding: '1px 6px',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  );
}

/* ── Hook strength indicator: 1 to 5 dots ─────── */

function HookDots({ strength }: { strength: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        gap: '2px',
        alignItems: 'center',
      }}
      title={`Hook strength: ${strength}/5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor:
              i < strength
                ? 'var(--studio-tc)'
                : 'var(--studio-surface-hover)',
          }}
        />
      ))}
    </span>
  );
}
