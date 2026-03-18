'use client';

import { getObjectTypeIdentity } from '@/lib/commonplace';
import type { ObjectListItem, PinnedBadgeObject, TagSummary } from '@/lib/commonplace';
import PinnedBadge from './PinnedBadge';
import StatusBadge from './StatusBadge';
import SignalPips from './SignalPips';
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
import { useState, useCallback, useRef, useEffect, type ComponentType } from 'react';
import { createPin } from '@/lib/commonplace-api';
import { useCommonPlace } from '@/lib/commonplace-context';
import RoughBorder from '../RoughBorder';

export interface RenderableObject extends Partial<ObjectListItem> {
  id: number;
  slug: string;
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
  score?: number;
  signal?: string;
  signal_label?: string;
  explanation?: string;
  supporting_signal_labels?: string[];
  pinned_objects?: PinnedBadgeObject[];
  tag_summary?: TagSummary | null;
  [key: string]: unknown;
}

export interface ObjectCardProps {
  object: RenderableObject;
  compact?: boolean;
  variant?: 'default' | 'timeline' | 'dock' | 'chain' | 'chip' | 'module';
  onClick?: (obj: RenderableObject) => void;
  onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
  /** Called after a successful pin drop (parent slug, child slug). */
  onPinCreated?: (parentSlug: string, childSlug: string) => void;
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

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function ModuleVariantObject({ object, compact, onClick, onContextMenu }: ObjectCardProps) {
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const title = object.display_title ?? object.title;
  const summary =
    readString(object.body) ??
    readString(object.og_description) ??
    readString(object.explanation);
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const domain = readString(object.source_label) ??
    readString(object.og_site_name) ??
    (object.url ? extractDomain(object.url) : null);
  const sourceFormat = readString(object.source_format);
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const edgeCount = object.edge_count ?? 0;
  const isDone =
    object.status === 'done' || object.status === 'complete' || object.status === 'completed';
  const tone = `${identity.color}10`;
  const line = `${identity.color}28`;
  const baseButtonProps = {
    type: 'button' as const,
    className: 'cp-object-module',
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  if (object.object_type_slug === 'concept' || object.object_type_slug === 'person') {
    const personInitial = title.charAt(0).toUpperCase();
    return (
      <button
        {...baseButtonProps}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: compact ? 8 : 11,
          width: '100%',
          textAlign: 'left',
          padding: compact ? '5px 10px 5px 8px' : '9px 15px',
          borderRadius: 999,
          border: `1.5px solid ${line}`,
          background: 'transparent',
          color: 'var(--cp-text)',
        }}
      >
        {object.object_type_slug === 'person' ? (
          <span
            style={{
              width: compact ? 22 : 32,
              height: compact ? 22 : 32,
              borderRadius: '50%',
              background: compact ? `${identity.color}16` : `linear-gradient(135deg, ${identity.color}15, ${identity.color}25)`,
              border: `1.5px solid ${identity.color}40`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--cp-font-title)',
                fontSize: compact ? 11 : 14,
                fontWeight: 700,
                color: identity.color,
                fontFeatureSettings: 'var(--cp-kern-title)',
              }}
            >
              {personInitial}
            </span>
          </span>
        ) : (
          <span
            style={{
              width: compact ? 8 : 9,
              height: compact ? 8 : 9,
              borderRadius: '50%',
              background: identity.color,
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            fontFamily:
              object.object_type_slug === 'concept' ? 'var(--cp-font-mono)' : 'var(--cp-font-body)',
            fontSize: compact ? 12 : (object.object_type_slug === 'concept' ? 13 : 14),
            fontWeight: object.object_type_slug === 'concept' ? 500 : 600,
            lineHeight: 1.3,
            color: 'var(--cp-text)',
            fontFeatureSettings:
              object.object_type_slug === 'concept'
                ? 'var(--cp-kern-mono)'
                : 'var(--cp-kern-body)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        {(score || edgeCount > 0) && (
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--cp-font-mono)',
              fontWeight: 600,
              fontSize: 9,
              color: identity.color,
              fontFeatureSettings: 'var(--cp-kern-mono)',
              flexShrink: 0,
            }}
          >
            {score ?? edgeCount}
          </span>
        )}
      </button>
    );
  }

  if (object.object_type_slug === 'hunch' || object.object_type_slug === 'quote') {
    return (
      <button
        {...baseButtonProps}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding:
            object.object_type_slug === 'quote'
              ? compact
                ? '6px 0 6px 12px'
                : '8px 0 8px 14px'
              : compact
                ? '8px 10px'
                : '10px 14px',
          border:
            object.object_type_slug === 'quote'
              ? 'none'
              : `1.5px dashed ${line}`,
          transform:
            object.object_type_slug === 'hunch' ? 'rotate(-0.3deg)' : undefined,
          borderLeft:
            object.object_type_slug === 'quote' ? `3px solid ${identity.color}` : undefined,
          borderRadius: object.object_type_slug === 'quote' ? 0 : 4,
          background:
            object.object_type_slug === 'quote' ? 'transparent' : `${identity.color}08`,
          color: 'var(--cp-text)',
        }}
      >
        <div
          style={{
            fontFamily: object.object_type_slug === 'quote' ? 'var(--cp-font-title)' : 'var(--cp-font-body)',
            fontSize: compact ? 12.5 : (object.object_type_slug === 'quote' ? 15 : 13.5),
            fontWeight: object.object_type_slug === 'quote' ? 400 : 500,
            fontStyle: 'italic',
            lineHeight: 1.48,
            color: 'var(--cp-text)',
            fontFeatureSettings: object.object_type_slug === 'quote' ? 'var(--cp-kern-title)' : 'var(--cp-kern-body)',
            marginBottom: summary && !compact && object.object_type_slug === 'hunch' ? 4 : 0,
          }}
        >
          {object.object_type_slug === 'quote' ? `\u201C${title}\u201D` : title}
        </div>
        {!compact && summary && object.object_type_slug === 'hunch' && (
          <div
            style={{
              fontFamily: 'var(--cp-font-body)',
              fontSize: 12,
              fontStyle: 'italic',
              lineHeight: 1.55,
              color: 'var(--cp-text-muted)',
              fontFeatureSettings: 'var(--cp-kern-body)',
              marginBottom: 5,
            }}
          >
            {summary}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: compact ? 3 : 5,
          }}
        >
          {timestamp && (
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontWeight: 500,
                fontSize: 9,
                color: identity.color,
                fontFeatureSettings: 'var(--cp-kern-mono)',
              }}
            >
              {timestamp}
            </span>
          )}
          {edgeCount > 0 && (
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontWeight: 500,
                fontSize: 9,
                color: identity.color,
                fontFeatureSettings: 'var(--cp-kern-mono)',
              }}
            >
              {edgeCount} links
            </span>
          )}
        </div>
      </button>
    );
  }

  if (object.object_type_slug === 'task') {
    return (
      <button
        {...baseButtonProps}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          width: '100%',
          textAlign: 'left',
          padding: compact ? '7px 0' : '8px 0',
          borderBottom: '1px solid var(--cp-border-faint)',
          background: 'transparent',
          color: 'var(--cp-text)',
          opacity: isDone ? 0.62 : 1,
        }}
      >
        <span
          style={{
            width: 15,
            height: 15,
            borderRadius: 3,
            border: `1.5px solid ${isDone ? identity.color : 'var(--cp-border)'}`,
            background: isDone ? `${identity.color}` : 'transparent',
            flexShrink: 0,
            marginTop: 1,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 13,
            color: 'var(--cp-text)',
            lineHeight: 1.4,
            textDecoration: isDone ? 'line-through' : 'none',
            fontFeatureSettings: 'var(--cp-kern-body)',
            flex: 1,
          }}
        >
          {title}
        </span>
        {timestamp && (
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontWeight: 500,
              fontSize: 9,
              color: 'var(--cp-text-faint)',
              fontFeatureSettings: 'var(--cp-kern-mono)',
            }}
          >
            {timestamp}
          </span>
        )}
      </button>
    );
  }

  if (object.object_type_slug === 'event') {
    const eventDate = object.captured_at ? new Date(object.captured_at) : null;
    const eventMonth = eventDate
      ? eventDate.toLocaleString('en', { month: 'short' }).toUpperCase()
      : null;
    const eventDay = eventDate ? eventDate.getDate() : null;

    return (
      <button
        {...baseButtonProps}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: compact ? 8 : 12,
          width: '100%',
          textAlign: 'left',
          padding: compact ? '8px 10px' : '8px 12px',
          borderLeft: `3px solid ${identity.color}`,
          borderRadius: '0 5px 5px 0',
          background: `${identity.color}08`,
          color: 'var(--cp-text)',
        }}
      >
        {/* Split date column */}
        {!compact && eventDate && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flexShrink: 0,
              minWidth: 32,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 10,
                fontWeight: 600,
                color: identity.color,
                letterSpacing: '0.06em',
                fontFeatureSettings: 'var(--cp-kern-mono)',
              }}
            >
              {eventMonth}
            </span>
            <span
              style={{
                fontFamily: 'var(--cp-font-body)',
                fontSize: 17,
                fontWeight: 700,
                lineHeight: 1.1,
                color: 'var(--cp-text)',
                fontFeatureSettings: 'var(--cp-kern-body)',
              }}
            >
              {eventDay}
            </span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--cp-font-body)',
              fontSize: compact ? 12.5 : 13,
              fontWeight: 600,
              lineHeight: 1.35,
              color: 'var(--cp-text)',
              fontFeatureSettings: 'var(--cp-kern-body)',
              marginBottom: !compact && summary ? 3 : 0,
            }}
          >
            {title}
          </div>
          {!compact && summary && (
            <div
              style={{
                fontFamily: 'var(--cp-font-body)',
                fontSize: 12,
                color: 'var(--cp-text-muted)',
                lineHeight: 1.5,
                fontFeatureSettings: 'var(--cp-kern-body)',
              }}
            >
              {summary}
            </div>
          )}
        </div>
        {compact && timestamp && (
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontWeight: 500,
              fontSize: 9,
              color: identity.color,
              fontFeatureSettings: 'var(--cp-kern-mono)',
              flexShrink: 0,
            }}
          >
            {timestamp}
          </span>
        )}
      </button>
    );
  }

  if (object.object_type_slug === 'script') {
    return (
      <button
        {...baseButtonProps}
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: compact ? '8px 10px' : '10px 14px',
          border: '1px solid #2A2C32',
          borderRadius: 4,
          background: '#1A1C22',
          color: '#C0C8D8',
          overflow: 'hidden',
        }}
      >
        {/* Radial gradient glow overlay */}
        {!compact && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at 0% 100%, rgba(45,95,107,0.07) 0%, transparent 50%)',
              pointerEvents: 'none',
            }}
          />
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 6,
          }}
        >
          {/* Green dot with glow */}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#6AAA6A',
              boxShadow: '0 0 4px rgba(106,170,106,0.5)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontWeight: 500,
              fontSize: 10,
              color: '#808898',
              fontFeatureSettings: 'var(--cp-kern-mono)',
            }}
          >
            {title}
          </span>
        </div>
        <pre
          style={{
            margin: 0,
            fontFamily: 'var(--cp-font-mono)',
            fontWeight: 400,
            fontSize: 11,
            lineHeight: 1.65,
            color: '#C0C8D8',
            fontFeatureSettings: 'var(--cp-kern-mono)',
            whiteSpace: compact ? 'nowrap' : 'pre-wrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxHeight: compact ? 'none' : 90,
          }}
        >
          {summary ?? object.body}
        </pre>
        {!compact && edgeCount > 0 && (
          <div
            style={{
              marginTop: 8,
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              fontWeight: 500,
              color: '#606878',
              fontFeatureSettings: 'var(--cp-kern-mono)',
            }}
          >
            {edgeCount} connections
          </div>
        )}
      </button>
    );
  }

  if (object.object_type_slug === 'place') {
    return (
      <button
        {...baseButtonProps}
        style={{
          display: 'flex',
          alignItems: compact ? 'center' : 'flex-start',
          gap: 9,
          width: '100%',
          textAlign: 'left',
          padding: compact ? '7px 10px' : '9px 12px',
          border: `1px solid ${line}`,
          borderRadius: 6,
          background: 'transparent',
          color: 'var(--cp-text)',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50% 50% 50% 0',
            transform: 'rotate(-45deg)',
            background: identity.color,
            marginTop: compact ? 2 : 3,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--cp-font-body)',
              fontSize: compact ? 13 : 14,
              fontWeight: 500,
              lineHeight: 1.3,
              color: 'var(--cp-text)',
              fontFeatureSettings: 'var(--cp-kern-body)',
              marginBottom: !compact && summary ? 3 : 0,
            }}
          >
            {title}
          </div>
          {!compact && summary && (
            <div
              style={{
                fontFamily: 'var(--cp-font-body)',
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--cp-text-muted)',
                fontFeatureSettings: 'var(--cp-kern-body)',
              }}
            >
              {summary}
            </div>
          )}
        </div>
        {edgeCount > 0 && (
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontWeight: 500,
              fontSize: 9,
              color: 'var(--cp-text-faint)',
              fontFeatureSettings: 'var(--cp-kern-mono)',
              flexShrink: 0,
            }}
          >
            {edgeCount} links
          </span>
        )}
      </button>
    );
  }

  if (object.object_type_slug === 'source') {
    return (
      <button
        {...baseButtonProps}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          position: 'relative',
          padding: compact ? '8px 10px' : '9px 12px 10px',
          border: `1px solid ${line}`,
          borderRadius: 6,
          background: 'transparent',
          overflow: 'hidden',
          color: 'var(--cp-text)',
        }}
      >
        {/* OG gradient header band */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: compact ? 3 : 46,
            background: `linear-gradient(135deg, ${identity.color}08, ${identity.color}18)`,
            borderRadius: '6px 6px 0 0',
          }}
        />
        {/* Site name + metadata row (sits inside gradient band on non-compact) */}
        {(domain || sourceFormat || score) && (
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
              paddingTop: compact ? 0 : 24,
              flexWrap: 'wrap',
            }}
          >
            {domain && (
              <span
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: identity.color,
                  fontFeatureSettings: 'var(--cp-kern-mono)',
                }}
              >
                {domain}
              </span>
            )}
            {sourceFormat && (
              <span
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 8.5,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--cp-text-faint)',
                  fontFeatureSettings: 'var(--cp-kern-mono)',
                }}
              >
                {sourceFormat}
              </span>
            )}
            {score && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontFamily: 'var(--cp-font-mono)',
                  fontWeight: 500,
                  fontSize: 9,
                  color: identity.color,
                  fontFeatureSettings: 'var(--cp-kern-mono)',
                }}
              >
                {score}
              </span>
            )}
          </div>
        )}
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: compact ? 13.5 : 14.5,
            fontWeight: 600,
            lineHeight: 1.34,
            color: 'var(--cp-text)',
            fontFeatureSettings: 'var(--cp-kern-body)',
            marginBottom: summary ? 4 : 0,
          }}
        >
          {readString(object.og_title) ?? title}
        </div>
        {summary && (
          <div
            style={{
              fontFamily: 'var(--cp-font-body)',
              fontSize: 12,
              lineHeight: 1.55,
              color: 'var(--cp-text-muted)',
              fontFeatureSettings: 'var(--cp-kern-body)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {summary}
          </div>
        )}
        {(timestamp || edgeCount > 0) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 6,
            }}
          >
            {timestamp && (
              <span
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontWeight: 500,
                  fontSize: 9,
                  color: 'var(--cp-text-faint)',
                  fontFeatureSettings: 'var(--cp-kern-mono)',
                }}
              >
                {timestamp}
              </span>
            )}
            {edgeCount > 0 && (
              <span
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontWeight: 500,
                  fontSize: 9,
                  color: 'var(--cp-text-faint)',
                  fontFeatureSettings: 'var(--cp-kern-mono)',
                  marginLeft: 'auto',
                }}
              >
                {edgeCount} links
              </span>
            )}
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      {...baseButtonProps}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: compact ? '8px 10px' : '12px 16px',
        border: '1px solid var(--cp-border-faint)',
        borderRadius: 5,
        background: 'transparent',
        color: 'var(--cp-text)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--cp-font-body)',
          fontSize: compact ? 13.5 : 14.5,
          fontWeight: 500,
          lineHeight: 1.38,
          color: 'var(--cp-text)',
          fontFeatureSettings: 'var(--cp-kern-body)',
          marginBottom: summary && !compact ? 4 : 0,
        }}
      >
        {title}
      </div>
      {!compact && summary && (
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12.5,
            lineHeight: 1.58,
            color: 'var(--cp-text-muted)',
            fontFeatureSettings: 'var(--cp-kern-body)',
            marginBottom: 6,
          }}
        >
          {summary}
        </div>
      )}
      {(timestamp || edgeCount > 0) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: compact ? 3 : 4,
          }}
        >
          {timestamp && (
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontWeight: 500,
                fontSize: 9,
                color: 'var(--cp-text-faint)',
                fontFeatureSettings: 'var(--cp-kern-mono)',
              }}
            >
              {timestamp}
            </span>
          )}
          {edgeCount > 0 && (
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontWeight: 500,
                fontSize: 9,
                color: 'var(--cp-text-faint)',
                fontFeatureSettings: 'var(--cp-kern-mono)',
                marginLeft: 'auto',
              }}
            >
              {edgeCount} links
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function CompactVariantCard({ object, variant, onClick, onContextMenu }: ObjectCardProps) {
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const title = object.display_title ?? object.title;
  const summary = readString(object.body) ?? readString(object.explanation);
  const signalLabel = readString(object.signal_label);
  const supportingSignals = readStringArray(object.supporting_signal_labels);
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const typeTint = `${identity.color}10`;
  const typeLine = `${identity.color}26`;

  if (variant === 'chip') {
    return (
      <button
        type="button"
        onClick={onClick ? () => onClick(object) : undefined}
        onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          maxWidth: '100%',
          border: `1px solid ${typeLine}`,
          borderRadius: 999,
          background: 'transparent',
          padding: '5px 10px',
          cursor: 'pointer',
          fontFeatureSettings: 'var(--cp-kern-body)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: identity.color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 11.5,
            fontWeight: 500,
            color: 'var(--cp-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        {(object.edge_count ?? 0) > 0 && (
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              color: identity.color,
              fontFeatureSettings: 'var(--cp-kern-mono)',
              flexShrink: 0,
            }}
          >
            {object.edge_count}
          </span>
        )}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button
        type="button"
        onClick={onClick ? () => onClick(object) : undefined}
        onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 5,
          minWidth: 120,
          maxWidth: 168,
          padding: '10px 12px',
          borderRadius: 8,
          border: `1px solid ${identity.color}40`,
          background: `${identity.color}12`,
          boxShadow: `0 0 8px ${identity.color}15`,
          cursor: 'pointer',
          textAlign: 'center',
          transition: 'box-shadow 150ms, border-color 150ms',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: identity.color,
            boxShadow: `0 0 0 3px ${typeTint}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 11.5,
            fontWeight: 500,
            color: 'var(--cp-text)',
            lineHeight: 1.32,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </span>
        {timestamp && (
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 8,
              color: 'var(--cp-text-faint)',
              fontFeatureSettings: 'var(--cp-kern-mono)',
            }}
          >
            {timestamp}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick ? () => onClick(object) : undefined}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        border: `1px solid ${typeLine}`,
        borderRadius: 6,
        background: 'transparent',
        padding: '12px 13px',
        cursor: 'pointer',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: identity.color,
            background: typeTint,
            border: `1px solid ${typeLine}`,
            borderRadius: 999,
            padding: '3px 8px',
            fontFeatureSettings: 'var(--cp-kern-mono)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: identity.color,
              flexShrink: 0,
            }}
          />
          {identity.label}
        </span>
        {score && (
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              color: 'var(--cp-text-faint)',
              fontFeatureSettings: 'var(--cp-kern-mono)',
              flexShrink: 0,
            }}
          >
            {score}
          </span>
        )}
      </div>

      <div
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--cp-text)',
          lineHeight: 1.24,
          fontFeatureSettings: 'var(--cp-kern-title)',
          marginBottom: 7,
        }}
      >
        {title}
      </div>

      {signalLabel && (
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--cp-text-faint)',
            marginBottom: 6,
            fontFeatureSettings: 'var(--cp-kern-mono)',
          }}
        >
          {signalLabel}
        </div>
      )}

      {summary && (
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 13,
            color: 'var(--cp-text-muted)',
            lineHeight: 1.6,
            fontFeatureSettings: 'var(--cp-kern-body)',
          }}
        >
          {summary}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 8,
          flexWrap: 'wrap',
        }}
      >
        {supportingSignals.slice(0, 2).map((signal) => (
          <span
            key={`${object.slug}-${signal}`}
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--cp-blue)',
              background: 'rgba(74, 122, 154, 0.08)',
              border: '1px solid rgba(74, 122, 154, 0.18)',
              borderRadius: 999,
              padding: '3px 7px',
              fontFeatureSettings: 'var(--cp-kern-mono)',
            }}
          >
            {signal}
          </span>
        ))}
        {(object.edge_count ?? 0) > 0 && (
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              color: 'var(--cp-text-faint)',
              fontFeatureSettings: 'var(--cp-kern-mono)',
            }}
          >
            {object.edge_count} links
          </span>
        )}
      </div>
    </button>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** MIME type for inter-card drag data. */
const DND_MIME = 'application/commonplace-object';

export default function ObjectRenderer(props: ObjectCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const { draggedComponent } = useCommonPlace();
  const [pointerInside, setPointerInside] = useState(false);
  const isDropTarget = draggedComponent !== null;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [justAttached, setJustAttached] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const color = (e as CustomEvent).detail?.color;
      if (color) {
        setJustAttached(color);
        setTimeout(() => setJustAttached(null), 300);
      }
    };
    el.addEventListener('cp-component-attached', handler);
    return () => el.removeEventListener('cp-component-attached', handler);
  }, []);

  // Compact variants (dock/chain/chip) are too small for DnD interaction
  if (
    props.variant === 'dock' ||
    props.variant === 'chain' ||
    props.variant === 'chip'
  ) {
    return <CompactVariantCard {...props} />;
  }

  let card: React.ReactNode;

  if (
    props.variant === 'module' ||
    props.variant === 'timeline' ||
    props.variant === 'default' ||
    props.variant == null
  ) {
    card = <ModuleVariantObject {...props} />;
  } else {
    const Component = RENDERERS[props.object.object_type_slug] ?? NoteCard;
    card = <Component {...props} />;
  }

  const pins = Array.isArray(props.object.pinned_objects)
    ? props.object.pinned_objects
    : [];

  /* ── Drag handlers ── */

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData(
        DND_MIME,
        JSON.stringify({
          id: props.object.id,
          slug: props.object.slug,
          title: props.object.title,
          object_type: props.object.object_type_slug,
        }),
      );
      e.dataTransfer.effectAllowed = 'link';

      // Custom ghost preview
      const ghost = document.createElement('div');
      ghost.style.cssText = [
        'padding:4px 10px',
        'background:var(--cp-card,rgba(255,255,255,0.85))',
        'border:1px solid var(--cp-border,rgba(42,36,32,0.12))',
        'border-radius:4px',
        'font-family:var(--cp-font-body)',
        'font-size:12px',
        'color:var(--cp-text,#2A2420)',
        'box-shadow:0 4px 12px rgba(0,0,0,0.15)',
        'max-width:200px',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
        'position:absolute',
        'top:-9999px',
      ].join(';');
      ghost.textContent = props.object.title;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 10, 10);
      requestAnimationFrame(() => document.body.removeChild(ghost));
    },
    [props.object.id, props.object.slug, props.object.title, props.object.object_type_slug],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DND_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'link';
      setDragOver(true);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const raw = e.dataTransfer.getData(DND_MIME);
      if (!raw) return;
      try {
        const data = JSON.parse(raw) as { slug: string };
        if (data.slug === props.object.slug) return;
        props.onPinCreated?.(props.object.slug, data.slug);
        await createPin(props.object.slug, { target_slug: data.slug });
      } catch {
        // API error: parent view should refetch to reconcile
      }
    },
    [props.object.slug, props.onPinCreated],
  );

  const wrapperClass = [
    'cp-lego-card-wrapper',
    dragOver ? 'cp-drop-target' : '',
    isDropTarget ? 'cp-object-card--receptive' : '',
    isDropTarget && pointerInside ? 'cp-object-card--hover-drop' : '',
    justAttached ? 'cp-object-card--absorbing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={wrapperRef}
      className={wrapperClass}
      style={justAttached ? { '--absorb-color': justAttached } as React.CSSProperties : undefined}
      data-object-id={props.object.id}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPointerEnter={() => isDropTarget && setPointerInside(true)}
      onPointerLeave={() => setPointerInside(false)}
    >
      <RoughBorder
        seed={props.object.slug}
        glow
        glowColor={getObjectTypeIdentity(props.object.object_type_slug).color}
      >
        {card}
      </RoughBorder>
      {/* Drop label */}
      {isDropTarget && pointerInside && (
        <div className="cp-drop-label">Drop to attach component</div>
      )}
      {/* Epistemic tag footer: badge + signal pips */}
      {props.object.tag_summary?.badge && (
        <div className="cp-tag-footer">
          <StatusBadge
            status={props.object.tag_summary.badge}
            confirmed={props.object.tag_summary.badge_confirmed}
          />
          {props.object.tag_summary.pips.length > 0 && (
            <SignalPips pips={props.object.tag_summary.pips} />
          )}
        </div>
      )}
      {pins.length > 0 && (
        <div className="cp-pinned-badges">
          {pins.map((pin) => (
            <PinnedBadge
              key={pin.edge_id}
              object={pin}
              edgeId={pin.edge_id}
              compact
              onClick={props.onClick ? () => props.onClick?.(props.object) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
