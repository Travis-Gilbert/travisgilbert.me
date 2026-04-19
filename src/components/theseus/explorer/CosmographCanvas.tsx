'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Cosmograph, prepareCosmographData, type CosmographRef } from '@cosmograph/react';
import { makeDefaultCosmographConfig } from '@/lib/theseus/cosmograph/config';
import { useThemeVersion } from '@/hooks/useThemeColor';

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
 * Thin wrapper around `<Cosmograph>` that owns data preparation and
 * theme-aware config. Imperative affordances flow through the exposed
 * CosmographRef; the adapter in src/lib/theseus/cosmograph/adapter.ts
 * drives focus/zoom/colour strategy from SceneDirectives.
 */
const CosmographCanvas = forwardRef<CosmographCanvasHandle, CosmographCanvasProps>(
  ({ points, links, onPointClick, onSimulationTick }, ref) => {
    const cosmoRef = useRef<CosmographRef>(null);
    const themeVersion = useThemeVersion();
    const [prepared, setPrepared] = useState<Record<string, unknown> | null>(null);

    useImperativeHandle(ref, () => ({
      getCosmograph: () => cosmoRef.current ?? null,
    }));

    const defaultConfig = useMemo(
      () => makeDefaultCosmographConfig(themeVersion),
      [themeVersion],
    );

    useEffect(() => {
      let cancelled = false;
      (async () => {
        // Cosmograph's data-prep config requires many fields we do not
        // customise inline; `as any` sidesteps the strict type for those
        // defaults. pointIdBy + pointIndexBy are required by the data
        // kit for unique-id lookup and sequential-integer row mapping.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prepConfig = {
          points: {
            pointIdBy: 'id',
            pointIndexBy: 'index',
            pointColorBy: 'type',
            pointLabelBy: 'label',
          },
          links: { linkSourceBy: 'source', linkTargetsBy: ['target'] },
        } as any;
        const result = await prepareCosmographData(prepConfig, points, links);
        if (!cancelled && result) {
          setPrepared(result as unknown as Record<string, unknown>);
        }
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

    if (!prepared) {
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
        {...defaultConfig}
        {...(prepared as object)}
        onClick={handleClick}
        onSimulationTick={onSimulationTick}
      />
    );
  },
);

CosmographCanvas.displayName = 'CosmographCanvas';
export default CosmographCanvas;
