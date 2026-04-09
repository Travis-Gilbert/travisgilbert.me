import type { ProgressiveVisualPayload } from '@/lib/theseus-api';
import type { TheseusResponse, VisualizationSection } from '@/lib/theseus-types';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';

export type AskState = 'IDLE' | 'THINKING' | 'MODEL' | 'CONSTRUCTING' | 'EXPLORING';
export type TravelingQueryStage = 'hidden' | 'centered' | 'header';

interface PresentationArgs {
  hasError: boolean;
  state: AskState;
  response: TheseusResponse | null;
  sceneDirective: SceneDirective | null;
}

interface PresentationState {
  isExploring: boolean;
  hasScene: boolean;
  queryStage: TravelingQueryStage;
}

function upsertVisualizationSection(
  sections: TheseusResponse['sections'],
  visualization: VisualizationSection | undefined,
): TheseusResponse['sections'] {
  if (!visualization) return sections;
  const nextSections = sections.filter(
    (section) => section.type !== 'visualization',
  ) as TheseusResponse['sections'];
  return [...nextSections, visualization] as TheseusResponse['sections'];
}

export function mergeProgressiveVisualPayload(
  response: TheseusResponse | null,
  payload: ProgressiveVisualPayload,
): TheseusResponse | null {
  if (!response) return response;

  return {
    ...response,
    answer_type: payload.answer_type ?? response.answer_type,
    reference_image_url: payload.reference_image_url ?? response.reference_image_url,
    geographic_regions: payload.geographic_regions ?? response.geographic_regions,
    sections: upsertVisualizationSection(response.sections, payload.visualization),
  };
}

export function getAskPresentationState({
  hasError,
  state,
  response,
  sceneDirective,
}: PresentationArgs): PresentationState {
  const hasAnswer = Boolean(response);
  const isExploring = state === 'EXPLORING' && hasAnswer;
  const hasScene = isExploring && Boolean(sceneDirective);

  if (hasError || state === 'IDLE') {
    return {
      isExploring,
      hasScene,
      queryStage: 'hidden',
    };
  }

  if (hasAnswer && state !== 'THINKING') {
    return {
      isExploring,
      hasScene,
      queryStage: 'header',
    };
  }

  return {
    isExploring,
    hasScene,
    queryStage: 'centered',
  };
}
