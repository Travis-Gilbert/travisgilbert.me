'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SavedModel } from '../../../lib/theseus-storage';

interface ModelCardProps {
  model: SavedModel;
  onDelete: (id: string) => void;
}

export function ModelCard({ model, onDelete }: ModelCardProps) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  const timestamp = new Date(model.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      onClick={() => router.push(`/theseus/ask?saved=${model.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--vie-card)',
        border: `1px solid ${hovered ? 'var(--vie-border-active)' : 'var(--vie-border)'}`,
        borderRadius: '8px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(model.id);
        }}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '24px',
          height: '24px',
          background: 'rgba(0, 0, 0, 0.6)',
          border: '1px solid var(--vie-border)',
          borderRadius: '4px',
          color: 'var(--vie-text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          lineHeight: 1,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s ease',
          zIndex: 2,
        }}
        aria-label="Delete model"
      >
        ×
      </button>

      {/* Thumbnail */}
      <div
        style={{
          aspectRatio: '16 / 9',
          borderRadius: '8px 8px 0 0',
          overflow: 'hidden',
          background: 'var(--vie-bg-subtle)',
        }}
      >
        <img
          src={model.thumbnail_data_url}
          alt={model.query}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>

      {/* Content */}
      <div style={{ padding: '12px' }}>
        {/* Query text */}
        <p
          style={{
            fontFamily: 'var(--vie-font-body)',
            fontSize: '13px',
            color: 'var(--vie-text)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            margin: 0,
            marginBottom: '8px',
          }}
        >
          {model.query}
        </p>

        {/* Confidence bar + timestamp */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--vie-font-mono)',
            fontSize: '11px',
            color: 'var(--vie-text-dim)',
          }}
        >
          <div
            style={{
              flex: '0 0 40px',
              height: '3px',
              background: 'var(--vie-border)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.round(model.confidence * 100)}%`,
                height: '100%',
                background: 'var(--vie-teal-light)',
                borderRadius: '2px',
              }}
            />
          </div>
          <span>{Math.round(model.confidence * 100)}%</span>
          <span style={{ marginLeft: 'auto' }}>{timestamp}</span>
        </div>
      </div>
    </div>
  );
}
