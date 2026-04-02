'use client';

import type { TheseusResponse } from '@/lib/theseus-types';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import RenderRouter from './RenderRouter';

interface SceneRouterProps {
  directive: SceneDirective;
  response: TheseusResponse;
  onSelectNode?: (nodeId: string) => void;
  onCrystallizeComplete?: () => void;
}

export default function SceneRouter(props: SceneRouterProps) {
  return <RenderRouter {...props} />;
}
