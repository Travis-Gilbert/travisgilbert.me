'use client';

import { useState, useEffect, useCallback } from 'react';
import { STUDIO_API_BASE } from '@/lib/studio';
import type { Editor } from '@tiptap/react';

interface CutoutItem {
  path: string;
  name: string;
}

interface CollagePanelProps {
  slug: string;
  editor?: Editor | null;
}

async function uploadCollageImage(file: File): Promise<boolean> {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch(`${STUDIO_API_BASE}/upload/collage/`, {
      method: 'POST',
      body: formData,
      credentials: 'omit',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function CollagePanel({ slug, editor }: CollagePanelProps) {
  const [cutouts, setCutouts] = useState<CutoutItem[]>([]);
  const [hero, setHero] = useState('');
  const [supports, setSupports] = useState<string[]>([]);
  const [strips, setStrips] = useState<string[]>([]);
  const [ground, setGround] = useState('olive');
  const [customHex, setCustomHex] = useState('#4A4528');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refreshCutouts = useCallback(() => {
    fetch(`${STUDIO_API_BASE}/collage/cutouts/`, { credentials: 'omit' })
      .then((r) => r.json())
      .then((data) => setCutouts(data.cutouts ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshCutouts();
  }, [refreshCutouts]);

  const handleFileDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/'),
      );
      if (files.length === 0) return;

      setUploading(true);
      setError(null);

      let anyFailed = false;
      for (const file of files) {
        const ok = await uploadCollageImage(file);
        if (!ok) anyFailed = true;
      }

      setUploading(false);
      if (anyFailed) {
        setError('Some uploads failed');
      }
      refreshCutouts();
    },
    [refreshCutouts],
  );

  const toggleSupport = useCallback((path: string) => {
    setSupports((prev) =>
      prev.includes(path)
        ? prev.filter((p) => p !== path)
        : prev.length < 5
          ? [...prev, path]
          : prev,
    );
  }, []);

  const toggleStrip = useCallback((path: string) => {
    setStrips((prev) =>
      prev.includes(path)
        ? prev.filter((p) => p !== path)
        : prev.length < 2
          ? [...prev, path]
          : prev,
    );
  }, []);

  const generate = useCallback(async () => {
    if (!hero) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${STUDIO_API_BASE}/collage/generate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          slug,
          hero,
          supports,
          strips,
          ground: ground === 'custom' ? customHex : ground,
          canvas_size: [1400, 875],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewUrl(data.url + '?t=' + Date.now());
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug, hero, supports, strips, ground, customHex]);

  return (
    <div style={{ padding: '12px 0' }}>
      <div
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '11px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--studio-tc)',
          marginBottom: '12px',
          fontWeight: 600,
        }}
      >
        Collage Builder
      </div>

      {/* Drop zone for uploading cutout images */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleFileDrop}
        style={{
          border: `1.5px dashed ${isDragOver ? 'var(--studio-tc)' : 'var(--studio-border)'}`,
          borderRadius: '6px',
          padding: '14px 12px',
          textAlign: 'center',
          marginBottom: '12px',
          background: isDragOver ? 'rgba(180, 90, 45, 0.06)' : 'transparent',
          transition: 'border-color 0.15s ease, background 0.15s ease',
          cursor: 'default',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: isDragOver ? 'var(--studio-tc)' : 'var(--studio-text-3)',
            fontFamily: 'var(--studio-font-mono)',
            letterSpacing: '0.04em',
          }}
        >
          {uploading ? 'Uploading...' : 'Drop cutout images here'}
        </span>
      </div>

      {previewUrl && (
        <>
          <div className="studio-collage-preview">
            <img src={previewUrl} alt={`Collage for ${slug}`} />
          </div>
          {editor && (
            <button
              type="button"
              className="studio-collage-insert-btn"
              onClick={() => {
                editor.chain().focus().setImage({ src: previewUrl }).run();
              }}
            >
              Insert in Document
            </button>
          )}
        </>
      )}

      <label style={{ display: 'block', marginBottom: '8px' }}>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--studio-text-2)',
            display: 'block',
            marginBottom: '4px',
          }}
        >
          Hero cutout
        </span>
        <select
          className="studio-collage-select"
          value={hero}
          onChange={(e) => setHero(e.target.value)}
        >
          <option value="">Select...</option>
          {cutouts.map((c) => (
            <option key={c.path} value={c.path}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div style={{ marginBottom: '8px' }}>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--studio-text-2)',
            display: 'block',
            marginBottom: '4px',
          }}
        >
          Supports (max 5)
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {cutouts.map((c) => (
            <button
              key={c.path}
              type="button"
              onClick={() => toggleSupport(c.path)}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid var(--studio-border)',
                background: supports.includes(c.path)
                  ? 'rgba(180, 90, 45, 0.12)'
                  : 'transparent',
                color: supports.includes(c.path)
                  ? 'var(--studio-tc)'
                  : 'var(--studio-text-2)',
                cursor: 'pointer',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--studio-text-2)',
            display: 'block',
            marginBottom: '4px',
          }}
        >
          Strips (max 2)
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {cutouts.map((c) => (
            <button
              key={c.path}
              type="button"
              onClick={() => toggleStrip(c.path)}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid var(--studio-border)',
                background: strips.includes(c.path)
                  ? 'rgba(58, 138, 154, 0.12)'
                  : 'transparent',
                color: strips.includes(c.path)
                  ? '#3A8A9A'
                  : 'var(--studio-text-2)',
                cursor: 'pointer',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--studio-text-2)',
            display: 'block',
            marginBottom: '4px',
          }}
        >
          Ground
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {['olive', 'dark'].map((g) => (
            <label
              key={g}
              style={{
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="ground"
                value={g}
                checked={ground === g}
                onChange={() => setGround(g)}
              />
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </label>
          ))}
          <label
            style={{
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="ground"
              value="custom"
              checked={ground === 'custom'}
              onChange={() => setGround('custom')}
            />
            Custom
          </label>
          {ground === 'custom' && (
            <input
              type="text"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              style={{
                width: '78px',
                fontSize: '12px',
                padding: '3px 5px',
                border: '1px solid var(--studio-border)',
                borderRadius: '4px',
                background: 'transparent',
                color: 'var(--studio-text-1)',
              }}
            />
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            fontSize: '12px',
            color: '#D4875A',
            marginBottom: '8px',
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={generate}
        disabled={!hero || loading}
        style={{
          width: '100%',
          padding: '6px 12px',
          fontSize: '13px',
          fontFamily: 'var(--studio-font-mono)',
          borderRadius: '6px',
          border: '1px solid var(--studio-border)',
          background: hero
            ? 'rgba(180, 90, 45, 0.1)'
            : 'transparent',
          color: hero
            ? 'var(--studio-tc)'
            : 'var(--studio-text-3)',
          cursor: hero ? 'pointer' : 'not-allowed',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading
          ? 'Generating...'
          : previewUrl
            ? 'Regenerate'
            : 'Generate'}
      </button>
    </div>
  );
}
