'use client';

import { useState, useCallback } from 'react';
import { saveModel } from '../../../lib/theseus-storage';
import type { SceneSpec } from '../../../lib/theseus-viz/SceneSpec';

interface SaveModelButtonProps {
  query: string;
  sceneSpec: SceneSpec;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function SaveModelButton({ query, sceneSpec, canvasRef }: SaveModelButtonProps) {
  const [saving, setSaving] = useState(false);
  const [pulsing, setPulsing] = useState(false);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);

    let thumbnailDataUrl = '';
    if (canvasRef.current) {
      thumbnailDataUrl = canvasRef.current.toDataURL('image/png');
    }

    await saveModel({
      id: crypto.randomUUID(),
      query,
      created_at: new Date().toISOString(),
      scene_spec: sceneSpec,
      thumbnail_data_url: thumbnailDataUrl,
      confidence: sceneSpec.confidence,
      node_count: sceneSpec.nodes.length,
      tags: [],
    });

    setPulsing(true);
    setTimeout(() => setPulsing(false), 1000);
    setSaving(false);
  }, [query, sceneSpec, canvasRef, saving]);

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      aria-label="Save model to library"
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        zIndex: 10,
        width: '40px',
        height: '40px',
        background: 'var(--vie-card)',
        border: '1px solid var(--vie-border)',
        borderRadius: '8px',
        cursor: saving ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.15s ease',
        animation: pulsing ? 'vie-save-pulse 1s ease-out' : 'none',
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={pulsing ? 'var(--vie-teal-light)' : 'var(--vie-text-muted)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'stroke 0.15s ease' }}
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
