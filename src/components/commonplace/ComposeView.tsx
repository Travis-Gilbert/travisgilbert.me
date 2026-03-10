'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import type { Editor } from '@tiptap/react';
import type { TiptapUpdatePayload } from '@/components/studio/TiptapEditor';
import { OBJECT_TYPES, getObjectTypeIdentity } from '@/lib/commonplace';
import type { ComposeSignal } from '@/lib/commonplace';
import { captureToApi, type ComposeLiveResult } from '@/lib/commonplace-api';
import { useCommonPlace } from '@/lib/commonplace-context';
import { useLiveResearch } from '@/hooks/useLiveResearch';
import LiveResearchGraph from './LiveResearchGraph';

const CommonPlaceEditor = dynamic(
  () => import('./CommonPlaceEditor'),
  { ssr: false },
);

interface ComposeEntityChip {
  id: string;
  label: string;
  slug: string;
  type: string;
}

function toEntityChip(result: ComposeLiveResult): ComposeEntityChip | null {
  if (result.signal !== 'ner') return null;
  const t = result.type.toLowerCase();
  if (!['person', 'place', 'organization', 'concept'].includes(t)) return null;
  return {
    id: `${result.id}:${result.type}`,
    label: result.title,
    slug: result.slug,
    type: t,
  };
}

export default function ComposeView({
  prefillText,
  prefillType,
  onSaved,
}: {
  prefillText?: string;
  prefillType?: string;
  onSaved?: (objectId: number) => void;
}) {
  const { openDrawer } = useCommonPlace();

  const [title, setTitle] = useState('');
  const [objectType, setObjectType] = useState(prefillType ?? 'note');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveText, setLiveText] = useState(prefillText ?? '');
  const [enableNli, setEnableNli] = useState(false);

  const editorRef = useRef<Editor | null>(null);
  const bodyRef = useRef<{ html: string; markdown: string }>({
    html: prefillText ?? '',
    markdown: prefillText ?? '',
  });

  const requestedPasses = useMemo<ComposeSignal[]>(
    () => {
      const passes: ComposeSignal[] = ['tfidf', 'sbert', 'kge', 'ner'];
      if (enableNli) {
        passes.push('supports', 'contradicts');
      }
      return passes;
    },
    [enableNli],
  );

  const {
    results,
    loading: liveLoading,
    paused: livePaused,
    togglePause: toggleLivePause,
    activeSignals,
    degraded,
  } = useLiveResearch(liveText, {
    enableNli,
    minScore: 0.25,
    passes: requestedPasses,
  });

  const handleEditorUpdate = useCallback((payload: TiptapUpdatePayload) => {
    bodyRef.current = payload;
    const liveSource = (payload.markdown || payload.html || '').trim();
    setLiveText(liveSource);
  }, []);

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const entityChips = useMemo(() => {
    const byKey = new Map<string, ComposeEntityChip>();
    for (const result of results) {
      const chip = toEntityChip(result);
      if (!chip) continue;
      if (!byKey.has(chip.id)) byKey.set(chip.id, chip);
    }
    return Array.from(byKey.values()).slice(0, 8);
  }, [results]);

  const handleSave = useCallback(async () => {
    const bodyText = bodyRef.current.markdown || bodyRef.current.html;
    if (!title.trim() && !bodyText.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const result = await captureToApi({
        content: bodyText,
        title: title.trim() || undefined,
        hint_type: objectType,
      });
      onSaved?.(result.object.id);

      setTitle('');
      setLiveText('');
      bodyRef.current = { html: '', markdown: '' };
      editorRef.current?.commands.clearContent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }, [title, objectType, onSaved]);

  const typeIdentity = getObjectTypeIdentity(objectType);

  return (
    <div className="cp-compose-pane">
      <div className="cp-compose-type-bar">
        {OBJECT_TYPES.map((t) => (
          <button
            key={t.slug}
            type="button"
            className={`cp-compose-type-pill${objectType === t.slug ? ' active' : ''}`}
            style={{ '--pill-color': t.color } as CSSProperties}
            onClick={() => setObjectType(t.slug)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="cp-compose-entity-bar">
        {entityChips.length > 0 ? (
          entityChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`cp-compose-entity-chip cp-compose-entity-chip--${chip.type}`}
              onClick={() => openDrawer(chip.slug)}
              title={`Open ${chip.label}`}
            >
              {chip.label}
            </button>
          ))
        ) : (
          <div className="cp-compose-entity-placeholder">
            Named entities appear here while you type
          </div>
        )}
      </div>

      <div className="cp-compose-layout">
        <div className="cp-compose-editor-shell">
          <input
            type="text"
            className="cp-compose-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Untitled ${typeIdentity.label}`}
          />

          <div className="cp-compose-editor-area">
            <CommonPlaceEditor
              initialContent={prefillText}
              initialContentFormat="markdown"
              onUpdate={handleEditorUpdate}
              onEditorReady={handleEditorReady}
            />
          </div>
        </div>

        <aside className="cp-compose-graph-panel">
          <LiveResearchGraph
            results={results}
            loading={liveLoading}
            paused={livePaused}
            activeSignals={activeSignals}
            enableNli={enableNli}
            onTogglePause={toggleLivePause}
            onToggleNli={() => setEnableNli((prev) => !prev)}
            onOpenObject={(slug) => openDrawer(slug)}
          />
          {degraded.degraded && (
            <div className="cp-compose-degraded">
              Running in degraded mode: {degraded.reasons.join(', ')}
            </div>
          )}
        </aside>
      </div>

      <div className="cp-compose-save-bar">
        {error && <span className="cp-compose-error">{error}</span>}
        <button
          type="button"
          className="cp-compose-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'SAVING...' : 'SAVE OBJECT'}
        </button>
      </div>
    </div>
  );
}
