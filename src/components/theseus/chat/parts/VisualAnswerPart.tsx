'use client';

import type { FC } from 'react';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import { resolveRenderTarget } from '@/lib/theseus/sceneDirector/directive';
import { isMosaicSpec } from '@/lib/theseus/mosaic/specs';
import MosaicPart from './MosaicPart';
import GraphPart from './GraphPart';
import SceneDirectivePart from './SceneDirectivePart';

interface VisualAnswerPartProps {
  directive?: SceneDirective | null;
  spec?: unknown;
  graphPoints?: Array<Record<string, unknown>>;
  graphLinks?: Array<Record<string, unknown>>;
}

/**
 * Paper-register dispatcher. Decides whether the answer card renders a
 * Cosmograph inline (graph target), a Mosaic chart (mosaic target), or
 * text-only (no visual).
 */
const VisualAnswerPart: FC<VisualAnswerPartProps> = ({
  directive,
  spec,
  graphPoints,
  graphLinks,
}) => {
  const target = resolveRenderTarget(directive ?? null);

  if (target === 'graph' && directive && graphPoints && graphPoints.length > 0) {
    return (
      <div className="aui-visual-answer" style={{ marginTop: 12 }}>
        <GraphPart
          directive={directive}
          points={graphPoints}
          links={graphLinks}
        />
        <div style={{ marginTop: 8 }}>
          <SceneDirectivePart directive={directive} label="Show full graph" />
        </div>
      </div>
    );
  }

  if (target === 'mosaic' && isMosaicSpec(spec)) {
    return (
      <div className="aui-visual-answer" style={{ marginTop: 12 }}>
        <MosaicPart spec={spec} />
      </div>
    );
  }

  // Text target: nothing inline. SceneDirectivePart still offers a one-click
  // jump to the Explorer when the answer references graph evidence.
  if (target === 'graph' && directive) {
    return (
      <div className="aui-visual-answer" style={{ marginTop: 12 }}>
        <SceneDirectivePart directive={directive} />
      </div>
    );
  }

  return null;
};

export default VisualAnswerPart;
