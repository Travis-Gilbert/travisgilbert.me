'use client';

import { useState, Suspense, lazy } from 'react';
import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { ProjectCardData } from './projects-data';

/* Lazy-load the R3F components (keeps initial bundle smaller) */
const TheseusVisual3D = lazy(() => import('./visuals/TheseusVisual3D'));
const CommonPlaceVisual3D = lazy(() => import('./visuals/CommonPlaceVisual3D'));

/* Direct imports for 2D visuals (small, always needed) */
import TheseusVisual from './visuals/TheseusVisual';
import CommonPlaceVisual from './visuals/CommonPlaceVisual';
import IndexApiVisual from './visuals/IndexApiVisual';
import GatehouseVisual from './visuals/GatehouseVisual';
import PorchfestVisual from './visuals/PorchfestVisual';
import ComplianceVisual from './visuals/ComplianceVisual';
import YoutubeVisual from './visuals/YoutubeVisual';
import DjangoDesignVisual from './visuals/DjangoDesignVisual';

/* ---- Theme colors ---- */

const ENGINE_ACCENT = '#C4503C';
const CHROME = '#1C1C20';

function visualBg(theme: ProjectCardData['theme']): string {
  switch (theme) {
    case 'dark':
      return CHROME;
    case 'warm':
      return '#F0EBE4';
    case 'warm-teal':
      return 'linear-gradient(135deg, #EEF3F4, #E8EEEF)';
    case 'warm-gold':
      return 'linear-gradient(135deg, #F7F2E8, #F0EBE0)';
    case 'warm-green':
      return 'linear-gradient(135deg, #F0F4F0, #E8EFE8)';
    case 'warm-purple':
      return 'linear-gradient(135deg, #F2EFF4, #ECE8F0)';
  }
}

function resolveColor(roleColor: string): string {
  if (roleColor === '--color-engine-accent') return ENGINE_ACCENT;
  return `var(${roleColor})`;
}

/* ---- Sub-components ---- */

function RoleBadge({ role, color, textOverride }: { role: string; color: string; textOverride?: string }) {
  const resolved = resolveColor(color);
  const displayColor = textOverride ?? resolved;
  return (
    <span
      className="inline-flex items-center gap-[5px] font-mono text-[9px] font-semibold uppercase tracking-[0.1em] self-start rounded-sm"
      style={{
        padding: '2px 8px',
        color: displayColor,
        background: `color-mix(in srgb, ${resolved} 8%, transparent)`,
      }}
    >
      <span
        className="block flex-shrink-0 rounded-full"
        style={{ width: 5, height: 5, backgroundColor: resolved }}
      />
      {role}
    </span>
  );
}

function PoweredByBadge({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center gap-[5px] font-mono text-[9px] font-medium tracking-[0.06em] mt-2"
      style={{ color: ENGINE_ACCENT, opacity: 0.65 }}
    >
      <span
        className="block rounded-full"
        style={{ width: 4, height: 4, backgroundColor: ENGINE_ACCENT }}
      />
      Powered by {name}
    </span>
  );
}

/* ---- Visual Renderer ---- */

function CardVisual({ visual, isHovered }: { visual: string; isHovered: boolean }) {
  switch (visual) {
    case 'theseus':
      return (
        <Suspense fallback={<TheseusVisual isHovered={isHovered} />}>
          <TheseusVisual3D isHovered={isHovered} />
        </Suspense>
      );
    case 'commonplace':
      return (
        <Suspense fallback={<CommonPlaceVisual isHovered={isHovered} />}>
          <CommonPlaceVisual3D isHovered={isHovered} />
        </Suspense>
      );
    case 'index-api':
      return <IndexApiVisual isHovered={isHovered} />;
    case 'gatehouse':
      return <GatehouseVisual isHovered={isHovered} />;
    case 'porchfest':
      return <PorchfestVisual isHovered={isHovered} />;
    case 'compliance':
      return <ComplianceVisual isHovered={isHovered} />;
    case 'youtube':
      return <YoutubeVisual isHovered={isHovered} />;
    case 'django-design':
      return <DjangoDesignVisual isHovered={isHovered} />;
    default:
      return null;
  }
}

/* ---- Main component ---- */

interface ProjectCardProps {
  data: ProjectCardData;
  delay?: number;
}

export default function ProjectCard({ data, delay = 0 }: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isDark = data.theme === 'dark';
  const prefersReducedMotion = usePrefersReducedMotion();
  const isTheseus = data.slug === 'theseus';

  /* Is this a 3D card? If so, visual area is transparent */
  const is3D = data.visual === 'theseus' || data.visual === 'commonplace';

  const cardBg = isDark ? CHROME : '#fff';
  const cardBorder = isDark
    ? '1px solid rgba(255,255,255,0.06)'
    : `1px solid ${isHovered ? 'var(--color-border)' : 'var(--color-border-light)'}`;
  const hoverShadow = isDark
    ? '0 12px 40px rgba(196,80,60,0.15)'
    : '0 12px 40px rgba(0,0,0,0.10)';

  const vBg = visualBg(data.theme);
  const isGradient = vBg.startsWith('linear');

  return (
    <ScrollReveal delay={delay} className="h-full">
      <Link
        href={data.href}
        className="block h-full rounded-md overflow-hidden no-underline outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-current"
        style={{
          background: cardBg,
          border: cardBorder,
          position: 'relative',
          cursor: 'pointer',
          transition: prefersReducedMotion
            ? 'none'
            : 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
          transform: isHovered && !prefersReducedMotion ? 'translateY(-4px)' : 'none',
          boxShadow: isHovered ? hoverShadow : '0 1px 3px rgba(0,0,0,0.04)',
          color: 'inherit',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Glow overlay (Theseus only) */}
        {isDark && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: -1,
              borderRadius: 7,
              background:
                'radial-gradient(ellipse at 40% 30%, rgba(196,80,60,0.12) 0%, transparent 60%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}

        {/* Visual area */}
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 10',
            position: 'relative',
            /* 3D cards: transparent bg, allow slight overflow for floating effect */
            overflow: is3D ? 'visible' : 'hidden',
            zIndex: 1,
            ...(is3D
              ? { background: 'transparent' }
              : isGradient
                ? { backgroundImage: vBg }
                : { backgroundColor: vBg }),
            ...(data.theme === 'warm' && !is3D
              ? { borderBottom: '1px solid var(--color-border-light)' }
              : {}),
          }}
        >
          <CardVisual visual={data.visual} isHovered={isHovered} />

          {/* Hover hint */}
          <span
            className="font-mono text-[9px] tracking-[0.08em] uppercase"
            style={{
              position: 'absolute',
              bottom: 10,
              right: 12,
              padding: '3px 8px',
              borderRadius: 2,
              opacity: isHovered ? 1 : 0,
              transition: 'opacity 0.3s ease',
              pointerEvents: 'none',
              zIndex: 2,
              color: isDark ? 'rgba(255,255,255,0.4)' : 'var(--color-ink-muted)',
              background: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.8)',
            }}
          >
            Explore project
          </span>
        </div>

        {/* Info area */}
        <div
          className="flex-1 flex flex-col"
          style={{
            padding: '18px 20px 22px',
            position: 'relative',
            zIndex: 1,
            ...(isDark ? { background: CHROME } : {}),
          }}
        >
          <RoleBadge
            role={data.role}
            color={data.roleColor}
            textOverride={isTheseus ? '#EAE6DE' : undefined}
          />

          <h2
            className={
              isTheseus
                ? 'text-2xl leading-tight mt-2 mb-0.5 uppercase'
                : 'font-title text-2xl font-bold leading-tight mt-2 mb-0.5'
            }
            style={{
              color: isTheseus ? ENGINE_ACCENT : isDark ? '#EAE6DE' : 'var(--color-ink)',
              ...(isTheseus
                ? {
                    fontFamily: 'var(--font-code)',
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                    filter: 'blur(0.3px)',
                    WebkitTextStroke: '0.5px currentColor',
                  }
                : {}),
            }}
          >
            {data.title}
          </h2>

          {data.subtitle && (
            <span
              className="font-mono text-[11px] font-medium tracking-[0.06em] mb-2"
              style={{ color: isTheseus ? '#EAE6DE' : isDark ? ENGINE_ACCENT : 'var(--color-ink-muted)' }}
            >
              {data.subtitle}
            </span>
          )}

          {data.organization && (
            <span
              className="text-xs mb-2"
              style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'var(--color-ink-muted)' }}
            >
              {data.organization}
            </span>
          )}

          <p
            className="text-sm font-light leading-relaxed flex-1"
            style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'var(--color-ink-secondary)' }}
          >
            {data.description}
          </p>

          {data.callout && (
            <div
              className="font-title text-sm italic mt-3 pt-2.5"
              style={{
                color: isDark ? 'rgba(255,255,255,0.4)' : 'var(--color-ink-secondary)',
                borderTop: isDark
                  ? '1px solid rgba(255,255,255,0.08)'
                  : '1px solid var(--color-border-light)',
              }}
            >
              {data.callout}
            </div>
          )}

          {data.poweredBy && <PoweredByBadge name={data.poweredBy} />}

          <span
            className="font-mono text-[9px] tracking-[0.08em] uppercase mt-2.5"
            style={{ color: isDark ? 'rgba(255,255,255,0.25)' : 'var(--color-ink-faint)' }}
          >
            {data.date}
          </span>
        </div>
      </Link>
    </ScrollReveal>
  );
}
