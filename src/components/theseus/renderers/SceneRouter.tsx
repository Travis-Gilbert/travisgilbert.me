'use client';

/**
 * SceneRouter: Picks the right renderer based on SceneSpec.render_target.
 *
 *   r3f:       <R3FRenderer /> (nodes + edges in 3D)
 *   d3:        <D3Renderer /> overlay + <ContextShelf /> (R3F nodes)
 *   vega-lite: <VegaRenderer /> overlay + <ContextShelf /> (R3F nodes)
 *
 * A single Canvas instance is always mounted to avoid WebGL context
 * teardown/rebuild on render_target changes. Transitions fade over 600ms.
 */

import { useState, useEffect, Suspense, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import type { SceneSpec } from '@/lib/theseus-viz/SceneSpec';
import R3FRenderer from './R3FRenderer';
import ContextShelf from './ContextShelf';
import D3Renderer from './D3Renderer';
import VegaRenderer from './VegaRenderer';

const TRANSITION_MS = 600;
const CANVAS_BG = '#0f1012';

interface SceneRouterProps {
  sceneSpec: SceneSpec;
  onSelectNode?: (nodeId: string) => void;
}

/**
 * Manages the fade transition when render_target changes.
 * Returns the actively-displayed spec and current opacity.
 */
function useTransition(sceneSpec: SceneSpec) {
  const [activeSpec, setActiveSpec] = useState(sceneSpec);
  const [opacity, setOpacity] = useState(1);
  const [prevTarget, setPrevTarget] = useState(sceneSpec.render_target);

  if (sceneSpec.render_target === prevTarget && sceneSpec !== activeSpec) {
    /* Same render_target, new spec data: swap immediately */
    setActiveSpec(sceneSpec);
  }

  if (sceneSpec.render_target !== prevTarget) {
    /* Render_target changed: start fade-out synchronously */
    setPrevTarget(sceneSpec.render_target);
    setOpacity(0);
  }

  useEffect(() => {
    if (opacity > 0) return;
    /* opacity just went to 0: wait half-transition, swap spec, fade in */
    const timer = setTimeout(() => {
      setActiveSpec(sceneSpec);
      setOpacity(1);
    }, TRANSITION_MS / 2);
    return () => clearTimeout(timer);
  }, [opacity, sceneSpec]);

  return { activeSpec, opacity };
}

export default function SceneRouter({ sceneSpec, onSelectNode }: SceneRouterProps) {
  const { activeSpec, opacity } = useTransition(sceneSpec);

  const handleNodeClick = useCallback(
    (id: string) => onSelectNode?.(id),
    [onSelectNode],
  );

  const handleValueClick = useCallback(
    (value: string) => onSelectNode?.(value),
    [onSelectNode],
  );

  const renderTarget = activeSpec.render_target;
  const hasDataLayer = !!activeSpec.data_layer;
  const needsContextShelf =
    (renderTarget === 'd3' || renderTarget === 'vega-lite') && hasDataLayer;
  const needsR3FGraph = renderTarget === 'r3f' || !hasDataLayer;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        opacity,
        transition: `opacity ${TRANSITION_MS / 2}ms ease-in-out`,
      }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{
          position: activeSpec.camera.position,
          fov: activeSpec.camera.fov,
        }}
        style={{
          position: 'absolute',
          inset: 0,
          background: CANVAS_BG,
        }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          {needsR3FGraph && (
            <R3FRenderer
              sceneSpec={activeSpec}
              onSelectNode={handleNodeClick}
            />
          )}
          {needsContextShelf && (
            <ContextShelf
              sceneSpec={activeSpec}
              onSelectNode={handleNodeClick}
            />
          )}
        </Suspense>
      </Canvas>

      {renderTarget === 'd3' && hasDataLayer && (
        <D3Renderer
          dataLayer={activeSpec.data_layer!}
          onNodeClick={handleNodeClick}
        />
      )}

      {renderTarget === 'vega-lite' && hasDataLayer && (
        <VegaRenderer
          dataLayer={activeSpec.data_layer!}
          onValueClick={handleValueClick}
        />
      )}
    </div>
  );
}
