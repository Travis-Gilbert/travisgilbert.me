'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, FC, FormEvent } from 'react';
import { askTheseusAsyncStream } from '@/lib/theseus-api';
import type { ProgressiveVisualPayload, StageEvent } from '@/lib/theseus-api';
import type { StructuredVisual, StructuredVisualRegion, TheseusResponse } from '@/lib/theseus-types';
import { Choreographer } from '@/lib/theseus-viz/Choreographer';
import { type GraphAdapter } from '@/lib/theseus/cosmograph/adapter';
import VisualRenderer from '@/components/theseus/visuals/VisualRenderer';
import { classifyComposerInput } from '@/lib/theseus/composerInputDetect';
import { instantKgStream } from '@/lib/theseus/instantKg';
import type { InstantKgStreamHandlers } from '@/lib/theseus/instantKg';

interface ExplorerAskComposerProps {
  /** Ref to the live canvas so the TF.js-derived SceneDirective can drive
   *  focus / zoom / clearFocus on the graph in real time. */
  canvasAdapter: React.RefObject<GraphAdapter | null>;
  /** Resolve a node id to its display label (for pretext focal labels). */
  resolveLabelText?: (nodeId: string) => string | undefined;
  /** Resolve a node id to label + description, used by the
   *  DirectiveAdapter foundation encoder for learned re-ranking. */
  resolveEvidenceText?: (nodeId: string) => string | undefined;
  /** Optional. When set, URL and file inputs route through the instant-KG
   *  SSE stream and the parent receives typed event callbacks so it can
   *  accumulate points / links on the canvas. Plain text continues to
   *  route through askTheseusAsyncStream and bypasses these handlers. */
  onInstantKg?: InstantKgStreamHandlers;
}

function stageToLabel(event: StageEvent): string {
  switch (event.name) {
    case 'pipeline_start': return 'Starting…';
    case 'e4b_classify_start': return 'Classifying question…';
    case 'e4b_classify_complete': return 'Retrieving evidence…';
    case 'retrieval_start': return 'Searching knowledge graph…';
    case 'retrieval_complete': return `Found ${event.evidence_count} evidence nodes`;
    case 'objects_loaded': return `Loaded ${event.object_count} objects`;
    case 'simulation_assembling':
      return typeof event.primitive_count === 'number'
        ? `Assembling simulation with ${event.primitive_count} primitives`
        : 'Assembling simulation';
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
type AtlasComposerTool = null | 'simulate' | 'search';

const PLACEHOLDERS: Record<Exclude<AtlasComposerTool, null> | 'default', string> = {
  default: 'Ask, think out loud, or @cite a node…',
  simulate: 'Simulate the ideal Theseus peer for a $500 BOM and 30W thermal envelope…',
  search: 'Find: attention-head pairs that freeze around epoch 14…',
};

const ExplorerAskComposer: FC<ExplorerAskComposerProps> = ({
  canvasAdapter,
  resolveLabelText,
  resolveEvidenceText,
  onInstantKg,
}) => {
  const [query, setQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [stageLabel, setStageLabel] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [structuredVisual, setStructuredVisual] = useState<StructuredVisual | null>(null);
  const [tool, setTool] = useState<AtlasComposerTool>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const completedRef = useRef(false);
  const onInstantKgRef = useRef<InstantKgStreamHandlers | undefined>(onInstantKg);
  useEffect(() => {
    onInstantKgRef.current = onInstantKg;
  }, [onInstantKg]);

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
      if (isAsking) return;

      const classified = classifyComposerInput(query, pendingFiles);
      if (classified.kind === 'text' && !classified.text) return;

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

      if (classified.kind === 'url' || classified.kind === 'file') {
        runInstantKg(
          { kind: classified.kind, text: classified.text, files: classified.files },
          controller.signal,
        );
        setPendingFiles([]);
        setQuery('');
        return;
      }

      const trimmed = classified.text;

      const captureVisual = (payload: ProgressiveVisualPayload) => {
        // The backend's structured_visual payload (renderer key + body)
        // lands directly on the normalized payload. Forward only when it
        // has a renderer or regions worth rendering to avoid flicker.
        const viz = payload.structured_visual;
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

      const renderHints =
        tool === 'simulate'
          ? { answer_type: 'simulation' }
          : undefined;

      askTheseusAsyncStream(trimmed, { signal: controller.signal, render_hints: renderHints }, handlers).catch(() => {
        // onError has already fired
      });
    },
    [query, isAsking, choreographer, tool, pendingFiles],
  );

  const runInstantKg = useCallback(
    (
      classified: { kind: 'url' | 'file'; text: string; files: File[] },
      signal: AbortSignal,
    ) => {
      const parentHandlers = onInstantKgRef.current;
      let entityCount = 0;
      let relationCount = 0;
      let chunkCount = 0;

      const handlers: InstantKgStreamHandlers = {
        onStage(stage) {
          if (stage.name === 'pipeline_start') {
            setStageLabel(classified.kind === 'url' ? 'Reading URL…' : 'Reading file…');
          }
          parentHandlers?.onStage?.(stage);
        },
        onDocument(event) {
          setStageLabel(`Captured ${event.title}`);
          parentHandlers?.onDocument?.(event);
        },
        onChunk(event) {
          chunkCount += 1;
          setStageLabel(`Extracting (${chunkCount} chunk${chunkCount === 1 ? '' : 's'})…`);
          parentHandlers?.onChunk?.(event);
        },
        onEntity(event) {
          entityCount += 1;
          setStageLabel(
            `${entityCount} entit${entityCount === 1 ? 'y' : 'ies'}, ${relationCount} relation${
              relationCount === 1 ? '' : 's'
            }`,
          );
          parentHandlers?.onEntity?.(event);
        },
        onRelation(event) {
          relationCount += 1;
          setStageLabel(
            `${entityCount} entit${entityCount === 1 ? 'y' : 'ies'}, ${relationCount} relation${
              relationCount === 1 ? '' : 's'
            }`,
          );
          parentHandlers?.onRelation?.(event);
        },
        onCrossDocEdge(event) {
          parentHandlers?.onCrossDocEdge?.(event);
        },
        onComplete(event) {
          completedRef.current = true;
          const totals = event.totals;
          setStageLabel('');
          setAnswer(
            `Captured ${totals.chunks} chunk${totals.chunks === 1 ? '' : 's'}, ` +
              `${totals.entities} entit${totals.entities === 1 ? 'y' : 'ies'}, ` +
              `${totals.relations} relation${totals.relations === 1 ? '' : 's'}` +
              (totals.cross_doc_edges
                ? `, ${totals.cross_doc_edges} cross-doc link${
                    totals.cross_doc_edges === 1 ? '' : 's'
                  }`
                : ''),
          );
          setIsAsking(false);
          abortRef.current = null;
          parentHandlers?.onComplete(event);
        },
        onError(err) {
          if (completedRef.current) return;
          setError(err.message);
          setStageLabel('');
          setIsAsking(false);
          abortRef.current = null;
          parentHandlers?.onError(err);
        },
      };

      const request =
        classified.kind === 'file'
          ? { mode: 'file' as const, file: classified.files[0] ?? null }
          : { mode: 'url' as const, text: classified.text };

      instantKgStream(request, { signal }, handlers).catch(() => {
        // onError already fired
      });
    },
    [],
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
    <>
      {expanded && (stageLabel || answer || error || structuredVisual) && (
        <div className="atlas-chat-transcript">
          {stageLabel && (
            <div aria-live="polite" className="atlas-chat-msg" style={{ color: 'var(--paper-ink-3)' }}>
              <span className="role">Θ</span>
              {stageLabel}
            </div>
          )}
          {answer && (
            <div className="atlas-chat-msg" style={{ whiteSpace: 'pre-wrap' }}>
              <span className="role">Θ</span>
              {answer}
            </div>
          )}
          {structuredVisual && (
            <div style={{ marginTop: 8 }}>
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
            <div role="alert" className="atlas-chat-msg" style={{ color: 'var(--paper-pencil)' }}>
              <span className="role">!</span>
              {error}
            </div>
          )}
        </div>
      )}
      <form
        onSubmit={submit}
        className={`atlas-chat-input-row${isDragOver ? ' drag-over' : ''}`}
        onDragOver={(e: DragEvent<HTMLFormElement>) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setIsDragOver(true);
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e: DragEvent<HTMLFormElement>) => {
          if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
          e.preventDefault();
          setIsDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          setPendingFiles(files);
        }}
      >
        <textarea
          className="atlas-chat-input"
          rows={1}
          value={query}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(e as unknown as FormEvent<HTMLFormElement>);
            }
          }}
          onPaste={(e: ClipboardEvent<HTMLTextAreaElement>) => {
            const files: File[] = [];
            const items = e.clipboardData?.items ?? [];
            for (let i = 0; i < items.length; i += 1) {
              const item = items[i];
              if (item.kind === 'file') {
                const f = item.getAsFile();
                if (f) files.push(f);
              }
            }
            if (files.length > 0) {
              e.preventDefault();
              setPendingFiles(files);
            }
          }}
          placeholder={PLACEHOLDERS[tool ?? 'default']}
          disabled={isAsking}
          aria-label="Ask Theseus a question about the graph"
        />
        {pendingFiles.length > 0 && (
          <ul className="atlas-chat-files" aria-label="Attached files">
            {pendingFiles.map((file, idx) => (
              <li key={`${file.name}-${idx}`} className="atlas-chat-file-chip">
                {file.name}
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() =>
                    setPendingFiles((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
      <div className="atlas-chat-tools">
        <button
          type="button"
          className={`atlas-chat-tool${tool === 'simulate' ? ' active' : ''}`}
          onClick={() => setTool((t) => (t === 'simulate' ? null : 'simulate'))}
          title="Compose an interactive answer"
          aria-pressed={tool === 'simulate'}
        >
          <span aria-hidden className="dot" /> Simulate
        </button>
        <button
          type="button"
          className={`atlas-chat-tool${tool === 'search' ? ' active' : ''}`}
          onClick={() => setTool((t) => (t === 'search' ? null : 'search'))}
          title="Find subgraphs"
          aria-pressed={tool === 'search'}
        >
          <span aria-hidden className="dot" /> Search
        </button>
        {!isAsking && (answer || error) && (
          <button type="button" className="atlas-chat-tool" onClick={clear}>
            Clear
          </button>
        )}
        {isAsking ? (
          <button type="button" className="atlas-chat-send" onClick={cancel} style={{ marginLeft: 'auto' }}>
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="atlas-chat-send"
            disabled={!query.trim()}
            onClick={(e) => submit(e as unknown as FormEvent<HTMLFormElement>)}
            style={{ marginLeft: 'auto' }}
          >
            {tool === 'simulate' ? 'Assemble ↵' : 'Send ↵'}
          </button>
        )}
      </div>
    </>
  );
};

export default ExplorerAskComposer;
