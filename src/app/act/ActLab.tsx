'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { Graph, PointShape, type GraphConfig } from '@cosmos.gl/graph';
import {
  ArrowRight,
  CheckCircle,
  Download,
  Github,
  GraphUp,
  Internet,
  Link as LinkIcon,
  Page,
  Play,
  Refresh,
  ShieldCheck,
  Upload,
} from 'iconoir-react';

const repoUrl = 'https://github.com/Travis-Gilbert/anti-conspirarcy-theorem';
const modelDescriptor = '/act/model.json';
const extensionZip =
  'https://github.com/Travis-Gilbert/anti-conspirarcy-theorem/actions/workflows/browser-extension.yml';
const installCommand = 'npx act-theorem install --out ./anti-conspirarcy-theorem-extension';
const MAX_TEXT_LENGTH = 30000;
const MAX_FILE_BYTES = 1_000_000;

type Verdict = 'strong' | 'mixed' | 'suspect';
type LabStatus = 'idle' | 'reading' | 'scoring' | 'ready' | 'error';

interface ClaimTrace {
  id: string;
  text: string;
  verdict: Verdict;
  score: number;
  features: {
    evidenceVolume: number;
    sourceIndependence: number;
    supportRatio: number;
    specificity: number;
    temporalSpread: number;
    rhetoricalPressure: number;
  };
  reasons: string[];
  actions: string[];
}

interface AnalysisResult {
  title: string;
  sourceLabel: string;
  sourceType: 'url' | 'document' | 'text';
  wordCount: number;
  claimCount: number;
  suspectCount: number;
  mixedCount: number;
  strongCount: number;
  averageScore: number;
  claims: ClaimTrace[];
}

interface ActNode {
  id: string;
  label: string;
  kind: 'document' | 'claim' | 'feature';
  verdict?: Verdict;
  score?: number;
  detail: string;
}

interface ActLink {
  source: string;
  target: string;
  strength: number;
}

const featureLabels = {
  evidenceVolume: 'Evidence volume',
  sourceIndependence: 'Source independence',
  supportRatio: 'Support ratio',
  specificity: 'Specificity',
  temporalSpread: 'Temporal spread',
  rhetoricalPressure: 'Rhetorical pressure',
} as const;

const verdictCopy = {
  strong: 'Strong',
  mixed: 'Mixed',
  suspect: 'Suspect',
} as const;

const verdictColors = {
  strong: [0.18, 0.5, 0.56, 1],
  mixed: [0.77, 0.6, 0.29, 1],
  suspect: [0.71, 0.22, 0.16, 1],
} as const;

const featureKeys = Object.keys(featureLabels) as Array<keyof ClaimTrace['features']>;

export default function ActLab() {
  const [urlValue, setUrlValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [status, setStatus] = useState<LabStatus>('idle');
  const [message, setMessage] = useState('Drop a document, paste text, or analyze a URL.');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activeNode, setActiveNode] = useState<ActNode | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const graphData = useMemo(() => buildGraphData(analysis), [analysis]);
  const primaryClaim = analysis?.claims[0] ?? null;
  const handleNodeFocus = useCallback((node: ActNode | null) => {
    setActiveNode(node);
  }, []);

  const runTextAnalysis = useCallback((text: string, title: string, sourceType: AnalysisResult['sourceType']) => {
    const cleanText = normalizeWhitespace(text).slice(0, MAX_TEXT_LENGTH);
    if (cleanText.split(/\s+/).filter(Boolean).length < 12) {
      setStatus('error');
      setMessage('Give the lab a little more text so the trace has something real to inspect.');
      return;
    }

    setStatus('scoring');
    setMessage('Scoring claims and building the graph.');
    const result = analyzeText(cleanText, title, sourceType);
    setAnalysis(result);
    setActiveNode(null);
    setStatus('ready');
    setMessage(`Scored ${result.claimCount} claims from ${result.sourceLabel}.`);
  }, []);

  const handleUrlSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetUrl = urlValue.trim();
    if (!targetUrl) {
      setStatus('error');
      setMessage('Paste a URL before running the lab.');
      return;
    }

    setStatus('reading');
    setMessage('Fetching readable text from the URL.');
    try {
      const response = await fetch('/api/act/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'The URL could not be read.');
      }
      runTextAnalysis(payload.text, payload.title || targetUrl, 'url');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'The URL could not be read.');
    }
  };

  const handleTextSubmit = () => {
    runTextAnalysis(textValue, 'Pasted document', 'text');
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setStatus('error');
      setMessage('Use a text file under 1 MB for this public lab.');
      return;
    }
    setStatus('reading');
    setMessage(`Reading ${file.name}.`);
    try {
      const text = await file.text();
      runTextAnalysis(text, file.name, 'document');
    } catch {
      setStatus('error');
      setMessage('That file could not be read as text.');
    }
  };

  const handleDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      await handleFile(file);
    }
  };

  return (
    <main
      className="act-page"
      style={{
        marginLeft: 'calc(-50vw + 50%)',
        marginRight: 'calc(-50vw + 50%)',
        marginTop: '-32px',
        marginBottom: '-32px',
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, var(--color-readme-bg) 0%, #24211d 62%, var(--color-paper) 62%, var(--color-paper) 100%)',
        color: 'var(--color-readme-text)',
      }}
    >
      <section className="grid min-h-screen gap-5 px-4 pb-8 pt-6 sm:px-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:px-8">
        <div className="flex min-h-0 flex-col gap-4">
          <header className="rounded-md border border-white/10 bg-black/15 p-5">
            <h1
              className="font-title text-[40px] font-bold leading-[0.95] sm:text-[50px]"
              style={{ color: 'var(--color-readme-text)' }}
            >
              Anti-Conspiracy Theorem
            </h1>
            <p className="mt-4 font-body text-[15px] leading-relaxed text-cream/68">
              A working public lab for inspecting claims by evidence shape, source diversity,
              falsifiability, and rhetorical pressure.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <a className="act-link-primary" href={extensionZip}>
                <Download width={16} height={16} strokeWidth={2.2} />
                Extension
              </a>
              <a className="act-link-secondary" href={repoUrl}>
                <Github width={16} height={16} strokeWidth={2.2} />
                GitHub
              </a>
              <a className="act-link-secondary" href={modelDescriptor}>
                <GraphUp width={16} height={16} strokeWidth={2.2} />
                Model
              </a>
              <a className="act-link-secondary" href="#install">
                <ArrowRight width={16} height={16} strokeWidth={2.2} />
                Install
              </a>
            </div>
          </header>

          <section className="rounded-md border border-white/10 bg-black/18 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2
                className="font-code text-[12px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: 'var(--color-gold)' }}
              >
                Analyze
              </h2>
              <StatusPill status={status} />
            </div>

            <form onSubmit={handleUrlSubmit} className="grid gap-2">
              <label className="act-label" htmlFor="act-url">
                Paste a URL
              </label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  id="act-url"
                  value={urlValue}
                  onChange={(event) => setUrlValue(event.target.value)}
                  type="url"
                  inputMode="url"
                  className="act-input"
                  aria-label="URL to analyze"
                />
                <button className="act-icon-button" type="submit" aria-label="Analyze URL">
                  <LinkIcon width={18} height={18} strokeWidth={2.2} />
                </button>
              </div>
            </form>

            <label
              className={`mt-3 flex min-h-[104px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-4 text-center transition ${
                isDragging ? 'border-terracotta bg-terracotta/10' : 'border-white/18 bg-white/[0.04]'
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload aria-hidden width={24} height={24} strokeWidth={1.9} className="text-teal-light" />
              <span className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-cream">
                Drop a document
              </span>
              <span className="mt-1 font-body text-[13px] text-cream/55">TXT, Markdown, or readable HTML</span>
              <input
                className="sr-only"
                type="file"
                accept=".txt,.md,.markdown,.html,.htm,text/plain,text/markdown,text/html"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  event.currentTarget.value = '';
                }}
              />
            </label>

            <div className="mt-3 grid gap-2">
              <label className="act-label" htmlFor="act-text">
                Or paste text
              </label>
              <textarea
                id="act-text"
                value={textValue}
                onChange={(event) => setTextValue(event.target.value)}
                className="act-textarea"
                rows={5}
                aria-label="Text to analyze"
              />
              <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <p className="m-0 font-body text-[13px] leading-snug text-cream/58">{message}</p>
                <button className="act-run-button" type="button" onClick={handleTextSubmit}>
                  <Play width={17} height={17} strokeWidth={2.2} />
                  Run
                </button>
              </div>
            </div>
          </section>
        </div>

        <section className="grid min-h-[620px] gap-4 lg:grid-rows-[1fr_auto]">
          <div className="relative min-h-[520px] overflow-hidden rounded-md border border-white/12 bg-[#151515]">
            <ActCosmosGraph
              nodes={graphData.nodes}
              links={graphData.links}
              onNodeFocus={handleNodeFocus}
            />
            <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-sm">
              <p className="m-0 font-code text-[11px] font-semibold uppercase tracking-[0.1em] text-cream">
                CosmosGL claim graph
              </p>
              <p className="m-0 mt-1 font-body text-[12px] text-cream/55">
                {analysis ? `${analysis.claimCount} claims, ${analysis.suspectCount} suspect` : 'No document loaded'}
              </p>
            </div>
            <NodeInspector analysis={analysis} node={activeNode} primaryClaim={primaryClaim} />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Average ACC" value={analysis ? formatScore(analysis.averageScore) : 'No run'} />
            <MetricCard label="Strong" value={analysis ? String(analysis.strongCount) : '0'} tone="strong" />
            <MetricCard label="Mixed" value={analysis ? String(analysis.mixedCount) : '0'} tone="mixed" />
            <MetricCard label="Suspect" value={analysis ? String(analysis.suspectCount) : '0'} tone="suspect" />
          </div>
        </section>
      </section>

      <section id="install" className="border-t border-border-light bg-paper px-4 py-12 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="font-title text-[32px] font-bold leading-tight text-ink">
              Install the reader, then inspect the trace.
            </h2>
            <p className="mt-3 max-w-[560px] font-body text-[15px] leading-relaxed text-ink-secondary">
              The public lab runs a deterministic browser scorer. The extension uses the same ACC
              shape and can prepare the local WebLLM model through the owned `/act` route.
            </p>
          </div>
          <div className="grid gap-4">
            <div className="rounded-md border border-border bg-surface p-4 shadow-warm">
              <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-teal">
                NPM install command
              </p>
              <code className="block overflow-x-auto whitespace-nowrap rounded bg-code px-3 py-3 font-code text-[12px] text-ink">
                {installCommand}
              </code>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FactTile icon={ShieldCheck} title="Local first" body="Dropped documents are scored in the browser." />
              <FactTile icon={Internet} title="URL mode" body="The server reads the URL, then returns extracted text." />
              <FactTile icon={CheckCircle} title="Traceable" body="Node details show rules, penalties, and actions." />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border-light bg-bg-alt px-4 py-12 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="font-title text-[30px] font-bold text-ink">
              The theorem is a graph problem.
            </h2>
            <p className="mt-3 max-w-[600px] font-body text-[15px] leading-relaxed text-ink-secondary">
              Claims gain strength when evidence roots are independent, specific, temporally spread,
              and tied to sources. They lose strength when support collapses into circular citation,
              unfalsifiable language, or high rhetorical pressure.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.values(featureLabels).map((label) => (
              <div
                key={label}
                className="flex min-h-12 items-center rounded-md border border-border bg-paper px-4 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-teal"
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <style jsx>{`
        .act-link-primary,
        .act-link-secondary,
        .act-run-button,
        .act-icon-button {
          align-items: center;
          border-radius: 6px;
          display: inline-flex;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 700;
          gap: 8px;
          justify-content: center;
          letter-spacing: 0.08em;
          min-height: 40px;
          padding: 10px 12px;
          text-decoration: none;
          text-transform: uppercase;
          transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
        }

        .act-link-primary,
        .act-run-button {
          background: var(--color-terracotta);
          color: var(--color-primary-foreground);
        }

        .act-link-primary:hover,
        .act-run-button:hover {
          background: var(--color-terracotta-hover);
        }

        .act-link-secondary,
        .act-icon-button {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.16);
          color: var(--color-readme-text);
        }

        .act-link-secondary:hover,
        .act-icon-button:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(180, 90, 45, 0.55);
        }

        .act-label {
          color: rgba(240, 235, 228, 0.62);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .act-input,
        .act-textarea {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 6px;
          color: var(--color-readme-text);
          font-family: var(--font-body);
          font-size: 14px;
          outline: none;
          width: 100%;
        }

        .act-input {
          min-height: 40px;
          padding: 0 11px;
        }

        .act-textarea {
          line-height: 1.45;
          padding: 10px 11px;
          resize: vertical;
        }

        .act-input:focus,
        .act-textarea:focus,
        .act-icon-button:focus-visible,
        .act-run-button:focus-visible,
        .act-link-primary:focus-visible,
        .act-link-secondary:focus-visible {
          border-color: var(--color-terracotta);
          box-shadow: 0 0 0 3px rgba(180, 90, 45, 0.22);
          outline: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .act-link-primary,
          .act-link-secondary,
          .act-run-button,
          .act-icon-button {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}

function ActCosmosGraph({
  nodes,
  links,
  onNodeFocus,
}: {
  nodes: ActNode[];
  links: ActLink[];
  onNodeFocus: (node: ActNode | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef(nodes);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || nodes.length === 0) return;

    let graph: Graph | null = null;
    let cancelled = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
    const arrays = buildCosmosArrays(nodes, links, nodeIndex);
    if (!arrays) return;

    const config: GraphConfig = {
      backgroundColor: [0.08, 0.08, 0.08, 1],
      spaceSize: 2048,
      pointDefaultColor: [0.65, 0.62, 0.57, 0.9],
      pointDefaultSize: 8,
      pointSizeScale: 1.1,
      pointDefaultShape: PointShape.Circle,
      linkDefaultColor: [0.72, 0.66, 0.58, 0.18],
      linkDefaultWidth: 0.9,
      renderLinks: true,
      renderHoveredPointRing: true,
      hoveredPointRingColor: [0.82, 0.62, 0.24, 1],
      hoveredPointCursor: 'pointer',
      enableDrag: true,
      enableZoom: true,
      fitViewOnInit: true,
      fitViewDelay: reducedMotion ? 0 : 500,
      fitViewPadding: 0.2,
      simulationRepulsion: 2.4,
      simulationGravity: 0.16,
      simulationCenter: 0.08,
      simulationLinkSpring: 0.45,
      simulationLinkDistance: 62,
      simulationFriction: reducedMotion ? 0.98 : 0.86,
      simulationDecay: reducedMotion ? 1200 : Number.POSITIVE_INFINITY,
      onPointMouseOver: (index) => {
        onNodeFocus(nodesRef.current[index] ?? null);
      },
      onClick: (index) => {
        if (typeof index !== 'number') {
          onNodeFocus(null);
          return;
        }
        onNodeFocus(nodesRef.current[index] ?? null);
      },
    };

    graph = new Graph(container, config);
    graph.ready.then(() => {
      if (cancelled || !graph) return;
      graph.setPointPositions(arrays.positions);
      graph.setPointColors(arrays.colors);
      graph.setPointSizes(arrays.sizes);
      graph.setPointShapes(arrays.shapes);
      graph.setLinks(arrays.linkPairs);
      graph.setLinkColors(arrays.linkColors);
      graph.setLinkWidths(arrays.linkWidths);
      graph.render(1);
      graph.start?.(1);
    });

    return () => {
      cancelled = true;
      graph?.destroy();
    };
  }, [nodes, links, onNodeFocus]);

  return (
    <div ref={containerRef} className="relative h-full min-h-[520px] w-full" aria-label="Animated claim graph">
      {nodes.length > 0 && <SvgTraceOverlay nodes={nodes} links={links} onNodeFocus={onNodeFocus} />}
      {nodes.length === 0 && (
        <div className="flex h-full min-h-[520px] items-center justify-center px-6 text-center">
          <div className="max-w-[360px]">
            <Page aria-hidden className="mx-auto text-cream/35" width={36} height={36} strokeWidth={1.6} />
            <p className="mt-4 font-title text-[24px] font-bold text-cream">Load a document to build the graph.</p>
            <p className="mt-2 font-body text-[14px] leading-relaxed text-cream/55">
              Claims, evidence traits, and penalties will appear as nodes after the lab scores real text.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SvgTraceOverlay({
  nodes,
  links,
  onNodeFocus,
}: {
  nodes: ActNode[];
  links: ActLink[];
  onNodeFocus: (node: ActNode | null) => void;
}) {
  const layout = useMemo(() => buildOverlayLayout(nodes), [nodes]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  return (
    <svg
      className="absolute inset-0 z-10 h-full w-full"
      viewBox="-520 -380 1040 760"
      role="img"
      aria-label="Claim graph with document, claim, and feature nodes"
    >
      <defs>
        <filter id="act-node-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {links.map((link) => {
        const source = layout.get(link.source);
        const target = layout.get(link.target);
        if (!source || !target) return null;
        return (
          <line
            key={`${link.source}-${link.target}`}
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke="rgba(216, 196, 156, 0.28)"
            strokeWidth={1 + link.strength * 2}
          />
        );
      })}
      {nodes.map((node) => {
        const point = layout.get(node.id);
        if (!point) return null;
        const radius = node.kind === 'document' ? 22 : node.kind === 'claim' ? 15 : 8;
        const fill = node.kind === 'document' ? '#f0ebe4' : overlayColor(node.verdict ?? 'mixed');
        return (
          <g
            key={node.id}
            tabIndex={0}
            role="button"
            aria-label={node.label}
            transform={`translate(${point.x} ${point.y})`}
            onMouseEnter={() => onNodeFocus(nodeById.get(node.id) ?? null)}
            onFocus={() => onNodeFocus(nodeById.get(node.id) ?? null)}
            onClick={() => onNodeFocus(nodeById.get(node.id) ?? null)}
            style={{ cursor: 'pointer', outline: 'none' }}
          >
            <circle r={radius + 10} fill={fill} opacity="0.13" filter="url(#act-node-glow)" />
            <circle r={radius} fill={fill} stroke="rgba(240, 235, 228, 0.76)" strokeWidth="1.2" />
            {node.kind !== 'feature' && (
              <text
                y={radius + 20}
                textAnchor="middle"
                fill="rgba(240, 235, 228, 0.82)"
                fontFamily="var(--font-mono)"
                fontSize="12"
                fontWeight="700"
                letterSpacing="1.2"
              >
                {node.kind === 'document' ? 'DOCUMENT' : verdictCopy[node.verdict ?? 'mixed'].toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function buildOverlayLayout(nodes: ActNode[]) {
  const layout = new Map<string, { x: number; y: number }>();
  const claimNodes = nodes.filter((node) => node.kind === 'claim');
  const origin = { x: -150, y: 0 };
  layout.set('document', origin);

  claimNodes.forEach((node, index) => {
    const angle = (index / Math.max(1, claimNodes.length)) * Math.PI * 2 - Math.PI / 2;
    const claimPoint = {
      x: origin.x + Math.cos(angle) * 230,
      y: origin.y + Math.sin(angle) * 190,
    };
    layout.set(node.id, claimPoint);
    const featureNodes = nodes.filter((candidate) => candidate.id.startsWith(`${node.id}-`));
    featureNodes.forEach((feature, featureIndex) => {
      const featureAngle = angle + (featureIndex - (featureNodes.length - 1) / 2) * 0.34;
      layout.set(feature.id, {
        x: claimPoint.x + Math.cos(featureAngle) * 96,
        y: claimPoint.y + Math.sin(featureAngle) * 82,
      });
    });
  });

  return layout;
}

function overlayColor(verdict: Verdict) {
  if (verdict === 'strong') return '#4a9aaa';
  if (verdict === 'mixed') return '#c49a4a';
  return '#c0623a';
}

function NodeInspector({
  analysis,
  node,
  primaryClaim,
}: {
  analysis: AnalysisResult | null;
  node: ActNode | null;
  primaryClaim: ClaimTrace | null;
}) {
  const visibleClaim =
    node?.kind === 'claim' ? analysis?.claims.find((claim) => claim.id === node.id) ?? null : primaryClaim;

  return (
    <aside className="relative mx-4 mb-4 rounded-md border border-white/12 bg-black/45 p-4 backdrop-blur-sm lg:absolute lg:bottom-4 lg:right-4 lg:top-4 lg:mx-0 lg:mb-0 lg:w-[min(360px,calc(100%-32px))]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          className="font-code text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: 'var(--color-gold)' }}
        >
          Trace detail
        </h2>
        {visibleClaim && <VerdictBadge verdict={visibleClaim.verdict} />}
      </div>
      {!analysis && (
        <p className="m-0 font-body text-[14px] leading-relaxed text-cream/62">
          The graph is empty until a URL, document, or pasted text is analyzed.
        </p>
      )}
      {analysis && !visibleClaim && (
        <p className="m-0 font-body text-[14px] leading-relaxed text-cream/62">
          Hover a node to inspect the claim, feature, or document anchor behind it.
        </p>
      )}
      {visibleClaim && (
        <div>
          <p className="m-0 line-clamp-4 font-body text-[14px] leading-relaxed text-cream/78">
            {visibleClaim.text}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {featureKeys.map((key) => (
              <div key={key} className="rounded border border-white/10 bg-white/[0.04] p-2">
                <p className="m-0 font-mono text-[9px] uppercase tracking-[0.1em] text-cream/45">
                  {featureLabels[key]}
                </p>
                <p className="m-0 mt-1 font-code text-[16px] font-semibold text-cream">
                  {formatScore(visibleClaim.features[key])}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {visibleClaim.reasons.slice(0, 3).map((reason) => (
              <p key={reason} className="m-0 rounded border border-white/10 bg-white/[0.04] p-2 font-body text-[13px] leading-snug text-cream/68">
                {reason}
              </p>
            ))}
          </div>
          <div className="mt-3 grid gap-2">
            {visibleClaim.actions.slice(0, 2).map((action) => (
              <p key={action} className="m-0 rounded border border-gold/20 bg-gold/10 p-2 font-body text-[13px] leading-snug text-cream/72">
                {action}
              </p>
            ))}
          </div>
        </div>
      )}
      {node?.kind === 'feature' && (
        <p className="mt-3 rounded border border-white/10 bg-white/[0.04] p-2 font-body text-[13px] leading-snug text-cream/68">
          {node.detail}
        </p>
      )}
    </aside>
  );
}

function StatusPill({ status }: { status: LabStatus }) {
  const label =
    status === 'idle'
      ? 'Ready'
      : status === 'reading'
        ? 'Reading'
        : status === 'scoring'
          ? 'Scoring'
          : status === 'ready'
            ? 'Trace ready'
            : 'Needs input';
  return (
    <span className="inline-flex min-h-7 items-center rounded-md border border-white/12 bg-white/[0.05] px-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-cream/70">
      {label}
    </span>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: Verdict }) {
  const color =
    tone === 'strong'
      ? 'text-teal-light'
      : tone === 'mixed'
        ? 'text-gold'
        : tone === 'suspect'
          ? 'text-terracotta-light'
          : 'text-cream';
  return (
    <div className="rounded-md border border-white/12 bg-black/20 p-4">
      <p className="m-0 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-cream/45">
        {label}
      </p>
      <p className={`m-0 mt-2 font-code text-[24px] font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function FactTile({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-md border border-border bg-paper p-4">
      <Icon aria-hidden width={24} height={24} strokeWidth={1.9} className="text-terracotta" />
      <h3 className="mt-3 font-title text-[20px] font-bold text-ink">{title}</h3>
      <p className="m-0 mt-2 font-body text-[14px] leading-relaxed text-ink-secondary">{body}</p>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const classes =
    verdict === 'strong'
      ? 'border-teal/40 bg-teal/15 text-teal-light'
      : verdict === 'mixed'
        ? 'border-gold/40 bg-gold/15 text-gold'
        : 'border-terracotta/40 bg-terracotta/15 text-terracotta-light';
  return (
    <span className={`rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${classes}`}>
      {verdictCopy[verdict]}
    </span>
  );
}

function analyzeText(text: string, title: string, sourceType: AnalysisResult['sourceType']): AnalysisResult {
  const sentences = extractClaims(text);
  const claims = sentences.map((sentence, index) => scoreClaim(sentence, index));
  const selectedClaims = claims.slice(0, 18);
  const strongCount = selectedClaims.filter((claim) => claim.verdict === 'strong').length;
  const mixedCount = selectedClaims.filter((claim) => claim.verdict === 'mixed').length;
  const suspectCount = selectedClaims.filter((claim) => claim.verdict === 'suspect').length;
  const averageScore =
    selectedClaims.reduce((sum, claim) => sum + claim.score, 0) / Math.max(1, selectedClaims.length);

  return {
    title,
    sourceLabel: sourceType === 'url' ? URLSafeLabel(title) : title,
    sourceType,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    claimCount: selectedClaims.length,
    suspectCount,
    mixedCount,
    strongCount,
    averageScore,
    claims: selectedClaims,
  };
}

function extractClaims(text: string): string[] {
  const sentences = normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      const words = sentence.split(/\s+/).filter(Boolean);
      return words.length >= 8 && words.length <= 80;
    });
  return sentences.length > 0 ? sentences : [normalizeWhitespace(text).slice(0, 420)];
}

function scoreClaim(text: string, index: number): ClaimTrace {
  const lower = text.toLowerCase();
  const sourceMatches = text.match(/\b([a-z0-9-]+\.)+[a-z]{2,}\b/gi) ?? [];
  const yearMatches = text.match(/\b(19|20)\d{2}\b/g) ?? [];
  const numberMatches = text.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
  const properNounMatches = text.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g) ?? [];
  const citationMarkers = [
    'according to',
    'reported',
    'study',
    'court',
    'filing',
    'dataset',
    'interview',
    'research',
    'survey',
    'records',
  ].filter((marker) => lower.includes(marker)).length;
  const rhetoricMarkers = [
    'hidden',
    'they do not want',
    "they don't want",
    'wake up',
    'the truth',
    'cover up',
    'everyone knows',
    'mainstream media',
    'secretly',
    'puppet',
    'globalist',
    'hoax',
  ].filter((marker) => lower.includes(marker)).length;
  const totalSources = new Set(sourceMatches.map((source) => source.toLowerCase())).size;
  const evidenceVolume = clamp01((citationMarkers + totalSources + numberMatches.length * 0.35) / 5);
  const sourceIndependence = clamp01((totalSources + citationMarkers * 0.55) / 4);
  const supportRatio = clamp01((citationMarkers + sourceMatches.length + (lower.includes('because') ? 1 : 0)) / 4);
  const specificity = clamp01((yearMatches.length + numberMatches.length + properNounMatches.length * 0.35) / 5);
  const temporalSpread = clamp01(new Set(yearMatches).size / 3);
  const rhetoricalPressure = clamp01((rhetoricMarkers + (text.match(/!/g) ?? []).length * 0.5) / 4);
  const score = clamp01(
    evidenceVolume * 0.22 +
      sourceIndependence * 0.18 +
      supportRatio * 0.18 +
      specificity * 0.18 +
      temporalSpread * 0.1 +
      (1 - rhetoricalPressure) * 0.14,
  );
  const verdict: Verdict = score < 0.55 || rhetoricalPressure > 0.62 ? 'suspect' : score < 0.74 ? 'mixed' : 'strong';
  const reasons = buildReasons({
    evidenceVolume,
    sourceIndependence,
    supportRatio,
    specificity,
    temporalSpread,
    rhetoricalPressure,
  });
  const actions = buildActions(verdict, reasons);

  return {
    id: `claim-${index + 1}`,
    text,
    verdict,
    score,
    features: {
      evidenceVolume,
      sourceIndependence,
      supportRatio,
      specificity,
      temporalSpread,
      rhetoricalPressure,
    },
    reasons,
    actions,
  };
}

function buildReasons(features: ClaimTrace['features']): string[] {
  const reasons: string[] = [];
  if (features.evidenceVolume < 0.4) reasons.push('Low evidence volume: the claim has few explicit sources, citations, or measurable anchors.');
  if (features.sourceIndependence < 0.4) reasons.push('Weak source independence: support appears to come from a narrow source family.');
  if (features.supportRatio < 0.4) reasons.push('Thin support ratio: the claim asserts more than it directly supports.');
  if (features.specificity > 0.68) reasons.push('Strong specificity: named entities, years, or quantities make the claim easier to check.');
  if (features.temporalSpread > 0.55) reasons.push('Temporal spread is visible: the claim references more than one time anchor.');
  if (features.rhetoricalPressure > 0.45) reasons.push('Rhetorical pressure is elevated: persuasive framing is doing some of the work.');
  if (reasons.length === 0) reasons.push('Balanced trace: no single feature dominates the result.');
  return reasons;
}

function buildActions(verdict: Verdict, reasons: string[]): string[] {
  if (verdict === 'strong') {
    return ['Preserve the cited source chain and compare it with nearby claims.'];
  }
  if (verdict === 'mixed') {
    return ['Find one independent source and one primary record before trusting the claim.'];
  }
  return reasons.some((reason) => reason.includes('Rhetorical'))
    ? ['Separate the factual assertion from the persuasive framing, then look for primary evidence.']
    : ['Ask for an independent source, a date, and the document that anchors the assertion.'];
}

function buildGraphData(analysis: AnalysisResult | null): { nodes: ActNode[]; links: ActLink[] } {
  if (!analysis) return { nodes: [], links: [] };
  const nodes: ActNode[] = [
    {
      id: 'document',
      label: analysis.sourceLabel,
      kind: 'document',
      detail: `${analysis.wordCount} words scored from ${analysis.sourceType}.`,
    },
  ];
  const links: ActLink[] = [];

  for (const claim of analysis.claims) {
    nodes.push({
      id: claim.id,
      label: `${verdictCopy[claim.verdict]} claim`,
      kind: 'claim',
      verdict: claim.verdict,
      score: claim.score,
      detail: claim.text,
    });
    links.push({ source: 'document', target: claim.id, strength: claim.score });

    for (const key of featureKeys) {
      const value = claim.features[key];
      if (value < 0.42 && key !== 'rhetoricalPressure') continue;
      if (key === 'rhetoricalPressure' && value < 0.28) continue;
      const featureId = `${claim.id}-${key}`;
      nodes.push({
        id: featureId,
        label: featureLabels[key],
        kind: 'feature',
        verdict: key === 'rhetoricalPressure' && value > 0.45 ? 'suspect' : claim.verdict,
        score: value,
        detail: `${featureLabels[key]} scored ${formatScore(value)} for this claim.`,
      });
      links.push({ source: claim.id, target: featureId, strength: value });
    }
  }

  return { nodes, links };
}

function buildCosmosArrays(
  nodes: ActNode[],
  links: ActLink[],
  nodeIndex: Map<string, number>,
) {
  const pointCount = nodes.length;
  const linkPairs = new Float32Array(links.length * 2);
  const linkColors = new Float32Array(links.length * 4);
  const linkWidths = new Float32Array(links.length);
  const positions = new Float32Array(pointCount * 2);
  const colors = new Float32Array(pointCount * 4);
  const sizes = new Float32Array(pointCount);
  const shapes = new Float32Array(pointCount);

  for (let i = 0; i < pointCount; i += 1) {
    const node = nodes[i];
    const angle = (i / Math.max(1, pointCount)) * Math.PI * 2;
    const ring = node.kind === 'document' ? 0 : node.kind === 'claim' ? 230 : 360;
    positions[i * 2] = Math.cos(angle) * ring + (node.kind === 'feature' ? Math.sin(i) * 50 : 0);
    positions[i * 2 + 1] = Math.sin(angle) * ring + (node.kind === 'feature' ? Math.cos(i) * 50 : 0);
    const color = node.kind === 'document' ? [0.94, 0.92, 0.88, 1] : verdictColors[node.verdict ?? 'mixed'];
    colors.set([color[0], color[1], color[2], color[3]], i * 4);
    sizes[i] = node.kind === 'document' ? 22 : node.kind === 'claim' ? 12 + (node.score ?? 0.5) * 12 : 6 + (node.score ?? 0.4) * 8;
    shapes[i] = node.kind === 'document' ? PointShape.Hexagon : node.kind === 'claim' ? PointShape.Circle : PointShape.Diamond;
  }

  for (let i = 0; i < links.length; i += 1) {
    const source = nodeIndex.get(links[i].source);
    const target = nodeIndex.get(links[i].target);
    if (source === undefined || target === undefined) return null;
    linkPairs[i * 2] = source;
    linkPairs[i * 2 + 1] = target;
    const alpha = Math.max(0.12, Math.min(0.58, links[i].strength));
    linkColors.set([0.86, 0.76, 0.58, alpha], i * 4);
    linkWidths[i] = 0.8 + links[i].strength * 1.6;
  }

  if (positions.length !== pointCount * 2 || linkPairs.length !== links.length * 2) return null;
  return { positions, colors, sizes, shapes, linkPairs, linkColors, linkWidths };
}

function formatScore(score: number) {
  return `${Math.round(score * 100)}%`;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function URLSafeLabel(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}
