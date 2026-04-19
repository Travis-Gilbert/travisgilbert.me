'use client';

import type { FC } from 'react';
import TextPart from './parts/TextPart';
import CitationPart from './parts/CitationPart';
import SceneDirectivePart from './parts/SceneDirectivePart';
import VisualAnswerPart from './parts/VisualAnswerPart';
import MosaicPart from './parts/MosaicPart';
import GraphPart from './parts/GraphPart';

export type MessagePart =
  | { type: 'text'; text: string }
  | {
      type: 'citation';
      source: string;
      year: number;
      confidence: number;
      anchor: string;
    }
  | {
      type: 'visual-answer';
      directive?: unknown;
      spec?: unknown;
      graphPoints?: Array<Record<string, unknown>>;
      graphLinks?: Array<Record<string, unknown>>;
    }
  | {
      type: 'mosaic';
      spec: unknown;
    }
  | {
      type: 'graph';
      directive: unknown;
      points: Array<Record<string, unknown>>;
      links?: Array<Record<string, unknown>>;
    }
  | {
      type: 'scene-directive';
      directive: unknown;
      label?: string;
    }
  | { type: 'tool-call'; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; result: unknown };

interface MessagePartRendererProps {
  part: MessagePart;
}

/**
 * Dispatches a custom message part to the right renderer. Tool parts are
 * silent here: the forked AssistantMessage uses `MessagePrimitive.Parts`
 * with the assistant-ui tool-fallback component for those.
 */
const MessagePartRenderer: FC<MessagePartRendererProps> = ({ part }) => {
  switch (part.type) {
    case 'text':
      return <TextPart text={part.text} />;
    case 'citation':
      return (
        <CitationPart
          source={part.source}
          year={part.year}
          confidence={part.confidence}
          anchor={part.anchor}
        />
      );
    case 'scene-directive':
      return (
        <SceneDirectivePart
          /* directive shape is checked by SceneDirectivePart's own types */
          directive={part.directive as never}
          label={part.label}
        />
      );
    case 'visual-answer':
      return (
        <VisualAnswerPart
          directive={part.directive as never}
          spec={part.spec}
          graphPoints={part.graphPoints}
          graphLinks={part.graphLinks}
        />
      );
    case 'mosaic':
      return <MosaicPart spec={part.spec} />;
    case 'graph':
      return (
        <GraphPart
          directive={part.directive as never}
          points={part.points}
          links={part.links}
        />
      );
    case 'tool-call':
    case 'tool-result':
      return null;
    default:
      return null;
  }
};

export default MessagePartRenderer;
