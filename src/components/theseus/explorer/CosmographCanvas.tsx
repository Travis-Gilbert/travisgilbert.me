'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Cosmograph,
  prepareCosmographData,
  type CosmographConfig,
  type CosmographRef,
} from '@cosmograph/react';

export interface CosmographCanvasProps {
  points: Array<Record<string, unknown>>;
  links: Array<Record<string, unknown>>;
  onPointClick?: (pointId: string) => void;
  onSimulationTick?: () => void;
}

export interface CosmographCanvasHandle {
  getCosmograph(): CosmographRef | null;
}

/**
 * Thin wrapper around `<Cosmograph>`. Owns data preparation and exposes
 * the Cosmograph imperative handle upward. The adapter in
 * src/lib/theseus/cosmograph/adapter.ts drives focus/zoom/colour
 * strategy from SceneDirectives.
 */
const CosmographCanvas = forwardRef<CosmographCanvasHandle, CosmographCanvasProps>(
  ({ points, links, onPointClick, onSimulationTick }, ref) => {
    const cosmoRef = useRef<CosmographRef>(null);
    const [config, setConfig] = useState<Partial<CosmographConfig> | null>(null);

    useImperativeHandle(ref, () => ({
      getCosmograph: () => cosmoRef.current ?? null,
    }));

    useEffect(() => {
      let cancelled = false;
      (async () => {
        // Canonical pattern from @cosmograph/react README:
        //   const { points, links, cosmographConfig } = await prepareCosmographData(...)
        //   setConfig({ points, links, ...cosmographConfig })
        const result = await prepareCosmographData(
          {
            points: {
              pointIdBy: 'id',
              pointColorBy: 'type',
              pointLabelBy: 'label',
            },
            links: { linkSourceBy: 'source', linkTargetsBy: ['target'] },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          points,
          links,
        );
        if (cancelled || !result) return;
        const { points: pts, links: lks, cosmographConfig } = result as unknown as {
          points: unknown;
          links: unknown;
          cosmographConfig: Record<string, unknown>;
        };
        // Prep emits linkTargetBy (singular); the Cosmograph runtime reads
        // linkTargetsBy (plural array) in some paths. Translate if missing.
        const normalizedConfig: Record<string, unknown> = { ...cosmographConfig };
        if (normalizedConfig.linkTargetBy && !normalizedConfig.linkTargetsBy) {
          normalizedConfig.linkTargetsBy = [normalizedConfig.linkTargetBy];
        }
        setConfig({
          points: pts,
          links: lks,
          ...normalizedConfig,
          backgroundColor: 'rgba(0, 0, 0, 0)',
          fitViewOnInit: true,
        } as Partial<CosmographConfig>);
      })();
      return () => {
        cancelled = true;
      };
    }, [points, links]);

    const handleClick = (point: unknown) => {
      if (!onPointClick) return;
      const id = (point as { id?: string } | undefined)?.id;
      if (id) onPointClick(id);
    };

    if (!config) {
      return (
        <div
          aria-busy="true"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-hero-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Preparing graph
        </div>
      );
    }

    return (
      <Cosmograph
        ref={cosmoRef}
        {...config}
        onClick={handleClick}
        onSimulationTick={onSimulationTick}
      />
    );
  },
);

CosmographCanvas.displayName = 'CosmographCanvas';
export default CosmographCanvas;
