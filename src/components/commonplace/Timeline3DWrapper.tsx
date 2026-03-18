'use client';

/**
 * Timeline3DWrapper: Fallback wrapper for the 3D timeline.
 *
 * Handles:
 *   WebGL2 detection (falls back to 2D if missing)
 *   prefers-reduced-motion check (falls back to 2D)
 *   Mobile detection (falls back to 2D)
 *   React.lazy + Suspense with 2D fallback
 *   Error boundary (falls back to 2D on WebGL context loss)
 *   Scroll container div (provides scroll height for GSAP)
 *   Search/filter overlay (fixed DOM above canvas)
 */

import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  Component,
  type ReactNode,
} from 'react';
import {
  fetchFeed,
  useApiData,
} from '@/lib/commonplace-api';
import { useCommonPlace } from '@/lib/commonplace-context';
import { useIsAppShellMobile } from '@/hooks/useIsAppShellMobile';
import { computeTimeline3DLayout, type TimelineNode3D } from '@/lib/timeline-3d-layout';
import { renderableFromMockNode } from './objectRenderables';
import TimelineView from './TimelineView';
import TimelineSearch from './TimelineSearch';
import type { TimelineFilters } from './TimelineSearch';
import type { MockNode } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Lazy-loaded 3D scene (separate chunk)
   ───────────────────────────────────────────────── */

const Timeline3DScene = lazy(() => import('./Timeline3DScene'));

/* ─────────────────────────────────────────────────
   WebGL detection
   ───────────────────────────────────────────────── */

function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ─────────────────────────────────────────────────
   Error boundary
   ───────────────────────────────────────────────── */

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class Timeline3DErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 12,
              zIndex: 10,
              fontFamily: 'var(--cp-font-mono, monospace)',
              fontSize: 10,
              color: 'var(--cp-text-faint, #8A7E72)',
              background: 'var(--cp-surface, #2A2420)',
              border: '1px solid var(--cp-border, #3D3530)',
              borderRadius: 4,
              padding: '4px 8px',
            }}
          >
            3D view unavailable. Showing classic timeline.
          </div>
          {this.props.fallback}
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─────────────────────────────────────────────────
   Main wrapper
   ───────────────────────────────────────────────── */

export default function Timeline3DWrapper() {
  const isMobile = useIsAppShellMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [filters, setFilters] = useState<TimelineFilters>({
    query: '',
    activeTypes: new Set<string>(),
  });

  // Detect WebGL capability synchronously (no effect needed, these are sync checks)
  const canRender3D = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return hasWebGL2() && !prefersReducedMotion();
  }, []);

  const { captureVersion, openDrawer, openContextMenu } = useCommonPlace();

  // Fetch feed data
  const { data: feed, loading, error } = useApiData(fetchFeed, [captureVersion]);

  // Apply filters
  const filteredNodes = useMemo(() => {
    const nodes = feed ?? [];
    let result = nodes;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.summary?.toLowerCase().includes(q) ?? false),
      );
    }
    if (filters.activeTypes.size > 0) {
      result = result.filter((n) => filters.activeTypes.has(n.objectType));
    }
    return result;
  }, [feed, filters]);

  // Compute layout for scroll height
  const layout = useMemo(
    () => computeTimeline3DLayout(filteredNodes),
    [filteredNodes],
  );

  // Scroll handler: maps scrollTop to 0..1 progress
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onScroll() {
      if (!el) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) {
        setScrollProgress(0);
        return;
      }
      setScrollProgress(Math.min(el.scrollTop / maxScroll, 1));
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Drawer handler: convert TimelineNode3D to ObjectDrawer slug
  const handleOpenDrawer = useCallback(
    (slug: string) => {
      openDrawer(slug);
    },
    [openDrawer],
  );

  // Context menu: convert 3D node to screen coordinates
  const handleContextMenu = useCallback(
    (x: number, y: number, node: TimelineNode3D) => {
      const mockNode: MockNode = {
        id: node.id,
        objectRef: node.objectRef,
        objectSlug: node.objectSlug,
        objectType: node.objectType,
        title: node.title,
        summary: node.summary,
        capturedAt: node.capturedAt,
        edgeCount: node.edgeCount,
        edges: node.edges,
      };
      const renderable = renderableFromMockNode(mockNode);
      openContextMenu(x, y, renderable);
    },
    [openContextMenu],
  );

  // Fallback: mobile or no WebGL2 or prefers-reduced-motion
  if (isMobile || !canRender3D) {
    return <TimelineView />;
  }

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Search/filter overlay (fixed DOM above canvas) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          pointerEvents: 'auto',
        }}
      >
        <TimelineSearch
          filters={filters}
          onChange={setFilters}
          resultCount={filteredNodes.length}
        />
      </div>

      {/* Scroll container: invisible tall div drives GSAP progress */}
      <div
        ref={scrollRef}
        className="cp-scrollbar"
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'auto',
          zIndex: 5,
          pointerEvents: 'auto',
        }}
      >
        {/* Invisible spacer that makes the container scrollable */}
        <div
          style={{
            height: layout.scrollHeight || 2000,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* 3D Canvas (behind scroll container, receives pointer events via passthrough) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
        }}
      >
        <Timeline3DErrorBoundary fallback={<TimelineView />}>
          <Suspense fallback={<TimelineView />}>
            {!loading && !error && (
              <Timeline3DScene
                feedNodes={filteredNodes}
                scrollProgress={scrollProgress}
                onOpenDrawer={handleOpenDrawer}
                onContextMenu={handleContextMenu}
              />
            )}
          </Suspense>
        </Timeline3DErrorBoundary>
      </div>

      {/* Loading / error states (shown above canvas) */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--cp-surface, #2A2420)',
          }}
        >
          <div className="cp-loading-spinner" aria-label="Loading timeline" />
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
          }}
        >
          <TimelineView />
        </div>
      )}
    </div>
  );
}
