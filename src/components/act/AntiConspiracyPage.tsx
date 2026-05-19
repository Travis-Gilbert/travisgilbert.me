'use client';

/**
 * AntiConspiracyPage (Retro Lab port).
 *
 * Replaces the prior parchment + Blueprint surfaces with the Retro Lab
 * Design Scheme handoff from claude.ai/design. Visual treatment is
 * documented in `AntiConspiracyPage.module.css`; logic preserves every
 * data hook from the prior version (drop handler, paste handler, URL
 * handler, ACC scoring call, Gemma 4B MLC runner, file size limits).
 *
 * MT19937 stream background is ported from `act.js` in the bundle and
 * adapted to React: a `<canvas>` ref + `useEffect` that draws on mount,
 * on resize, and after analysis state changes (so the seed advances
 * with the loaded document hash).
 *
 * Visual register: single workbench tone (#F6F5F2), patent-plate
 * figures on white, terracotta as the single attention color.
 * Reference: `/tmp/retro-lab-extract/retro-lab-design-scheme/project/`.
 */

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import styles from './AntiConspiracyPage.module.css';
import { DynamicIslandTOC } from './DynamicIslandTOC';
import { CompressedFooter } from './CompressedFooter';
import { CockpitRenderer } from './cockpit/CockpitRenderer';
import { buildEvidenceScene, validateEvidenceScene } from '@/lib/act/scene-builder';
import type { SceneDirective } from '@/lib/act/scene-schema';
import {
  analyzeDocument,
  analyzeDocumentAsync,
  formatScore,
  normalizeWhitespace,
  urlSafeLabel,
  MLCRunner,
  MAX_TEXT_LENGTH,
  MAX_FILE_BYTES,
  type AnalysisResult,
  type LoadProgress,
  type RunnerState,
  type ScoredClaim,
  type Verdict,
} from '@/lib/act';

type LabStatus = 'idle' | 'reading' | 'scoring' | 'ready' | 'error';
type Mode = 'drop' | 'paste' | 'url';

const VERDICT_LABEL_SHORT: Record<Verdict, string> = {
  trustworthy: 'trustworthy',
  mixed: 'mixed',
  unreliable: 'unreliable',
  fiction: 'fiction',
};

/* ── MT19937 + Catmull-Rom stream background ────────────────────────
 * Ported from /tmp/retro-lab-extract/retro-lab-design-scheme/
 * project/src/act.js. Seeded from a fixed string when idle, reseeded
 * from hash(documentText) when a document is loaded. */

class MT19937 {
  private mt: Uint32Array;
  private index: number;
  constructor(seed: number) {
    this.mt = new Uint32Array(624);
    this.mt[0] = seed >>> 0;
    for (let i = 1; i < 624; i++) {
      const s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = (Math.imul(1812433253, s) + i) >>> 0;
    }
    this.index = 624;
  }
  next(): number {
    if (this.index >= 624) {
      for (let i = 0; i < 624; i++) {
        const y = (this.mt[i] & 0x80000000) + (this.mt[(i + 1) % 624] & 0x7fffffff);
        let v = this.mt[(i + 397) % 624] ^ (y >>> 1);
        if (y & 1) v ^= 2567483615;
        this.mt[i] = v >>> 0;
      }
      this.index = 0;
    }
    let y = this.mt[this.index++];
    y ^= y >>> 11;
    y ^= (y << 7) & 2636928640;
    y ^= (y << 15) & 4022730752;
    y ^= y >>> 18;
    return y >>> 0;
  }
  unit(): number {
    return this.next() / 4294967296;
  }
}

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function catmullRom(
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number],
  t: number,
): [number, number] {
  const t2 = t * t;
  const t3 = t2 * t;
  const x =
    0.5 *
    (2 * p1[0] +
      (-p0[0] + p2[0]) * t +
      (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
      (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
  const y =
    0.5 *
    (2 * p1[1] +
      (-p0[1] + p2[1]) * t +
      (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
      (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
  return [x, y];
}

interface DrawStreamOptions {
  canvas: HTMLCanvasElement;
  rootEl: HTMLElement;
  seedString: string;
  exclusionSelectors: readonly string[];
}

function drawStream({ canvas, rootEl, seedString, exclusionSelectors }: DrawStreamOptions) {
  const w = window.innerWidth;
  /* Viewport-bound (not scrollHeight-bound). The canvas is
     `position: fixed; inset: 0`, so its visible region is exactly the
     viewport: sizing the buffer to the full page height made the path
     draw mostly below the fold and we only saw the corner that
     happened to terminate on-screen. */
  const h = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const seed = hashStr(seedString) >>> 0;
  const rng = new MT19937(seed);

  /* Exclusion zones in viewport coords (canvas is fixed, so no scroll
     offset). `getBoundingClientRect` already returns viewport coords;
     adding scrollX/scrollY here would have pushed exclusions off the
     visible canvas whenever the user scrolled. */
  const excl: Array<{ l: number; t: number; r: number; b: number }> = [];
  rootEl.querySelectorAll(exclusionSelectors.join(',')).forEach((el) => {
    const r = el.getBoundingClientRect();
    excl.push({
      l: r.left - 18,
      t: r.top - 18,
      r: r.right + 18,
      b: r.bottom + 18,
    });
  });
  const inExcl = (x: number, y: number) => {
    for (let i = 0; i < excl.length; i++) {
      const e = excl[i];
      if (x > e.l && x < e.r && y > e.t && y < e.b) return true;
    }
    return false;
  };

  /* Path geometry: enter upper-left, dip through the middle band, exit
     upper-right. Multiple control points give the curvilinear, wave-like
     character; Catmull-Rom interpolation smooths between them. Endpoints
     anchor outside the canvas so the curve enters/exits cleanly without
     terminal stubs. All coordinates are viewport-relative. */
  const before: [number, number] = [-120, h * 0.08];
  const start: [number, number] = [60, h * 0.18];
  const end: [number, number] = [w - 60, h * 0.15];
  const after: [number, number] = [w + 120, h * 0.08];
  const path: ReadonlyArray<readonly [number, number]> = [
    before,
    start,
    [w * 0.14, h * 0.36], // dip 1 (left margin)
    [w * 0.30, h * 0.28], // crest 1
    [w * 0.46, h * 0.58], // dip 2 (deepest, behind workbench mid)
    [w * 0.60, h * 0.46], // crest 2
    [w * 0.76, h * 0.54], // dip 3
    [w * 0.90, h * 0.26], // rise toward upper-right
    end,
    after,
  ];

  const segments = path.length - 3;
  const totalSteps = Math.max(2400, Math.floor(Math.max(w, h) * 2.2));
  const stepsPer = Math.max(1, Math.floor(totalSteps / segments));

  const chars = ['0', '1', '·'];
  const offsetMax = 64;
  let placed = 0;

  /* Lower-than-original alpha so the stream reads as a backdrop rather
     than competing with the workbench type. The curve passes through
     mid-page (over specs/analyzer at the dip point), so it must be
     readable as texture, not as foreground. */
  const CORE_ALPHA = 0.055;
  const SIGNAL_ALPHA = 0.12;
  const PER_STEP = 7;

  ctx.font = '11px "JetBrains Mono", ui-monospace, Menlo, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  for (let s = 0; s < segments; s++) {
    const p0 = path[s];
    const p1 = path[s + 1];
    const p2 = path[s + 2];
    const p3 = path[s + 3];
    for (let i = 0; i < stepsPer; i++) {
      const t = i / stepsPer;
      const [cx, cy] = catmullRom(p0, p1, p2, p3, t);
      const [nx, ny] = catmullRom(p0, p1, p2, p3, Math.min(1, t + 0.001));
      const dx = nx - cx;
      const dy = ny - cy;
      const len = Math.hypot(dx, dy) || 1;
      const ox = -dy / len;
      const oy = dx / len;

      for (let j = 0; j < PER_STEP; j++) {
        const r1 = rng.unit();
        const r2 = rng.unit();
        const r3 = rng.unit();
        const sign = r1 < 0.5 ? -1 : 1;
        const mag = Math.pow(r2, 0.7) * offsetMax;
        const off = sign * mag;
        const x = cx + ox * off;
        const y = cy + oy * off;

        if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;
        if (inExcl(x, y)) continue;

        const distNorm = Math.min(1, Math.abs(off) / offsetMax);
        let alpha = CORE_ALPHA * (1 - distNorm);
        let color = '#2A2823';
        if (placed % 40 === 0 && placed > 0) {
          color = '#B8472D';
          alpha = SIGNAL_ALPHA * (1 - distNorm);
        }
        if (alpha <= 0.002) {
          placed++;
          continue;
        }

        const ch = chars[Math.floor(r3 * chars.length) % chars.length];
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillText(ch, x, y);
        placed++;
      }
    }
  }
  ctx.globalAlpha = 1;
}

/* Only the two largest type-heavy surfaces are excluded. The reduced
   stream alpha lets the curve pass behind the rest of the workbench
   as texture without hurting readability. The title block has the
   largest type and the most-read content; the analyzer well has the
   drop target glyph that must stay crisp during a drag. Everything
   else (specs, graph, axes, outcome, footer) lets the curve flow
   through as backdrop. */
const STREAM_EXCLUSIONS = [
  `.${styles.titleblock}`,
  `.${styles.analyzer}`,
];

/* ── Component ────────────────────────────────────────────────── */

export default function AntiConspiracyPage() {
  const [urlValue, setUrlValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [status, setStatus] = useState<LabStatus>('idle');
  const [message, setMessage] = useState('Drop a document, paste text, or analyze a URL.');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activeClaim, setActiveClaim] = useState<ScoredClaim | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<Mode>('drop');
  const [modelState, setModelState] = useState<RunnerState>('uninitialized');
  const [modelProgress, setModelProgress] = useState<LoadProgress>({
    percent: 0,
    mbLoaded: 0,
    mbTotal: 0,
    stage: 'idle',
  });
  const [usedModel, setUsedModel] = useState<boolean | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const streamCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounter = useRef(0);

  /* Block default browser drop handling outside the well so a stray
     drop doesn't navigate the tab to the dropped file. */
  useEffect(() => {
    const block = (event: globalThis.DragEvent) => {
      if (event.dataTransfer?.types?.includes('Files')) {
        event.preventDefault();
      }
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  /* Stream canvas: redraw on mount, on resize, when fonts settle, and
     whenever the analysis state changes (so the seed advances with the
     loaded document hash). */
  useEffect(() => {
    const canvas = streamCanvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return undefined;

    let rafId = 0;
    const seedString = analysis
      ? `doc:${analysis.source_label}:${analysis.word_count}w:${analysis.claims.length}c`
      : 'anti-conspiracy-theorem';

    const schedule = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() =>
        drawStream({
          canvas,
          rootEl: root,
          seedString,
          exclusionSelectors: STREAM_EXCLUSIONS,
        }),
      );
    };

    schedule();
    window.addEventListener('resize', schedule);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(schedule);
    }
    const t1 = window.setTimeout(schedule, 240);
    const t2 = window.setTimeout(schedule, 1200);

    return () => {
      window.removeEventListener('resize', schedule);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      cancelAnimationFrame(rafId);
    };
  }, [analysis]);

  /* ── Core analyzer call (preserved from prior implementation) ── */

  const runTextAnalysis = useCallback(
    async (text: string, title: string, sourceType: AnalysisResult['source_type']) => {
      const cleaned = normalizeWhitespace(text).slice(0, MAX_TEXT_LENGTH);
      if (cleaned.split(/\s+/).filter(Boolean).length < 12) {
        setStatus('error');
        setMessage('Give the lab a little more text so the trace has something real to inspect.');
        return;
      }
      setStatus('scoring');
      const ready = MLCRunner.get().getState() === 'ready';
      setMessage(
        ready
          ? 'Asking Gemma 4B to extract the claim inventory.'
          : 'Scoring claims and building the graph.',
      );

      let result: AnalysisResult;
      let modelUsed: boolean;
      if (ready) {
        const out = await analyzeDocumentAsync(cleaned, title, sourceType, true);
        result = out.result;
        modelUsed = out.usedModel;
      } else {
        result = analyzeDocument(cleaned, title, sourceType);
        modelUsed = false;
      }
      setAnalysis(result);
      setActiveClaim(result.claims[0] ?? null);
      setUsedModel(modelUsed);
      setStatus('ready');
      setMessage(
        `Scored ${result.claims.length} claims from ${result.source_label}. ACC ${formatScore(result.overall_score)} · ${VERDICT_LABEL_SHORT[result.verdict]} · ${
          modelUsed ? 'Gemma 4B extraction' : 'heuristic extraction'
        }.`,
      );
    },
    [],
  );

  const handleLoadModel = useCallback(() => {
    if (modelState === 'loading' || modelState === 'ready') return;
    void MLCRunner.get()
      .initialize('/act/model.json', (p) => setModelProgress(p))
      .then(() => setModelState(MLCRunner.get().getState()))
      .catch(() => setModelState(MLCRunner.get().getState()));
    setModelState('loading');
  }, [modelState]);

  const handleUrlSubmit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      const target = urlValue.trim();
      if (!target) {
        setStatus('error');
        setMessage('Paste a URL before running the lab.');
        return;
      }
      setStatus('reading');
      setMessage('Fetching the document.');
      try {
        const response = await fetch('/api/act/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: target }),
        });
        const payload = await response.json();
        if (!response.ok) {
          setStatus('error');
          setMessage(
            typeof payload?.error === 'string' ? payload.error : 'The URL could not be analyzed.',
          );
          return;
        }
        const title =
          typeof payload?.title === 'string' && payload.title ? payload.title : urlSafeLabel(target);
        void runTextAnalysis(String(payload.text ?? ''), title, 'url');
      } catch {
        setStatus('error');
        setMessage('Network error while fetching the URL.');
      }
    },
    [urlValue, runTextAnalysis],
  );

  const handlePasteSubmit = useCallback(() => {
    const trimmed = textValue.trim();
    if (!trimmed) {
      setStatus('error');
      setMessage('Paste some prose before running the lab.');
      return;
    }
    void runTextAnalysis(trimmed, 'Pasted text', 'text');
  }, [textValue, runTextAnalysis]);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_BYTES) {
        setStatus('error');
        setMessage(`That file is larger than ${Math.round(MAX_FILE_BYTES / 1024)} KB.`);
        return;
      }
      setStatus('reading');
      setMessage(`Reading ${file.name}.`);
      try {
        const text = await file.text();
        void runTextAnalysis(text, file.name, 'document');
      } catch {
        setStatus('error');
        setMessage('Could not read that file as text.');
      }
    },
    [runTextAnalysis],
  );

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer?.types?.includes('Files')) return;
    dragCounter.current += 1;
    setIsDragging(true);
  };
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  };
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
  };

  const onRunAnalysis = () => {
    if (mode === 'url') {
      void handleUrlSubmit();
    } else if (mode === 'paste') {
      handlePasteSubmit();
    } else {
      if (fileInputRef.current) fileInputRef.current.click();
    }
  };

  /* ── Derived display data ───────────────────────────────────── */

  // Readout stats moved into <DynamicIslandTOC />; the island reads
  // `analysis` directly so no derived `stats` memo is needed here.

  const graphLayout = useMemo(() => buildGraphLayout(analysis), [analysis]);

  /* Build the EvidenceCockpit A2UI scene from the analysis result. The
     deterministic builder mirrors `theseus_acc.a2ui.build_evidence_scene`
     on the standalone repo. We validate immediately after building so a
     drift between the builder + validator surfaces as an in-page error
     rather than a silent shape regression. */
  const scene = useMemo<SceneDirective | null>(() => {
    if (!analysis) return null;
    try {
      return buildEvidenceScene(analysis);
    } catch {
      return null;
    }
  }, [analysis]);

  const sceneErrors = useMemo<string[]>(() => {
    if (!scene) return [];
    return validateEvidenceScene(scene);
  }, [scene]);

  const todayLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase();
  }, []);

  const wellMeta = analysis
    ? `${Math.round(analysis.word_count * 6 / 1024)} KB · ${analysis.word_count} words · ${analysis.claims.length} claims`
    : null;

  const busy = status === 'reading' || status === 'scoring';

  return (
    <div className={styles.root} ref={rootRef}>
      <canvas ref={streamCanvasRef} className={styles.streamBg} aria-hidden="true" />

      <DynamicIslandTOC
        analysis={analysis}
        status={status}
        message={message}
        onDropFile={handleFile}
      />

      <main className={styles.workbench}>
        {/* ── Breadcrumb strip ────────────────────────────────── */}
        <header className={styles.strip}>
          <span className={styles.crumbs}>
            <Link href="/">TRAVISGILBERT.ME</Link>
            <span className={styles.sep}>/</span>
            <Link href="/projects">PROJECTS</Link>
            <span className={styles.sep}>/</span>
            <span className={styles.here}>ANTI-CONSPIRACY THEOREM</span>
          </span>
          <span className={styles.sheet}>
            <Link href="/act/notebook">SHEET 04 / N · TECHNICAL NOTEBOOK →</Link>
          </span>
        </header>

        {/* ── Title block ─────────────────────────────────────── */}
        <section className={styles.titleblock}>
          <div className={styles.left}>
            <div>{todayLabel}</div>
            <div>T. GILBERT</div>
            <div className={styles.role}>Inventor</div>
          </div>
          <div className={styles.center}>
            ANTI-CONSPIRACY THEOREM
            <span className={styles.sub}>
              — An instrument for inspecting claims by evidence shape, source diversity, falsifiability, and rhetorical pressure —
            </span>
          </div>
          <div className={styles.right}>
            <div>ACT · v0.4.2</div>
            <div>ACC v{analysis?.algorithm_version ?? '2.1.0'}</div>
            <div className={styles.role}>Sheet 04 of N</div>
          </div>
        </section>

        <p className={styles.inRe}>
          In re: <em>&ldquo;A working public lab for inspecting claims by evidence shape, source diversity, falsifiability, and rhetorical pressure.&rdquo;</em>
        </p>

        {/* Specifications section was absorbed into <CompressedFooter />
            below; the body keeps focus on intake → graph → axes →
            outcome. */}

        {/* ── Analyzer (the hero interaction) ─────────────────── */}
        <section className={styles.analyzer} aria-label="Document analyzer">
          <div
            className={`${styles.well} ${isDragging ? styles.dragging : ''}`}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => {
              if (mode === 'drop' && fileInputRef.current) fileInputRef.current.click();
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && mode === 'drop') {
                e.preventDefault();
                if (fileInputRef.current) fileInputRef.current.click();
              }
            }}
            aria-label="Drop a document, or click to select a file"
          >
            <span className={styles.wellLabel}>
              Insert document · TXT · Markdown · HTML · ≤ {Math.round(MAX_FILE_BYTES / 1024)} KB
            </span>

            {analysis ? (
              <div className={styles.wellDoc}>
                <span className={styles.num}>D-01</span>
                <div>
                  <div className={styles.name}>{analysis.source_label}</div>
                  <div className={styles.meta}>{wellMeta}</div>
                </div>
              </div>
            ) : (
              <>
                <svg className={styles.wellFig} viewBox="0 0 920 132" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <pattern id="intake-hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="7" className={`${styles.pln} ${styles.pln3}`} stroke="#000" strokeOpacity="0.28" />
                    </pattern>
                  </defs>
                  <path d="M 24 28 L 896 28 L 904 36 L 904 96 L 896 104 L 24 104 L 16 96 L 16 36 Z" className={`${styles.pln} ${styles.pln2}`} />
                  <rect x="32" y="40" width="856" height="52" fill="url(#intake-hatch)" />
                  <g className={`${styles.pln} ${styles.pln2}`}>
                    <path d="M 440 56 L 460 66 L 440 76" />
                    <path d="M 460 56 L 480 66 L 460 76" />
                  </g>
                  <text x="460" y="22" textAnchor="middle" className={styles.plnLbl} style={{ fontSize: '8.5px', letterSpacing: '0.16em', fontStyle: 'normal' }}>
                    DROP · PASTE · URL
                  </text>
                </svg>
                <span className={styles.wellEmptyCap}>awaiting document</span>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.markdown,.html,.htm,text/plain,text/markdown,text/html"
              onChange={onFileChange}
              style={{ display: 'none' }}
            />
          </div>

          <div className={styles.bar}>
            <span className={styles.label}>Mode</span>
            {(['drop', 'paste', 'url'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`${styles.mode} ${mode === m ? styles.on : ''}`}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
              >
                <span className={styles.d} />{m.toUpperCase()}
              </button>
            ))}
            <span className={styles.spacer} />
            <span className={styles.hint}>{busy ? 'WORKING' : '⏎ to run'}</span>
            <button type="button" className={styles.run} onClick={onRunAnalysis} disabled={busy}>
              {analysis ? 'Re-run analysis' : 'Run analysis'} <span className={styles.arrow}>→</span>
            </button>
          </div>

          {mode === 'paste' && (
            <div className={styles.intakeField}>
              <label htmlFor="act-paste">Paste prose</label>
              <textarea
                id="act-paste"
                placeholder="Paste any block of prose. The lab will extract claims, score evidence, and surface where the argument leans on rhetoric instead of fact."
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
              />
            </div>
          )}
          {mode === 'url' && (
            <form className={styles.intakeField} onSubmit={handleUrlSubmit}>
              <label htmlFor="act-url">Article URL</label>
              <input
                id="act-url"
                type="text"
                placeholder="https://example.com/article-to-inspect"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
              />
            </form>
          )}

          {message && (
            <p className={`${styles.statusStrip} ${status === 'error' ? styles.error : busy ? styles.busy : ''}`}>
              {message}
            </p>
          )}
        </section>

        {/* ── EvidenceCockpit (A2UI catalog) ──────────────────── */}
        {scene && sceneErrors.length === 0 && (
          <section aria-label="Evidence cockpit">
            <CockpitRenderer scene={scene} />
          </section>
        )}
        {scene && sceneErrors.length > 0 && (
          <section
            aria-label="Evidence cockpit error"
            style={{
              marginTop: 32,
              padding: 16,
              border: '1px solid var(--signal, #B8472D)',
              background: 'var(--signal-soft, rgba(184, 71, 45, 0.10))',
              fontFamily: 'var(--f-mono, monospace)',
              fontSize: 12,
            }}
          >
            <strong>Cockpit schema rejected the analysis:</strong>
            <ul>
              {sceneErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Graph builder ───────────────────────────────────── */}
        <section className={styles.graphBlock} aria-label="Claim graph">
          <figure className={styles.graphFig}>
            {analysis ? (
              <ClaimGraph
                layout={graphLayout}
                activeId={activeClaim?.id ?? null}
                onSelect={setActiveClaim}
              />
            ) : (
              <>
                <div className={styles.emptyHatch} />
                <figcaption className={styles.figCap}>
                  <span className={styles.num}>Fig. 1</span> · Claim graph — awaiting document.
                </figcaption>
              </>
            )}
            {analysis && (
              <figcaption className={styles.figCap}>
                <span className={styles.num}>Fig. 1</span> · Claim graph — {analysis.claims.length} nodes
                {activeClaim ? <> · node <strong>{shortId(activeClaim.id)}</strong> selected</> : null}.
              </figcaption>
            )}
          </figure>

          <aside className={styles.trace}>
            <h5>Trace detail</h5>
            {activeClaim ? (
              <ClaimTrace claim={activeClaim} />
            ) : (
              <p className={styles.emptyNote}>
                Select a node after a run to inspect its claim shape, sources, and rhetorical markers.
              </p>
            )}
          </aside>
        </section>

        {/* Readouts row (average ACC + verdict counts) was absorbed
            into <DynamicIslandTOC /> at the top of the page. The
            island shows the four cells in pill form when analysis is
            loaded, and falls back to the drop-zone affordance
            otherwise. */}

        {/* ── 11-axis section ─────────────────────────────────── */}
        <div className={styles.axesHead}>
          <span>§ 02 · How information is scored · 11 axes</span>
          <span className={styles.note}>4 shown · 7 in spec · <a href="#model-card">model card →</a></span>
        </div>

        <section className={styles.axes}>
          <AxisCard
            num="§ 01"
            title="Evidence shape"
            body={
              <>
                Each <Cnum n="30" /> claim is traced through its citation chain to a <Cnum n="34" /> primary source. Anecdote → secondary → primary scores higher than anecdote-only; broken or circular chains score lower. <Cnum n="32" /> Intermediate links are inspected for whether they themselves quote the primary verbatim.
              </>
            }
            figure={<EvidenceShapeFig />}
          />
          <AxisCard
            num="§ 02"
            title="Source diversity"
            body={
              <>
                A <Cnum n="40" /> claim supported by independent sources across <Cnum n="42" /> distinct domains scores higher than the same claim cited four times from one outlet. We measure entropy across publisher, methodology, and funding lines.
              </>
            }
            figure={<SourceDiversityFig />}
          />
          <AxisCard
            num="§ 03"
            title="Falsifiability"
            body={
              <>
                A <Cnum n="50" /> claim is only meaningful if a <Cnum n="52" /> test could in principle disprove it. We extract whether the author specifies what would change their mind. Unfalsifiable claims (self-sealing, &ldquo;they would say that&rdquo;) are flagged regardless of how many sources cite them.
              </>
            }
            figure={<FalsifiabilityFig />}
          />
          <AxisCard
            num="§ 04"
            title="Rhetorical pressure"
            body={
              <>
                High <Cnum n="60" /> rhetorical pressure does not make a claim false, but it correlates with under-evidence. We catalogue <Cnum n="62" /> urgency, in-group framing, and emotional escalation as separate signals so the reader can weigh them deliberately.
              </>
            }
            figure={<RhetoricalPressureFig />}
          />
        </section>

        {/* ── § 03 Outcome-calibrated layer ───────────────────── */}
        <section className={styles.outcome} id="model-card" aria-label="Outcome-calibrated layer">
          <div className={styles.head}>
            <span className={styles.secNum}>§ 03 · Outcome-calibrated layer</span>
            <span className={styles.ti}>Fig. 02 · The meta-learning loop</span>
          </div>
          <div>
            <OutcomeLoopFig />
          </div>
          <div className={styles.copy}>
            <p>
              The <Cnum n="30" /> structural ACC score (the 11 axes) is wrapped by an evolutionary calibration layer. Every <Cnum n="32" /> decision is written to an outcome ledger — what the model said, what later proved true — and a <Cnum n="34" /> shadow evaluator is trained against that ledger off-line.
            </p>
            <p>
              When the shadow consistently outperforms the live evaluator, the <Cnum n="36" /> promotion gate proposes a weight update. The <Cnum n="38" /> core algorithm is never rewritten; only the calibration is replaced. This keeps the instrument auditable while letting it learn.
            </p>
          </div>
        </section>

        {/* ── Compressed footer (absorbs Specifications + wave bars
            from Footer.md + colophon) ─────────────────────────── */}
        <CompressedFooter
          algorithmVersion={analysis?.algorithm_version ?? '2.1.0'}
          modelState={modelState}
          modelProgress={modelProgress}
          extractorLabel={extractorLabel(modelState, usedModel)}
          modelRowLabel={modelRowLabel(modelState, modelProgress, handleLoadModel)}
          inputsLabel={`TXT · MD · HTML · ≤ ${Math.round(MAX_FILE_BYTES / 1024)} KB`}
          todayLabel={todayLabel}
        />
      </main>
    </div>
  );
}

/* ── Small components ──────────────────────────────────────────── */

interface GraphPositioned {
  claim: ScoredClaim;
  x: number;
  y: number;
}

function buildGraphLayout(analysis: AnalysisResult | null): GraphPositioned[] {
  if (!analysis) return [];
  const radiusX = 180;
  const radiusY = 120;
  const total = Math.max(1, analysis.claims.length);
  return analysis.claims.map((claim, index) => {
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
    return {
      claim,
      x: Math.cos(angle) * radiusX,
      y: Math.sin(angle) * radiusY,
    };
  });
}

const VERDICT_STROKE: Record<Verdict, string> = {
  trustworthy: 'var(--ink)',
  mixed: 'var(--ink)',
  unreliable: 'var(--signal)',
  fiction: 'var(--text-muted)',
};

function ClaimGraph({
  layout,
  activeId,
  onSelect,
}: {
  layout: GraphPositioned[];
  activeId: string | null;
  onSelect: (claim: ScoredClaim) => void;
}) {
  const viewWidth = 560;
  const viewHeight = 360;
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%' }}
      role="img"
      aria-label="Claim graph"
    >
      <g className={styles.pln + ' ' + styles.pln2}>
        {layout.map(({ claim, x, y }) => (
          <line key={`e-${claim.id}`} x1={cx} y1={cy} x2={cx + x} y2={cy + y} />
        ))}
      </g>
      {layout.map(({ claim, x, y }, index) => {
        const tx = cx + x;
        const ty = cy + y;
        const isActive = claim.id === activeId;
        return (
          <g
            key={claim.id}
            className={styles.graphNode}
            onClick={() => onSelect(claim)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(claim);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Claim ${index + 1}: ${claim.text.slice(0, 80)}`}
          >
            <circle cx={tx} cy={ty} r={6} className={`${styles.pln} ${styles.pln1} ${styles.plnFill}`} />
            {isActive && (
              <circle
                cx={tx}
                cy={ty}
                r={13}
                fill="none"
                stroke={VERDICT_STROKE[claim.verdict]}
                strokeWidth="1.4"
              />
            )}
            <text
              x={tx}
              y={ty - 12}
              textAnchor="middle"
              className={`${styles.plnNum} ${styles.graphNodeText}`}
            >
              {(index + 1) * 2 + 8}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ClaimTrace({ claim }: { claim: ScoredClaim }) {
  const features = claim.feature_breakdown;
  const sourceCount = features.source_independence != null
    ? Math.max(1, Math.round(features.source_independence * 4))
    : 1;
  const evidenceShape = features.root_depth != null
    ? `${Math.round(features.root_depth * 4)} / 4 hops to primary`
    : 'unknown';
  return (
    <div>
      <span className={styles.claimNum}>{shortId(claim.id)}</span>
      <p className={styles.claim}>&ldquo;{claim.text}&rdquo;</p>
      <div className={styles.rows}>
        <div className={styles.row}><span className={styles.k}>Evidence shape</span><span className={styles.v}>{evidenceShape}</span></div>
        <div className={styles.row}><span className={styles.k}>Source diversity</span><span className={styles.v}>{sourceCount} source{sourceCount === 1 ? '' : 's'} · {formatScore(features.source_independence ?? 0)}</span></div>
        <div className={styles.row}><span className={styles.k}>Falsifiable</span><span className={styles.v}>{formatScore(features.claim_falsifiability ?? 0)}</span></div>
        <div className={styles.row}><span className={styles.k}>Pressure markers</span><span className={styles.v}>{formatScore(features.rhetorical_red_flags ?? 0)}</span></div>
        <div className={styles.row}><span className={styles.k}>Citations</span><span className={styles.v}>{formatScore(features.citation_chain_closure ?? 0)}</span></div>
        <div className={styles.row}><span className={styles.k}>ACC</span><span className={styles.v}>{formatScore(claim.score)} · {claim.verdict}</span></div>
      </div>
    </div>
  );
}

function AxisCard({
  num,
  title,
  body,
  figure,
}: {
  num: string;
  title: string;
  body: React.ReactNode;
  figure: React.ReactNode;
}) {
  return (
    <article className={styles.axisCard}>
      <div className={styles.secNum}>{num}</div>
      <h3>{title}</h3>
      <div className={styles.axisFig}>{figure}</div>
      <p className={styles.body}>{body}</p>
    </article>
  );
}

function Cnum({ n }: { n: string }) {
  return <span className={styles.cnum}>{n}</span>;
}

function shortId(id: string): string {
  const num = id.match(/\d+/)?.[0];
  return num ? num.padStart(2, '0') : id.slice(0, 4).toUpperCase();
}

/* ── Patent figures (decorative, lifted from bundle) ───────────── */

function EvidenceShapeFig() {
  return (
    <svg viewBox="0 0 360 130" aria-hidden="true">
      <rect x="14" y="50" width="60" height="34" className={`${styles.pln} ${styles.pln2} ${styles.plnFill}`} />
      <text x="44" y="71" textAnchor="middle" className={styles.plnLbl} style={{ fontStyle: 'normal' }}>CLAIM</text>
      <g className={`${styles.pln} ${styles.pln2}`}>
        <line x1="74" y1="67" x2="104" y2="67" />
        <line x1="164" y1="67" x2="194" y2="67" />
        <line x1="254" y1="67" x2="284" y2="67" />
        <rect x="104" y="50" width="60" height="34" className={styles.plnFill} />
        <rect x="194" y="50" width="60" height="34" className={styles.plnFill} />
        <rect x="284" y="50" width="60" height="34" className={styles.plnFill} />
      </g>
      <text x="134" y="71" textAnchor="middle" className={styles.plnLbl} style={{ fontStyle: 'normal' }}>CITE 1</text>
      <text x="224" y="71" textAnchor="middle" className={styles.plnLbl} style={{ fontStyle: 'normal' }}>CITE 2</text>
      <text x="314" y="71" textAnchor="middle" className={styles.plnLbl} style={{ fontStyle: 'normal' }}>PRIMARY</text>
      <g className={`${styles.pln} ${styles.pln3}`}>
        <line x1="44" y1="48" x2="44" y2="32" />
        <line x1="224" y1="48" x2="224" y2="20" />
        <line x1="314" y1="86" x2="314" y2="108" />
      </g>
      <text x="44" y="26" textAnchor="middle" className={styles.plnNum}>30</text>
      <text x="224" y="15" textAnchor="middle" className={styles.plnNum}>32</text>
      <text x="314" y="120" textAnchor="middle" className={styles.plnNum}>34</text>
    </svg>
  );
}

function SourceDiversityFig() {
  return (
    <svg viewBox="0 0 360 130" aria-hidden="true">
      <circle cx="90" cy="65" r="14" className={`${styles.pln} ${styles.pln1} ${styles.plnFill}`} />
      <text x="90" y="68" textAnchor="middle" className={styles.plnLbl} style={{ fontStyle: 'normal', fontSize: '8px' }}>CLAIM</text>
      <g className={`${styles.pln} ${styles.pln2}`}>
        <line x1="104" y1="65" x2="200" y2="20" />
        <line x1="104" y1="65" x2="200" y2="48" />
        <line x1="104" y1="65" x2="200" y2="82" />
        <line x1="104" y1="65" x2="200" y2="110" />
      </g>
      <g className={`${styles.pln} ${styles.pln1} ${styles.plnFill}`}>
        <circle cx="210" cy="20" r="8" />
        <circle cx="210" cy="48" r="8" />
        <circle cx="210" cy="82" r="8" />
        <circle cx="210" cy="110" r="8" />
      </g>
      <g className={styles.plnLbl} style={{ fontStyle: 'normal' }}>
        <text x="226" y="23">PEER REVIEW</text>
        <text x="226" y="51">GOVT FILING</text>
        <text x="226" y="85">NEWS ORG</text>
        <text x="226" y="113">INDEPENDENT BLOG</text>
      </g>
      <g className={`${styles.pln} ${styles.pln3}`}>
        <line x1="90" y1="48" x2="90" y2="20" />
      </g>
      <text x="90" y="14" textAnchor="middle" className={styles.plnNum}>40</text>
      <text x="210" y="14" textAnchor="middle" className={styles.plnNum}>42</text>
    </svg>
  );
}

function FalsifiabilityFig() {
  return (
    <svg viewBox="0 0 360 130" aria-hidden="true">
      <rect x="20" y="50" width="64" height="32" className={`${styles.pln} ${styles.pln2} ${styles.plnFill}`} />
      <text x="52" y="70" textAnchor="middle" className={styles.plnLbl} style={{ fontStyle: 'normal' }}>CLAIM</text>
      <g className={`${styles.pln} ${styles.pln2}`}>
        <line x1="84" y1="66" x2="160" y2="32" />
        <line x1="84" y1="66" x2="160" y2="100" />
        <line x1="160" y1="32" x2="220" y2="32" />
        <line x1="160" y1="100" x2="220" y2="100" />
      </g>
      <g className={`${styles.pln} ${styles.pln2} ${styles.plnFill}`}>
        <path d="M 160 16 L 176 32 L 160 48 L 144 32 Z" />
        <path d="M 160 84 L 176 100 L 160 116 L 144 100 Z" />
      </g>
      <text x="160" y="35" textAnchor="middle" className={styles.plnLbl} style={{ fontStyle: 'normal', fontSize: '7.5px' }}>TEST A</text>
      <text x="160" y="103" textAnchor="middle" className={styles.plnLbl} style={{ fontStyle: 'normal', fontSize: '7.5px' }}>TEST B</text>
      <g className={`${styles.pln} ${styles.pln1}`}>
        <polyline points="226,32 234,40 246,24" fill="none" />
        <line x1="226" y1="92" x2="246" y2="112" />
        <line x1="246" y1="92" x2="226" y2="112" />
      </g>
      <g className={styles.plnLbl} style={{ fontStyle: 'normal' }}>
        <text x="260" y="35">PASSES</text>
        <text x="260" y="105">FAILS</text>
      </g>
      <text x="52" y="42" textAnchor="middle" className={styles.plnNum}>50</text>
      <text x="160" y="68" textAnchor="middle" className={styles.plnNum}>52</text>
    </svg>
  );
}

function RhetoricalPressureFig() {
  return (
    <svg viewBox="0 0 360 130" aria-hidden="true">
      <path d="M 60 100 A 70 70 0 0 1 200 100" className={`${styles.pln} ${styles.pln1}`} />
      <g className={`${styles.pln} ${styles.pln2}`}>
        <line x1="60" y1="100" x2="55" y2="108" />
        <line x1="80" y1="56" x2="74" y2="50" />
        <line x1="130" y1="32" x2="130" y2="24" />
        <line x1="180" y1="56" x2="186" y2="50" />
        <line x1="200" y1="100" x2="205" y2="108" />
      </g>
      <g className={`${styles.pln} ${styles.pln3}`}>
        <line x1="68" y1="78" x2="64" y2="74" />
        <line x1="100" y1="40" x2="98" y2="34" />
        <line x1="160" y1="40" x2="162" y2="34" />
        <line x1="192" y1="78" x2="196" y2="74" />
      </g>
      <line x1="130" y1="100" x2="178" y2="62" className={`${styles.pln} ${styles.pln1}`} stroke="#B8472D" strokeWidth="1.6" />
      <circle cx="130" cy="100" r="4" className={`${styles.pln} ${styles.pln1} ${styles.plnFill}`} />
      <g className={styles.plnLbl} style={{ fontStyle: 'normal' }}>
        <text x="58" y="120" textAnchor="middle">CALM</text>
        <text x="130" y="20" textAnchor="middle">URGENT</text>
        <text x="206" y="120" textAnchor="middle">ALARM</text>
      </g>
      <text x="130" y="115" textAnchor="middle" className={styles.plnNum}>60</text>
      <text x="190" y="58" textAnchor="middle" className={styles.plnNum}>62</text>
      <g transform="translate(240, 28)">
        <text className={styles.plnLbl} style={{ fontStyle: 'normal', fontSize: '8.5px' }} y="0">PRESSURE MARKERS</text>
        <g className={styles.plnLbl} style={{ fontStyle: 'normal', fontSize: '8px' }}>
          <text y="16">· urgency lexicon</text>
          <text y="30">· in-group / out-group</text>
          <text y="44">· they-know framing</text>
          <text y="58">· emotional escalation</text>
          <text y="72">· loaded modifiers</text>
        </g>
      </g>
    </svg>
  );
}

function OutcomeLoopFig() {
  return (
    <svg viewBox="0 0 420 220" aria-hidden="true">
      <g className={`${styles.pln} ${styles.pln2} ${styles.plnFill}`}>
        <rect x="14" y="60" width="76" height="40" />
        <rect x="106" y="60" width="76" height="40" />
        <rect x="198" y="60" width="76" height="40" />
        <rect x="290" y="60" width="76" height="40" />
      </g>
      <g className={styles.plnLbl} style={{ fontStyle: 'normal', fontSize: '8.5px' }}>
        <text x="52" y="76" textAnchor="middle">ACC</text>
        <text x="52" y="90" textAnchor="middle">DECISION</text>
        <text x="144" y="76" textAnchor="middle">OUTCOME</text>
        <text x="144" y="90" textAnchor="middle">LEDGER</text>
        <text x="236" y="76" textAnchor="middle">SHADOW</text>
        <text x="236" y="90" textAnchor="middle">EVALUATOR</text>
        <text x="328" y="76" textAnchor="middle">PROMOTION</text>
        <text x="328" y="90" textAnchor="middle">GATE</text>
      </g>
      <g className={`${styles.pln} ${styles.pln2}`}>
        <path d="M 90 80 L 106 80" />
        <path d="M 102 76 L 106 80 L 102 84" />
        <path d="M 182 80 L 198 80" />
        <path d="M 194 76 L 198 80 L 194 84" />
        <path d="M 274 80 L 290 80" />
        <path d="M 286 76 L 290 80 L 286 84" />
        <path d="M 366 80 L 392 80 L 392 160 L 52 160 L 52 100" fill="none" />
        <path d="M 48 104 L 52 100 L 56 104" />
      </g>
      <text x="360" y="36" textAnchor="middle" className={styles.plnLbl} style={{ fontStyle: 'normal', fontSize: '8.5px' }}>ACC vNext (proposed)</text>
      <line x1="328" y1="40" x2="328" y2="58" className={`${styles.pln} ${styles.pln3}`} />
      <text x="52" y="122" textAnchor="middle" className={styles.plnNum}>30</text>
      <text x="144" y="122" textAnchor="middle" className={styles.plnNum}>32</text>
      <text x="236" y="122" textAnchor="middle" className={styles.plnNum}>34</text>
      <text x="328" y="122" textAnchor="middle" className={styles.plnNum}>36</text>
      <text x="220" y="178" textAnchor="middle" className={styles.plnNum}>38</text>
      <text x="210" y="208" textAnchor="middle" className={styles.plnLbl}>Fig. 02 — evolutionary calibration wrap; core algorithm unchanged.</text>
    </svg>
  );
}

/* ── Spec row helpers ─────────────────────────────────────────── */

function extractorLabel(state: RunnerState, usedModel: boolean | null): string {
  if (state === 'ready') return usedModel === false ? 'Gemma 4B (idle) · heuristic fallback' : 'Gemma 4B · sentence-level';
  if (state === 'loading') return 'Loading Gemma 4B…';
  if (state === 'unavailable') return 'Heuristic (no WebGPU)';
  if (state === 'error') return 'Heuristic (load failed)';
  return 'Heuristic · sentence-level';
}

function modelRowLabel(
  state: RunnerState,
  progress: LoadProgress,
  onLoad: () => void,
): React.ReactNode {
  if (state === 'ready') return 'Gemma 4B · loaded';
  if (state === 'loading') return `Loading · ${Math.max(0, progress.percent || 0)}%`;
  if (state === 'unavailable') return 'WebGPU unavailable';
  if (state === 'error') {
    return (
      <span>
        Load failed · <button type="button" onClick={onLoad} style={{ textDecoration: 'underline' }}>retry</button>
      </span>
    );
  }
  return (
    <span>
      Gemma 4B · <button type="button" onClick={onLoad} style={{ textDecoration: 'underline' }}>load</button>
    </span>
  );
}
