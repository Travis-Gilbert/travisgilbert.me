'use client';

import type { ObjectListItem } from '@/lib/commonplace';
import NoteCard from './NoteCard';
import SourceCard from './SourceCard';
import PersonPill from './PersonPill';
import ConceptNode from './ConceptNode';
import HunchSticky from './HunchSticky';
import QuoteBlock from './QuoteBlock';
import TaskRow from './TaskRow';
import EventBadge from './EventBadge';
import ScriptBlock from './ScriptBlock';
import PlacePin from './PlacePin';
import type { ComponentType } from 'react';

export interface RenderableObject extends Partial<ObjectListItem> {
  id: number;
  title: string;
  object_type_slug: string;
  display_title?: string;
  body?: string;
  captured_at?: string;
  edge_count?: number;
  url?: string;
  og_title?: string;
  og_description?: string;
  og_site_name?: string;
  og_image?: string;
  og_favicon?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ObjectCardProps {
  object: RenderableObject;
  compact?: boolean;
  onClick?: (obj: RenderableObject) => void;
  onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
}

const RENDERERS: Record<string, ComponentType<ObjectCardProps>> = {
  note: NoteCard,
  source: SourceCard,
  person: PersonPill,
  concept: ConceptNode,
  hunch: HunchSticky,
  quote: QuoteBlock,
  task: TaskRow,
  event: EventBadge,
  script: ScriptBlock,
  place: PlacePin,
};

export default function ObjectRenderer(props: ObjectCardProps) {
  const Component = RENDERERS[props.object.object_type_slug] ?? NoteCard;
  return <Component {...props} />;
}
