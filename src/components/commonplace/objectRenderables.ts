'use client';

import type {
  ApiResurfaceCard,
  ClusterMember,
  GraphNode,
  MockNode,
  ObjectListItem,
} from '@/lib/commonplace';
import type { ComposeLiveResult } from '@/lib/commonplace-api';
import type { RenderableObject } from './objects/ObjectRenderer';

function normalizeId(value: string | number): number {
  if (typeof value === 'number') return value;
  const segments = value.split(':');
  return parseInt(segments[segments.length - 1] || value, 10) || 0;
}

export function renderableFromMockNode(node: MockNode): RenderableObject {
  return {
    id: node.objectRef || normalizeId(node.id),
    slug: node.objectSlug || String(node.objectRef || normalizeId(node.id)),
    title: node.title,
    display_title: node.title,
    object_type_slug: node.objectType,
    body: node.summary || undefined,
    captured_at: node.capturedAt || undefined,
    edge_count: node.edgeCount,
  };
}

export function renderableFromGraphNode(node: GraphNode): RenderableObject {
  return {
    id: node.objectRef || normalizeId(node.id),
    slug: node.objectSlug || String(node.objectRef || normalizeId(node.id)),
    title: node.title,
    display_title: node.title,
    object_type_slug: node.objectType,
    body: node.bodyPreview || undefined,
    edge_count: node.edgeCount,
    status: node.status,
  };
}

export function renderableFromObjectListItem(item: ObjectListItem): RenderableObject {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    display_title: item.display_title || item.title,
    object_type_slug: item.object_type_slug,
    captured_at: item.captured_at,
    edge_count: item.edge_count,
    status: item.status,
    url: item.url,
  };
}

export function renderableFromClusterMember(
  member: ClusterMember,
  objectTypeSlug: string,
): RenderableObject {
  return {
    id: member.id,
    slug: member.slug,
    title: member.title,
    display_title: member.title,
    object_type_slug: objectTypeSlug,
    body: member.body_preview || undefined,
    edge_count: member.edge_count,
  };
}

export function renderableFromResurfaceCard(card: ApiResurfaceCard): RenderableObject {
  return {
    id: card.object.id,
    slug: card.object.slug,
    title: card.object.title,
    display_title: card.object.display_title || card.object.title,
    object_type_slug: card.object.object_type_data?.slug ?? '',
    body: card.object.body || undefined,
    captured_at: card.object.captured_at || undefined,
    edge_count: card.object.edges.length,
    url: card.object.url || undefined,
    og_title: card.object.og_title || undefined,
    og_description: card.object.og_description || undefined,
    status: card.object.status || undefined,
  };
}

export function renderableFromComposeResult(
  result: ComposeLiveResult,
  meta?: {
    signalLabel?: string;
    supportingSignalLabels?: string[];
    sourceLabel?: string;
    sourceFormat?: string;
    explanation?: string;
  },
): RenderableObject {
  return {
    id: result.objectId,
    slug: result.slug,
    title: result.title,
    display_title: result.title,
    object_type_slug: result.type,
    body: result.bodyPreview || undefined,
    score: result.score,
    signal: result.signal,
    explanation: meta?.explanation ?? result.explanation,
    signal_label: meta?.signalLabel,
    supporting_signal_labels: meta?.supportingSignalLabels ?? [],
    source_label: meta?.sourceLabel,
    source_format: meta?.sourceFormat,
  };
}
