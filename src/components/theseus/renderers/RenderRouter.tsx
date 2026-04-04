'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { TheseusResponse } from '@/lib/theseus-types';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import ConstructionAnimator from './ConstructionAnimator';
import D3Renderer from './D3Renderer';
import type { ConstructionPlayback } from './rendering';
import { graphShape, truthMapShape, type ShapeResult } from './shapes';

// Browser-only renderers: these libraries access `window` at import time
const ContextShelf = dynamic(() => import('./ContextShelf'), { ssr: false });
const ForceGraph3DRenderer = dynamic(() => import('./ForceGraph3DRenderer'), { ssr: false });
const ParticleField = dynamic(() => import('./ParticleField'), { ssr: false });
const SigmaRenderer = dynamic(() => import('./SigmaRenderer'), { ssr: false });
const VegaRenderer = dynamic(() => import('./VegaRenderer'), { ssr: false });

const PARTICLE_COUNT = 30_000;

interface RenderRouterProps {
  directive: SceneDirective;
  response: TheseusResponse;
  onSelectNode?: (nodeId: string) => void;
  onCrystallizeComplete?: () => void;
}

type RenderTarget = SceneDirective['render_target']['primary'] | SceneDirective['render_target']['fallback'];

function createEmptyPlayback(totalMs: number): ConstructionPlayback {
  return {
    elapsedMs: 0,
    totalMs,
    phaseProgress: {
      focal_nodes_appear: 0,
      supporting_nodes_appear: 0,
      edges_draw: 0,
      clusters_coalesce: 0,
      data_builds: 0,
      labels_fade_in: 0,
      crystallize: 0,
    },
    isComplete: false,
  };
}

function ParticleFieldLayer({
  directive,
  response,
  playback,
  onSelectNode,
}: {
  directive: SceneDirective;
  response: TheseusResponse;
  playback: ConstructionPlayback;
  onSelectNode?: (nodeId: string) => void;
}) {
  const isMapMode = !!directive.truth_map_topology;
  const shapeResult = useMemo<ShapeResult>(
    () => (isMapMode ? truthMapShape : graphShape).generate({
      response,
      directive,
      particleCount: PARTICLE_COUNT,
    }),
    [response, directive, isMapMode],
  );

  return (
    <ParticleField
      className="theseus-interactive"
      playback={playback}
      shapeResult={shapeResult}
      onSelectNode={onSelectNode}
      particleCount={PARTICLE_COUNT}
    />
  );
}

function RendererLayer({
  target,
  active,
  directive,
  response,
  playback,
  onSelectNode,
  onError,
}: {
  target: RenderTarget;
  active: boolean;
  directive: SceneDirective;
  response: TheseusResponse;
  playback: ConstructionPlayback;
  onSelectNode?: (nodeId: string) => void;
  onError: (target: RenderTarget, error: Error) => void;
}) {
  const common = {
    directive,
    response,
    playback,
    onSelectNode,
  };

  const content = (() => {
    switch (target) {
      case 'particle-field':
        return (
          <ParticleFieldLayer
            directive={directive}
            response={response}
            playback={playback}
            onSelectNode={onSelectNode}
          />
        );
      case 'force-graph-3d':
        return (
          <ForceGraph3DRenderer
            {...common}
            onError={(error) => onError(target, error)}
          />
        );
      case 'sigma-2d':
        return (
          <SigmaRenderer
            {...common}
            onError={(error) => onError(target, error)}
          />
        );
      case 'd3':
        return (
          <>
            <D3Renderer
              directive={directive}
              playback={playback}
              onContextSelect={onSelectNode}
              onError={(error) => onError(target, error)}
            />
            <ContextShelf {...common} />
          </>
        );
      case 'vega-lite':
        return (
          <>
            <VegaRenderer
              directive={directive}
              playback={playback}
              onContextSelect={onSelectNode}
              onError={(error) => onError(target, error)}
            />
            <ContextShelf {...common} />
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <div
      className="theseus-interactive"
      style={{
        position: 'absolute',
        inset: 0,
        opacity: active ? 1 : 0,
        transition: 'opacity 600ms ease',
      }}
    >
      {content}
    </div>
  );
}

export default function RenderRouter({
  directive,
  response,
  onSelectNode,
  onCrystallizeComplete,
}: RenderRouterProps) {
  const totalDuration = useMemo(
    () => Math.max(
      directive.construction.total_duration_ms,
      ...directive.construction.phases.map((phase) => phase.delay_ms + phase.duration_ms),
      0,
    ),
    [directive.construction],
  );

  const [playback, setPlayback] = useState<ConstructionPlayback>(() => createEmptyPlayback(totalDuration));
  const [failedTargets, setFailedTargets] = useState<Set<RenderTarget>>(new Set());
  const [activeTarget, setActiveTarget] = useState<RenderTarget>(directive.render_target.primary);
  const [previousTarget, setPreviousTarget] = useState<RenderTarget | null>(null);

  const resolvedTarget = failedTargets.has(directive.render_target.primary)
    ? directive.render_target.fallback
    : directive.render_target.primary;

  useEffect(() => {
    setPlayback(createEmptyPlayback(totalDuration));
    setFailedTargets(new Set());
  }, [directive, totalDuration]);

  useEffect(() => {
    if (resolvedTarget === activeTarget) {
      return;
    }

    setPreviousTarget(activeTarget);
    setActiveTarget(resolvedTarget);

    const timeoutId = window.setTimeout(() => {
      setPreviousTarget(null);
    }, 600);

    return () => window.clearTimeout(timeoutId);
  }, [activeTarget, resolvedTarget]);

  const handleRendererError = useCallback((target: RenderTarget, _error: Error) => {
    setFailedTargets((current) => {
      if (current.has(target)) {
        return current;
      }

      const next = new Set(current);
      next.add(target);
      return next;
    });
  }, []);

  const handleAnimationUpdate = useCallback((nextPlayback: ConstructionPlayback) => {
    setPlayback(nextPlayback);
  }, []);

  const handleAnimationComplete = useCallback(() => {
    onCrystallizeComplete?.();
  }, [onCrystallizeComplete]);

  return (
    <div className="theseus-interactive" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <ConstructionAnimator
        construction={directive.construction}
        onUpdate={handleAnimationUpdate}
        onComplete={handleAnimationComplete}
      />

      {previousTarget && previousTarget !== activeTarget && (
        <RendererLayer
          target={previousTarget}
          active={false}
          directive={directive}
          response={response}
          playback={playback}
          onSelectNode={onSelectNode}
          onError={handleRendererError}
        />
      )}

      <RendererLayer
        target={activeTarget}
        active
        directive={directive}
        response={response}
        playback={playback}
        onSelectNode={onSelectNode}
        onError={handleRendererError}
      />
    </div>
  );
}
