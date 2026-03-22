'use client';

import { getObjectTypeIdentity } from '@/lib/commonplace';
import type { CSSProperties, MouseEvent } from 'react';
import type { RenderableObject } from '../objects/ObjectRenderer';

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function discoverySourceLabel(object: RenderableObject): string | null {
  return readString(object.source_label) ?? readString(object.og_site_name);
}

function discoverySourceFormat(object: RenderableObject): string | null {
  return readString(object.source_format);
}

function discoverySignalLabel(object: RenderableObject): string {
  const rawSignal = readString(object.signal);
  switch (rawSignal) {
    case 'shared_entity':
      return 'Entity match';
    case 'tfidf':
      return 'Topic cluster';
    case 'sbert':
      return 'Semantic match';
    case 'ner':
      return 'Direct mention';
    case 'nli':
      return 'Tension with';
    case 'kge':
      return 'Hub node';
    default:
      return readString(object.signal_label) ?? 'Signal';
  }
}

function discoveryModuleKind(
  object: RenderableObject,
): 'feature' | 'pill' | 'insight' {
  if (object.object_type_slug === 'source') return 'feature';
  if (object.object_type_slug === 'hunch' || object.object_type_slug === 'quote') return 'insight';
  return 'pill';
}

function discoverySortRank(object: RenderableObject): number {
  const kind = discoveryModuleKind(object);
  if (kind === 'feature') return 0;
  if (kind === 'pill') return 1;
  return 2;
}

function DiscoveryModule({
  object,
  onClick,
  onContextMenu,
}: {
  object: RenderableObject;
  onClick?: (obj: RenderableObject) => void;
  onContextMenu?: (e: MouseEvent, obj: RenderableObject) => void;
}) {
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const title = object.display_title ?? object.title;
  const summary = readString(object.body);
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const signalLabel = discoverySignalLabel(object);
  const explanation = readString(object.explanation);
  const sourceLabel = discoverySourceLabel(object);
  const sourceFormat = discoverySourceFormat(object);
  const kind = discoveryModuleKind(object);
  const typeLine = `${identity.color}36`;
  const typeSoft = `${identity.color}12`;

  if (kind === 'feature') {
    return (
      <div className="cp-discovery-item">
        <button
          type="button"
          className="cp-discovery-module cp-discovery-feature"
          onClick={onClick ? () => onClick(object) : undefined}
          onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
          style={
            {
              '--cp-discovery-color': identity.color,
              '--cp-discovery-soft': typeSoft,
              '--cp-discovery-line': typeLine,
            } as CSSProperties
          }
        >
          <div className="cp-discovery-feature-top">
            <div className="cp-discovery-badge-row">
              {sourceLabel && <span className="cp-discovery-badge">{sourceLabel}</span>}
              {sourceFormat && (
                <span className="cp-discovery-badge cp-discovery-badge--ghost">
                  {sourceFormat}
                </span>
              )}
            </div>
            {score && <span className="cp-discovery-score">{score}</span>}
          </div>
          <div className="cp-discovery-feature-title">{title}</div>
        </button>
        {explanation && (
          <div className="cp-discovery-note">
            <span className="cp-discovery-note-label">{signalLabel}:</span> {explanation}
          </div>
        )}
      </div>
    );
  }

  if (kind === 'insight') {
    return (
      <div className="cp-discovery-item">
        <button
          type="button"
          className="cp-discovery-module cp-discovery-insight"
          onClick={onClick ? () => onClick(object) : undefined}
          onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
          style={
            {
              '--cp-discovery-color': identity.color,
              '--cp-discovery-soft': typeSoft,
              '--cp-discovery-line': typeLine,
            } as CSSProperties
          }
        >
          <div className="cp-discovery-insight-top">
            <span className="cp-discovery-badge">{identity.label}</span>
            {score && <span className="cp-discovery-score">{score}</span>}
          </div>
          <div className="cp-discovery-insight-title">{title}</div>
          {summary && <div className="cp-discovery-insight-body">{summary}</div>}
        </button>
        {explanation && (
          <div className="cp-discovery-note">
            <span className="cp-discovery-note-label">{signalLabel}:</span> {explanation}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cp-discovery-item">
      <button
        type="button"
        className="cp-discovery-module cp-discovery-pill"
        onClick={onClick ? () => onClick(object) : undefined}
        onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
        style={
          {
            '--cp-discovery-color': identity.color,
            '--cp-discovery-soft': typeSoft,
            '--cp-discovery-line': typeLine,
          } as CSSProperties
        }
      >
        <span className="cp-discovery-pill-dot" aria-hidden="true" />
        <span className="cp-discovery-pill-title">{title}</span>
        {score && <span className="cp-discovery-pill-value">{score}</span>}
      </button>
      {explanation && (
        <div className="cp-discovery-note">
          <span className="cp-discovery-note-label">{signalLabel}:</span> {explanation}
        </div>
      )}
    </div>
  );
}

export default function ComposeDiscoveryDock({
  objects,
  onClick,
  onContextMenu,
}: {
  objects: RenderableObject[];
  onClick?: (obj: RenderableObject) => void;
  onContextMenu?: (e: MouseEvent, obj: RenderableObject) => void;
}) {
  const orderedObjects = [...objects].sort((a, b) => discoverySortRank(a) - discoverySortRank(b));

  return (
    <div className="cp-discovery-stack">
      {orderedObjects.map((object) => (
        <DiscoveryModule
          key={`${object.slug}-${object.id}`}
          object={object}
          onClick={onClick}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
