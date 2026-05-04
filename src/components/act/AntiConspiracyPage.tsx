'use client';

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
import {
  analyzeDocument,
  analyzeDocumentAsync,
  formatScore,
  normalizeWhitespace,
  urlSafeLabel,
  MLCRunner,
  FEATURE_LABELS,
  VERDICT_LABEL,
  MAX_TEXT_LENGTH,
  MAX_FILE_BYTES,
  type AnalysisResult,
  type LoadProgress,
  type RunnerState,
  type ScoredClaim,
  type Verdict,
} from '@/lib/act';

const REPO_URL = 'https://github.com/Travis-Gilbert/anti-conspirarcy-theorem';
const EXTENSION_URL =
  'https://github.com/Travis-Gilbert/anti-conspirarcy-theorem/actions/workflows/browser-extension.yml';
const MODEL_URL = '/act/model.json';

type LabStatus = 'idle' | 'reading' | 'scoring' | 'ready' | 'error';

const VERDICT_FILL: Record<Verdict, string> = {
  trustworthy: 'var(--color-teal)',
  mixed: 'var(--color-gold)',
  unreliable: 'var(--color-error)',
  fiction: 'var(--color-ink-muted)',
};

const FEATURE_DISPLAY_ORDER = [
  'claim_specificity',
  'root_depth',
  'source_independence',
  'evidence_volume',
  'external_support_ratio',
  'temporal_spread',
  'consensus_alignment',
  'source_tier',
  'rhetorical_red_flags',
  'citation_chain_closure',
  'claim_falsifiability',
] as const;

export default function AntiConspiracyPage() {
  const [urlValue, setUrlValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [status, setStatus] = useState<LabStatus>('idle');
  const [message, setMessage] = useState('Drop a document, paste text, or analyze a URL.');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activeClaim, setActiveClaim] = useState<ScoredClaim | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [modelState, setModelState] = useState<RunnerState>('uninitialized');
  const [modelProgress, setModelProgress] = useState<LoadProgress>({
    percent: 0,
    mbLoaded: 0,
    mbTotal: 0,
    stage: 'idle',
  });
  const [usedModel, setUsedModel] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Counts dragenter/dragleave imbalance so the active state doesn't
  // flicker every time the cursor crosses a child of the dropzone.
  const dragCounter = useRef(0);

  // Prevent the browser from navigating away (default behavior) when a
  // file is dropped anywhere outside the dropzone. Without these window
  // listeners, a dragenter on the page body cancels the drag-into-target
  // sequence and Chrome opens the file as a new page on drop.
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
          ? 'Asking Gemma 4B to extract the claim inventory…'
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
        `Scored ${result.claims.length} claims from ${result.source_label} (ACC ${formatScore(result.overall_score)} · ${VERDICT_LABEL[result.verdict]}) — ${
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

  const handleUrlSubmit = async (event?: FormEvent) => {
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
        setMessage(typeof payload?.error === 'string' ? payload.error : 'The URL could not be analyzed.');
        return;
      }
      const title =
        typeof payload?.title === 'string' && payload.title ? payload.title : urlSafeLabel(target);
      void runTextAnalysis(String(payload.text ?? ''), title, 'url');
    } catch {
      setStatus('error');
      setMessage('Network error while fetching the URL.');
    }
  };

  const handlePasteSubmit = () => {
    const trimmed = textValue.trim();
    if (!trimmed) {
      setStatus('error');
      setMessage('Paste some prose before running the lab.');
      return;
    }
    void runTextAnalysis(trimmed, 'Pasted text', 'text');
  };

  const handleFile = async (file: File) => {
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
  };

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
    if (urlValue.trim()) {
      void handleUrlSubmit();
    } else if (textValue.trim()) {
      handlePasteSubmit();
    } else {
      setStatus('error');
      setMessage('Drop a file, paste text, or paste a URL first.');
    }
  };

  const stats = useMemo(() => {
    if (!analysis) {
      return {
        avg: '— · No run',
        trustworthy: 0,
        mixed: 0,
        unreliable: 0,
        hasRun: false,
      };
    }
    return {
      avg: formatScore(analysis.overall_score),
      trustworthy: analysis.trustworthy_count,
      mixed: analysis.mixed_count,
      unreliable: analysis.unreliable_count,
      hasRun: true,
    };
  }, [analysis]);

  const graphLayout = useMemo(() => buildGraphLayout(analysis), [analysis]);
  const pillLabel = pillCopy(status, analysis);
  const pillClass = pillClassFor(status);

  return (
    <div className={styles.root}>
      <div className={styles.topbar}>
        <div className={styles.crumbs}>
          <Link href="/">travisgilbert.me</Link>
          <span className={styles.sep}>/</span>
          <Link href="/projects">projects</Link>
          <span className={styles.sep}>/</span>
          <span className={styles.here}>act</span>
        </div>
        <div className={styles.topbarRight}>
          <span>
            <span className={styles.led} aria-hidden="true" />
            v0.4 · field beta
          </span>
        </div>
      </div>

      <div className={styles.page}>
        <header className={styles.masthead}>
          <div>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowFig}>FIG. 04</span>
              <span>Project · Anti-Conspiracy Lab</span>
            </div>
            <h1 className={styles.title}>Anti-Conspiracy Theorem</h1>
            <p className={styles.lede}>
              A working public lab for inspecting claims by evidence shape, source diversity,
              falsifiability, and rhetorical pressure. Drop a URL or document; the lab scores it
              and lays the reasoning bare.
            </p>
            <div className={styles.builtOn}>
              <span className={styles.builtOnSeal} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <circle cx="12" cy="12" r="9" />
                  <ellipse cx="12" cy="12" rx="9" ry="3.6" />
                  <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
                  <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-60 12 12)" />
                  <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
                  <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
                  <circle cx="21" cy="12" r="1" fill="currentColor" stroke="none" />
                  <circle cx="7.5" cy="4.2" r="0.8" fill="currentColor" stroke="none" />
                  <circle cx="16.5" cy="19.8" r="0.8" fill="currentColor" stroke="none" />
                </svg>
              </span>
              Built on <strong className={styles.builtOnName}>Theorem</strong>
            </div>
            <div className={styles.ctaRow}>
              <a className={`${styles.btn} ${styles.btnPrimary}`} href="#analyze">
                <span className={styles.btnGlyph}>▸</span> Run analysis
              </a>
              <a
                className={styles.btn}
                href={EXTENSION_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.btnGlyph}>↓</span> Extension
              </a>
              <a className={styles.btn} href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <span className={styles.btnGlyph}>⌥</span> GitHub
              </a>
              <a className={styles.btn} href={MODEL_URL}>
                <span className={styles.btnGlyph}>≡</span> Model card
              </a>
            </div>
          </div>

          <aside className={styles.spec}>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Status</span>
              <span className={styles.specVal}>Live</span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Algorithm</span>
              <span className={styles.specVal}>
                ACC v{analysis?.algorithm_version ?? '2.0.0'}
              </span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Extractor</span>
              <span className={styles.specVal}>{extractorLabel(modelState, usedModel)}</span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Inputs</span>
              <span className={styles.specVal}>URL · TXT · MD · HTML</span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Method</span>
              <span className={styles.specVal}>11-axis claim scoring</span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>License</span>
              <span className={styles.specVal}>MIT · weights open</span>
            </div>
            <ModelLoaderRow
              state={modelState}
              progress={modelProgress}
              onLoad={handleLoadModel}
            />
          </aside>
        </header>

        <div className={styles.workbench} id="analyze">
          <section className={`${styles.panel} ${styles.analyzerStage}`}>
            <div className={styles.panelHead}>
              <h3>Analyze a claim</h3>
              <span className={`${styles.pill} ${pillClass}`}>{pillLabel}</span>
            </div>

            <div
              className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDrop={onDrop}
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              role="button"
              tabIndex={0}
              aria-label="Drop a document to inspect"
            >
              <span className={styles.dropGlyph} aria-hidden="true">⇣</span>
              <div className={styles.dropLabel}>Drop a document to inspect</div>
              <div className={styles.dropSub}>TXT · Markdown · readable HTML · up to 1 MB</div>
              <div className={styles.orPaste}>
                or <a href="#paste" onClick={(e) => e.stopPropagation()}>paste text below</a>
                {' '}·{' '}
                <a href="#url" onClick={(e) => e.stopPropagation()}>analyze a URL</a>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.html,.htm,text/plain,text/markdown,text/html"
                onChange={onFileChange}
                style={{ display: 'none' }}
              />
            </div>

            <div className={styles.orDivider} id="url">
              or analyze a URL
            </div>

            <form className={styles.field} onSubmit={handleUrlSubmit}>
              <div className={styles.urlRow}>
                <input
                  type="text"
                  placeholder="https://example.com/article-to-inspect"
                  aria-label="URL to analyze"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                />
                <button className={styles.iconBtn} type="submit" title="Fetch" aria-label="Fetch URL">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </button>
              </div>
            </form>

            <div className={styles.orDivider} id="paste">
              or paste text
            </div>

            <div className={styles.field}>
              <textarea
                placeholder="Paste any block of prose here. The lab will extract claims, score evidence, and surface where the argument leans on rhetoric instead of fact."
                aria-label="Paste text to analyze"
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
              />
            </div>

            <div className={styles.panelFoot}>
              <div className={styles.panelFootHint}>{message}</div>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                type="button"
                onClick={onRunAnalysis}
                disabled={status === 'reading' || status === 'scoring'}
              >
                <span className={styles.btnGlyph}>▸</span>
                {status === 'reading' ? 'Reading…' : status === 'scoring' ? 'Scoring…' : 'Run analysis'}
              </button>
            </div>
          </section>

          <div className={styles.belowGrid}>
            <section className={`${styles.panel} ${styles.graphPanel}`}>
              <div className={`${styles.panelHead} ${styles.panelHeadGraph}`}>
                <h3>GRAPH BUILDER</h3>
                <span className={styles.pill}>
                  {analysis ? `${analysis.claims.length} claims` : 'No document loaded'}
                </span>
              </div>

              <div className={styles.graphCanvas}>
                {analysis ? (
                  <ClaimGraph
                    layout={graphLayout}
                    activeId={activeClaim?.id ?? null}
                    onSelect={(claim) => setActiveClaim(claim)}
                  />
                ) : (
                  <div className={styles.graphEmpty}>
                    <div className={styles.iconFrame}>
                      <div className={styles.iconLines}>
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                    <h4>Load a document to build the graph.</h4>
                    <p>
                      Claims, evidence traits, and penalties will appear as nodes after the lab
                      scores real text.
                    </p>
                  </div>
                )}
              </div>

              <div className={styles.graphFoot}>
                <div className={styles.legend}>
                  <span>
                    <span
                      className={styles.legendSwatch}
                      style={{ background: 'var(--color-teal)' }}
                    />
                    Trustworthy
                  </span>
                  <span>
                    <span
                      className={styles.legendSwatch}
                      style={{ background: 'var(--color-gold)' }}
                    />
                    Mixed
                  </span>
                  <span>
                    <span
                      className={styles.legendSwatch}
                      style={{ background: 'var(--color-error)' }}
                    />
                    Unreliable
                  </span>
                </div>
                <div>{analysis ? 'Click a claim to inspect' : 'Zoom · ⌘ + scroll'}</div>
              </div>
            </section>

            <aside className={`${styles.panel} ${styles.tracePanel}`}>
              <div className={`${styles.panelHead} ${styles.panelHeadTrace}`}>
                <h3>Trace Detail</h3>
                {activeClaim ? <VerdictBadge verdict={activeClaim.verdict} /> : null}
              </div>

              {activeClaim ? (
                <ClaimDetail claim={activeClaim} />
              ) : (
                <>
                  <p className={styles.traceEmpty}>
                    The graph is empty until a URL, document, or pasted text is analyzed. Once a
                    run completes, every node here links to the sentence it came from.
                  </p>

                  <div className={styles.traceStep}>What you&apos;ll see</div>
                  <ul className={styles.checklist}>
                    <li>Sentence the claim was lifted from</li>
                    <li>Evidence shape : citation, anecdote, none</li>
                    <li>Source diversity score per claim</li>
                    <li>Falsifiability hooks the author offered</li>
                    <li>Rhetorical pressure markers, weighted</li>
                  </ul>

                  <div className={styles.traceStep}>After a run</div>
                  <ul className={styles.checklist}>
                    <li>Per-claim ACC score with linear + geometric breakdown</li>
                    <li>Six symbolic rules: passed or penalty</li>
                    <li>Suggested next moves drawn from the rule violations</li>
                  </ul>
                </>
              )}
            </aside>
          </div>
        </div>

        <div className={styles.stats}>
          <div className={`${styles.stat} ${stats.hasRun ? '' : styles.statEmpty}`}>
            <div className={styles.statTrend}>Σ</div>
            <div className={styles.statLabel}>Average ACC</div>
            <div className={styles.statVal}>{stats.avg}</div>
          </div>
          <div className={`${styles.stat} ${styles.statStrong}`}>
            <div className={styles.statTrend}>↑</div>
            <div className={styles.statLabel}>Trustworthy</div>
            <div className={styles.statVal}>{stats.trustworthy}</div>
          </div>
          <div className={`${styles.stat} ${styles.statMixed}`}>
            <div className={styles.statTrend}>~</div>
            <div className={styles.statLabel}>Mixed</div>
            <div className={styles.statVal}>{stats.mixed}</div>
          </div>
          <div className={`${styles.stat} ${styles.statSuspect}`}>
            <div className={styles.statTrend}>!</div>
            <div className={styles.statLabel}>Unreliable</div>
            <div className={styles.statVal}>{stats.unreliable}</div>
          </div>
        </div>

        <div className={styles.sectionHead}>
          <span className={styles.sectionHeadNum}>§ 02</span>
          <h2>How Information is Scored</h2>
          <span className={styles.sectionHeadStatus}>
            <span className={styles.statusDot} aria-hidden="true" />
            11 axes
          </span>
        </div>

        <div className={styles.method}>
          <div className={styles.step}>
            <div className={styles.stepNum}>01 · EVIDENCE SHAPE</div>
            <h4>What&apos;s holding it up?</h4>
            <p>
              Each claim is matched against citations, links, and anecdote. A claim with a single
              anecdote loses points; one with three independent sources gains them.
            </p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNum}>02 · SOURCE DIVERSITY</div>
            <h4>Who else says so?</h4>
            <p>
              The lab walks outbound links and counts independent domains, authors, and
              publication dates. Identical-author chains get flagged as one voice.
            </p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNum}>03 · FALSIFIABILITY</div>
            <h4>Could it be wrong?</h4>
            <p>
              Claims that volunteer &ldquo;this would change my mind if&hellip;&rdquo; hooks score
              higher than untestable ones. Pure value claims are noted but not scored.
            </p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNum}>04 · RHETORICAL PRESSURE</div>
            <h4>Tone vs. substance</h4>
            <p>
              Loaded language, urgency, in-group cues, and identity threats are weighed against
              the substance underneath. High pressure plus thin evidence triggers penalties.
            </p>
          </div>
        </div>

        <footer className={styles.colophon}>
          <span>
            <span className={styles.colophonName}>TRAVIS GILBERT</span> · Anti-Conspiracy Theorem
            · v0.4.2
          </span>
          <span>
            Built on <strong className={styles.colophonName}>Theorem</strong>
          </span>
          <span>Fig. 04 · Apr 2026</span>
        </footer>
      </div>
    </div>
  );
}

interface GraphPositioned {
  claim: ScoredClaim;
  x: number;
  y: number;
}

function buildGraphLayout(analysis: AnalysisResult | null): GraphPositioned[] {
  if (!analysis) return [];
  const radiusX = 200;
  const radiusY = 130;
  return analysis.claims.map((claim, index) => {
    const total = analysis.claims.length;
    const angle = (index / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;
    return {
      claim,
      x: Math.cos(angle) * radiusX,
      y: Math.sin(angle) * radiusY,
    };
  });
}

function ClaimGraph({
  layout,
  activeId,
  onSelect,
}: {
  layout: GraphPositioned[];
  activeId: string | null;
  onSelect: (claim: ScoredClaim) => void;
}) {
  const viewWidth = 600;
  const viewHeight = 360;
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;
  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      role="img"
      aria-label="Claim graph: document at center, claims arranged around it"
    >
      {layout.map(({ claim, x, y }) => {
        const tx = cx + x;
        const ty = cy + y;
        const stroke = VERDICT_FILL[claim.verdict];
        return (
          <line
            key={`edge-${claim.id}`}
            x1={cx}
            y1={cy}
            x2={tx}
            y2={ty}
            stroke={stroke}
            strokeOpacity={0.32}
            strokeWidth={1 + claim.score * 1.6}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={18} fill="var(--color-ink)" stroke="var(--color-paper)" strokeWidth={2} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fontFamily="var(--font-code)" fill="var(--color-paper)">
        DOC
      </text>
      {layout.map(({ claim, x, y }) => {
        const tx = cx + x;
        const ty = cy + y;
        const isActive = claim.id === activeId;
        const r = 10 + claim.score * 8;
        return (
          <g
            key={claim.id}
            onClick={() => onSelect(claim)}
            style={{ cursor: 'pointer' }}
            tabIndex={0}
            role="button"
            aria-label={`${VERDICT_LABEL[claim.verdict]} claim: ${claim.text.slice(0, 80)}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(claim);
              }
            }}
          >
            <circle
              cx={tx}
              cy={ty}
              r={r}
              fill={VERDICT_FILL[claim.verdict]}
              stroke={isActive ? 'var(--color-ink)' : 'var(--color-paper)'}
              strokeWidth={isActive ? 2.5 : 1.5}
              opacity={0.92}
            />
            <text
              x={tx}
              y={ty + 4}
              textAnchor="middle"
              fontSize={10}
              fontFamily="var(--font-code)"
              fill="var(--color-paper)"
              pointerEvents="none"
            >
              {formatScore(claim.score)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ClaimDetail({ claim }: { claim: ScoredClaim }) {
  const featureBars = FEATURE_DISPLAY_ORDER.filter(
    (key) => claim.feature_breakdown[key] != null,
  );

  return (
    <div>
      <p className={styles.claimText}>&ldquo;{claim.text}&rdquo;</p>
      <div className={styles.claimMeta}>
        <span>ACC {formatScore(claim.score)}</span>
        <span>·</span>
        <span>L {formatScore(claim.linear_score)}</span>
        <span>·</span>
        <span>G {formatScore(claim.geometric_core)}</span>
        {claim.penalty_total > 0 ? (
          <>
            <span>·</span>
            <span style={{ color: 'var(--color-error)' }}>
              − {formatScore(claim.penalty_total)}
            </span>
          </>
        ) : null}
      </div>

      <p className={styles.claimRationale}>{claim.rationale}</p>

      <div className={styles.traceStep}>Feature trace</div>
      <ul className={styles.featureList}>
        {featureBars.map((key) => {
          const value = claim.feature_breakdown[key] ?? 0;
          return (
            <li key={key} className={styles.featureRow}>
              <span className={styles.featureLabel}>
                {FEATURE_LABELS[key] ?? key}
              </span>
              <span className={styles.featureBarTrack} aria-hidden="true">
                <span
                  className={styles.featureBarFill}
                  style={{
                    width: `${Math.round(value * 100)}%`,
                    background:
                      key === 'rhetorical_red_flags' && value < 0.5
                        ? 'var(--color-error)'
                        : VERDICT_FILL[claim.verdict],
                  }}
                />
              </span>
              <span className={styles.featureValue}>{formatScore(value)}</span>
            </li>
          );
        })}
      </ul>

      <div className={styles.traceStep}>Symbolic rules</div>
      <ul className={styles.ruleList}>
        {claim.rules.map((rule) => (
          <li
            key={rule.id}
            className={`${styles.ruleRow} ${rule.passed ? styles.rulePass : styles.ruleFail}`}
          >
            <span className={styles.ruleMark} aria-hidden="true">
              {rule.passed ? '✓' : '✕'}
            </span>
            <span className={styles.ruleBody}>
              <span className={styles.ruleId}>{rule.id.replace(/_/g, ' ')}</span>
              <span className={styles.ruleReason}>{rule.reason}</span>
            </span>
          </li>
        ))}
      </ul>

      {claim.penalties.length > 0 ? (
        <>
          <div className={styles.traceStep}>Penalties applied</div>
          <ul className={styles.checklist}>
            {claim.penalties.map((p) => (
              <li key={p.id}>
                <strong>{p.id.replace(/_/g, ' ')}</strong>
                {' — '}
                {p.reason}
                <span className={styles.penaltyWeight}>
                  {' '}(−{formatScore(p.weight)})
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {claim.actions.length > 0 ? (
        <>
          <div className={styles.traceStep}>Next moves</div>
          <ul className={styles.checklist}>
            {claim.actions.map((a) => (
              <li key={a.id}>{a.guidance}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={styles.pill}
      style={{
        color: VERDICT_FILL[verdict],
        borderColor: VERDICT_FILL[verdict],
      }}
    >
      ● {VERDICT_LABEL[verdict]}
    </span>
  );
}

function pillCopy(status: LabStatus, analysis: AnalysisResult | null): string {
  if (status === 'reading') return '● Reading…';
  if (status === 'scoring') return '● Scoring…';
  if (status === 'error') return '● Error';
  if (status === 'ready' && analysis) return `● ${analysis.claims.length} scored`;
  return '● Ready';
}

function pillClassFor(status: LabStatus): string {
  if (status === 'error') return styles.pillError;
  if (status === 'reading' || status === 'scoring') return styles.pillBusy;
  return styles.pillReady;
}

function extractorLabel(state: RunnerState, usedModel: boolean | null): string {
  if (state === 'ready') return usedModel === false ? 'Gemma 4B (idle)' : 'Gemma 4B';
  if (state === 'loading') return 'Loading Gemma 4B…';
  if (state === 'unavailable') return 'Heuristic (no WebGPU)';
  if (state === 'error') return 'Heuristic (load failed)';
  return 'Heuristic';
}

function ModelLoaderRow({
  state,
  progress,
  onLoad,
}: {
  state: RunnerState;
  progress: LoadProgress;
  onLoad: () => void;
}) {
  if (state === 'ready') {
    return (
      <div className={styles.specRow}>
        <span className={styles.specKey}>Model</span>
        <span className={styles.specVal}>● Loaded · gemma-4-e4b</span>
      </div>
    );
  }
  if (state === 'loading') {
    return (
      <div className={styles.specRow}>
        <span className={styles.specKey}>Model</span>
        <span className={styles.specVal}>
          <span className={styles.modelProgressTrack} aria-hidden="true">
            <span
              className={styles.modelProgressFill}
              style={{ width: `${Math.max(2, progress.percent)}%` }}
            />
          </span>
          <span className={styles.modelProgressText}>
            {progress.percent || 0}% {progress.mbTotal ? `(${progress.mbLoaded.toFixed(0)}/${progress.mbTotal.toFixed(0)} MB)` : ''}
          </span>
        </span>
      </div>
    );
  }
  if (state === 'unavailable') {
    return (
      <div className={styles.specRow}>
        <span className={styles.specKey}>Model</span>
        <span className={styles.specVal} title={progress.stage}>
          WebGPU unavailable
        </span>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className={styles.specRow}>
        <span className={styles.specKey}>Model</span>
        <span className={styles.specVal} title={progress.stage}>
          Load failed
          <button className={styles.modelLoadBtn} type="button" onClick={onLoad}>
            Retry
          </button>
        </span>
      </div>
    );
  }
  return (
    <div className={styles.specRow}>
      <span className={styles.specKey}>Model</span>
      <span className={styles.specVal}>
        <button className={styles.modelLoadBtn} type="button" onClick={onLoad}>
          Load Gemma 4B
        </button>
      </span>
    </div>
  );
}
