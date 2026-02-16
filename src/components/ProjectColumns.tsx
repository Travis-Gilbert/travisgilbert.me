'use client';

import { useState } from 'react';
import { CaretDown, ArrowSquareOut } from '@phosphor-icons/react';
import ScrollReveal from './ScrollReveal';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

interface ProjectColumnEntry {
  slug: string;
  title: string;
  role: string;
  date: string;
  organization?: string;
  description: string;
  urls: { label: string; url: string }[];
  tags: string[];
}

interface RoleConfig {
  label: string;
  hex: string;
  rgb: string;
  description: string;
}

interface ProjectColumnsProps {
  projects: ProjectColumnEntry[];
}

// ─────────────────────────────────────────────────
// Role configuration
// ─────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, RoleConfig> = {
  'built-&-designed': {
    label: 'Built & Designed',
    hex: '#2D5F6B',
    rgb: '45, 95, 107',
    description: 'Streamlining operations with technology',
  },
  'project-managed': {
    label: 'Project Managed',
    hex: '#B45A2D',
    rgb: '180, 90, 45',
    description: 'Multi-stakeholder coordination',
  },
  organized: {
    label: 'Organized',
    hex: '#C49A4A',
    rgb: '196, 154, 74',
    description: 'Events, conferences, community',
  },
  created: {
    label: 'Created',
    hex: '#5A7A4A',
    rgb: '90, 122, 74',
    description: 'Original content and media',
  },
};

const FALLBACK_ROLE: RoleConfig = {
  label: 'Other',
  hex: '#6A5E52',
  rgb: '106, 94, 82',
  description: '',
};

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function slugifyRole(role: string): string {
  return role.toLowerCase().replace(/\s+/g, '-');
}

function getRoleConfig(roleSlug: string): RoleConfig {
  return ROLE_CONFIG[roleSlug] ?? FALLBACK_ROLE;
}

/** Short month names for consistent SSR/CSR output */
const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

function formatDisplayDate(isoDate: string): string {
  const d = new Date(isoDate);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ─────────────────────────────────────────────────
// ProjectCard
// ─────────────────────────────────────────────────

function ProjectCard({
  project,
  role,
  expanded,
  onToggle,
}: {
  project: ProjectColumnEntry;
  role: RoleConfig;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Three visual states using role color
  const bgOpacity = expanded ? 0.1 : hovered ? 0.09 : 0.055;
  const borderOpacity = expanded ? 0.35 : hovered ? 0.25 : 0;
  const shadowOpacity = expanded ? 0.08 : hovered ? 0.05 : 0.02;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-lg cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-current"
      style={{
        background: `rgba(${role.rgb}, ${bgOpacity})`,
        border: `1px solid rgba(${role.rgb}, ${borderOpacity})`,
        padding: '16px 18px',
        transition: 'all 0.25s ease',
        boxShadow: `0 1px 4px rgba(42, 36, 32, ${shadowOpacity})`,
        color: 'inherit',
      }}
    >
      {/* Collapsed content */}
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-light mb-1.5">
            {formatDisplayDate(project.date)}
          </div>
          <div className="font-title text-lg font-semibold text-ink leading-tight mb-1">
            {project.title}
          </div>
          {project.organization && (
            <div className="font-body text-[13px] text-ink-light leading-snug">
              {project.organization}
            </div>
          )}
        </div>
        <CaretDown
          size={16}
          weight="thin"
          className="text-ink-faint flex-shrink-0 ml-3 mt-2 transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </div>

      {/* Expanded content */}
      <div
        className="overflow-hidden"
        style={{
          maxHeight: expanded ? 400 : 0,
          opacity: expanded ? 1 : 0,
          transition: 'max-height 0.3s ease, opacity 0.25s ease',
        }}
      >
        <div
          className="mt-3.5 pt-3.5"
          style={{ borderTop: `1px dashed rgba(${role.rgb}, 0.2)` }}
        >
          <p className="font-body text-sm leading-relaxed text-ink-secondary m-0 mb-3">
            {project.description}
          </p>

          {/* Tags */}
          {project.tags.length > 0 && (
            <div
              className="flex flex-wrap gap-1.5"
              style={{ marginBottom: project.urls.length > 0 ? 12 : 0 }}
            >
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-secondary rounded px-2 py-0.5"
                  style={{
                    border: `1px solid rgba(${role.rgb}, 0.2)`,
                    background: `rgba(${role.rgb}, 0.04)`,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Links */}
          {project.urls.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {project.urls.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 font-body text-[13px] no-underline hover:opacity-80 transition-opacity"
                  style={{ color: role.hex }}
                >
                  {link.label}
                  <ArrowSquareOut size={12} weight="thin" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// RoleColumn
// ─────────────────────────────────────────────────

function RoleColumn({
  roleSlug,
  projects,
  expandedIds,
  onToggle,
}: {
  roleSlug: string;
  projects: ProjectColumnEntry[];
  expandedIds: Set<string>;
  onToggle: (slug: string) => void;
}) {
  const role = getRoleConfig(roleSlug);
  const sorted = [...projects].sort(
    (a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf()
  );

  return (
    <div className="min-w-0">
      {/* Role header */}
      <div className="mb-6 pb-4" style={{ borderBottom: '2px solid rgba(58, 54, 50, 0.25)' }}>
        <div className="flex items-center gap-2.5 mb-1.5">
          <span
            className="block flex-shrink-0 rounded-full"
            style={{
              width: 10,
              height: 10,
              backgroundColor: role.hex,
            }}
          />
          <span className="font-mono text-base md:text-lg font-bold uppercase tracking-[0.08em] text-ink">
            {role.label}
          </span>
        </div>
        {role.description && (
          <p className="font-body text-sm md:text-base text-ink-secondary m-0 pl-[22px]">
            {role.description}
          </p>
        )}
      </div>

      {/* Thread line + project cards */}
      <div className="relative pl-[18px]">
        {/* Vertical thread line */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: 3,
            width: 1,
            background: `linear-gradient(to bottom, rgba(${role.rgb}, 0.25), rgba(${role.rgb}, 0.05))`,
          }}
        />

        <div className="flex flex-col gap-3">
          {sorted.map((project) => (
            <div key={project.slug} className="relative">
              {/* Small dot on thread line */}
              <div
                className="absolute rounded-full"
                style={{
                  left: -18,
                  top: 22,
                  width: 5,
                  height: 5,
                  backgroundColor: role.hex,
                  opacity: 0.4,
                  transform: 'translateX(1px)',
                }}
              />
              <ProjectCard
                project={project}
                role={role}
                expanded={expandedIds.has(project.slug)}
                onToggle={() => onToggle(project.slug)}
              />
            </div>
          ))}
        </div>

        {/* Column project count */}
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-light">
          {sorted.length} project{sorted.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────

export default function ProjectColumns({ projects }: ProjectColumnsProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(slug: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }

  // Group projects by role slug
  const grouped: Record<string, ProjectColumnEntry[]> = {};
  for (const project of projects) {
    const slug = slugifyRole(project.role);
    if (!grouped[slug]) grouped[slug] = [];
    grouped[slug].push(project);
  }

  // Sort columns: role with most recent project first
  const columnOrder = Object.keys(grouped).sort((a, b) => {
    const latestA = Math.max(
      ...grouped[a].map((p) => new Date(p.date).valueOf())
    );
    const latestB = Math.max(
      ...grouped[b].map((p) => new Date(p.date).valueOf())
    );
    return latestB - latestA;
  });

  const totalProjects = projects.length;
  const totalRoles = columnOrder.length;

  return (
    <div>
      {/* Column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        {columnOrder.map((roleKey, i) => (
          <ScrollReveal key={roleKey} delay={i * 100}>
            <RoleColumn
              roleSlug={roleKey}
              projects={grouped[roleKey]}
              expandedIds={expandedIds}
              onToggle={toggleExpanded}
            />
          </ScrollReveal>
        ))}
      </div>

      {/* Footer count */}
      <div className="mt-14 pt-5 border-t border-border-light">
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-light">
          {totalProjects} project{totalProjects !== 1 ? 's' : ''} across {totalRoles} role{totalRoles !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
