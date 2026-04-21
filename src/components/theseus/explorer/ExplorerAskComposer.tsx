'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { askTheseusAsyncStream } from '@/lib/theseus-api';
import type { ProgressiveVisualPayload, StageEvent } from '@/lib/theseus-api';
import type { StructuredVisual, StructuredVisualRegion, TheseusResponse } from '@/lib/theseus-types';
import { Choreographer } from '@/lib/theseus-viz/Choreographer';
import { type GraphAdapter } from '@/lib/theseus/cosmograph/adapter';
import VisualRenderer from '@/components/theseus/visuals/VisualRenderer';

interface ExplorerAskComposerProps {
  /** Ref to the live canvas so the TF.js-derived SceneDirective can drive
   *  focus / zoom / clearFocus on the graph in real time. */
  canvasAdapter: React.RefObject<GraphAdapter | null>;
  /** Resolve a node id to its display label (for pretext focal labels). */
  resolveLabelText?: (nodeId: string) => string | undefined;
  /** Resolve a node id to label + description, used by the
   *  DirectiveAdapter foundation encoder for learned re-ranking. */
  resolveEvidenceText?: (nodeId: string) => string | undefined;
}

function stageToLabel(event: StageEvent): string {
  switch (event.name) {
    case 'pipeline_start': return 'Starting…';
    case 'e4b_classify_start': return 'Classifying question…';
    case 'e4b_classify_complete': return 'Retrieving evidence…';
    case 'retrieval_start': return 'Searching knowledge graph…';
    case 'retrieval_complete': return `Found ${event.evidence_count} evidence nodes`;
    case 'objects_loaded': return `Loaded ${event.object_count} objects`;
    case 'expression_start': return 'Composing answer…';
    case 'expression_complete': return '';
    default: return '';
  }
}

/**
 * Inline ask composer that lives on the Explorer canvas. Streams the
 * question through /ask/, runs the returned TheseusResponse through the
 * client-side VIE SceneDirector (TF.js GNN scorer with rule-based
 * fallback), and applies the resulting SceneDirective to the live
 * cosmos.gl canvas so the graph reacts in place.
 */
const ExplorerAskComposer: FC<ExplorerAskComposerProps> = ({
  canvasAdapter,
  resolveLabelText,
  resolveEvidenceText,
}) => {
  const [query, setQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [stageLabel, setStageLabel] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [structuredVisual, setStructuredVisual] = useState<StructuredVisual | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const completedRef = useRef(false);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const choreographer = useMemo(
    () =>
      new Choreographer({
        getAdapter: () => canvasAdapter.current,
        resolveLabelText,
        resolveEvidenceText,
        prefersReducedMotion,
      }),
    [canvasAdapter, resolveLabelText, resolveEvidenceText, prefersReducedMotion],
  );

  useEffect(() => {
    return () => {
      choreographer.reset();
    };
  }, [choreographer]);

  const submit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed || isAsking) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      completedRef.current = false;
      choreographer.reset();
      setIsAsking(true);
      setStageLabel('Starting…');
      setAnswer('');
      setError(null);
      setExpanded(true);
      setStructuredVisual(null);

      const captureVisual = (payload: ProgressiveVisualPayload) => {
        // `visualization` on the stream payload contains the backend's
        // structured-visual blob; forward only when it has a renderer or
        // regions worth rendering to avoid flicker on empty payloads.
        const viz = payload.visualization as StructuredVisual | undefined;
        if (!viz) return;
        if (!viz.renderer && !viz.structured && !viz.regions) return;
        setStructuredVisual(viz);
      };

      const handlers = choreographer.observe({
        onStage(event) {
          setStageLabel(stageToLabel(event));
        },
        onToken(token) {
          setAnswer((prev) => prev + token);
          setStageLabel('');
        },
        onVisualDelta: captureVisual,
        onVisualComplete: captureVisual,
        onAnswerReady(result: TheseusResponse) {
          if (result.structured_visual) setStructuredVisual(result.structured_visual);
        },
        onComplete(result: TheseusResponse) {
          completedRef.current = true;
          const narrative = result.sections?.find((s) => s.type === 'narrative');
          const finalText =
            narrative && 'content' in narrative ? narrative.content : result.answer ?? '';
          setAnswer((prev) => finalText || prev);
          setStageLabel('');
          setIsAsking(false);
          abortRef.current = null;
        },
        onError(err) {
          // EventSource fires a generic 'error' when the server closes the
          // stream naturally after `complete`; ignore that case so a
          // successful answer isn't overwritten with a misleading "Stream
          // error" label.
          if (completedRef.current) return;
          setError(err.message);
          setStageLabel('');
          setIsAsking(false);
          abortRef.current = null;
        },
      });

      askTheseusAsyncStream(trimmed, { signal: controller.signal }, handlers).catch(() => {
        // onError has already fired
      });
    },
    [query, isAsking, choreographer],
  );

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsAsking(false);
    setStageLabel('');
    choreographer.reset();
  };

  const clear = () => {
    cancel();
    setAnswer('');
    setError(null);
    setExpanded(false);
    const adapter = canvasAdapter.current;
    adapter?.clearFocus();
    adapter?.clearEncoding();
    adapter?.clearFocalLabels();
    adapter?.fitView();
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(640px, calc(100% - 480px))',
        zIndex: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'color-mix(in srgb, var(--color-hero-ground) 82%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-hero-text) 22%, transparent)',
          borderRadius: 6,
          padding: '6px 6px 6px 14px',
          boxShadow: 'var(--shadow-warm-sm)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask Theseus about the graph…"
          disabled={isAsking}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--color-hero-text)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            padding: '6px 0',
          }}
          aria-label="Ask Theseus a question about the graph"
        />
        {isAsking ? (
          <button
            type="button"
            onClick={cancel}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-hero-text)',
              background: 'transparent',
              border: '1px solid color-mix(in srgb, var(--color-hero-text) 30%, transparent)',
              padding: '6px 12px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!query.trim()}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#fff',
              background: 'var(--color-terracotta)',
              border: '1px solid var(--color-terracotta)',
              padding: '6px 12px',
              borderRadius: 4,
              cursor: query.trim() ? 'pointer' : 'not-allowed',
              opacity: query.trim() ? 1 : 0.5,
            }}
          >
            Ask
          </button>
        )}
      </form>
      {expanded && (stageLabel || answer || error) && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--color-hero-ground) 90%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-hero-text) 18%, transparent)',
            borderRadius: 6,
            padding: '10px 14px',
            maxHeight: 260,
            overflowY: 'auto',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--color-hero-text)',
            boxShadow: 'var(--shadow-warm-sm)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {stageLabel && (
            <div
              aria-live="polite"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-muted)',
                marginBottom: answer ? 6 : 0,
              }}
            >
              {stageLabel}
            </div>
          )}
          {answer && (
            <div style={{ whiteSpace: 'pre-wrap' }}>{answer}</div>
          )}
          {structuredVisual && (
            <div style={{ marginTop: 12 }}>
              <VisualRenderer
                visual={structuredVisual}
                onRegionHover={(region: StructuredVisualRegion | null) => {
                  const adapter = canvasAdapter.current;
                  if (!adapter) return;
                  if (!region || !region.linked_evidence || region.linked_evidence.length === 0) {
                    adapter.clearFocus();
                    return;
                  }
                  adapter.focusNodes(region.linked_evidence);
                }}
                onRegionSelect={(region) => {
                  const adapter = canvasAdapter.current;
                  if (!adapter || !region.linked_evidence?.length) return;
                  adapter.fitViewToNodes(region.linked_evidence, 700, 0.22);
                }}
              />
            </div>
          )}
          {error && (
            <div role="alert" style={{ color: 'var(--color-error)' }}>{error}</div>
          )}
          {!isAsking && (answer || error) && (
            <button
              type="button"
              onClick={clear}
              style={{
                marginTop: 10,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-muted)',
                background: 'transparent',
                border: '1px solid color-mix(in srgb, var(--color-hero-text) 20%, transparent)',
                padding: '4px 10px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ExplorerAskComposer;
