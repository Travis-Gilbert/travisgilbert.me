import type { CSSProperties } from 'react';

// Mobile Shell 2.0 (2026-04-28): public-facing landing for /theseus.
// Server component: fetches real graph weather inline so logged-out
// visitors see the live engine state, not a stub. Falls back to a
// minimal frame if the backend is unreachable (no fake numbers).

interface GraphWeather {
  headline?: string;
  detail?: string;
  composite_iq?: number;
  total_objects?: number;
  total_edges?: number;
  edge_delta?: number;
  object_delta?: number;
  last_engine_run?: string;
}

async function loadGraphWeather(): Promise<GraphWeather | null> {
  try {
    const res = await fetch(
      'https://index-api-production-a5f7.up.railway.app/api/v2/theseus/graph-weather/',
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as GraphWeather;
  } catch {
    return null;
  }
}

const heroStyle: CSSProperties = {
  position: 'relative',
  padding: '88px 24px 56px',
  background: 'var(--app-base)',
  color: 'var(--ink)',
  overflow: 'hidden',
};

const haloStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(ellipse at 50% 0%, rgba(42, 139, 108, 0.18) 0%, transparent 60%)',
  pointerEvents: 'none',
};

const innerStyle: CSSProperties = {
  position: 'relative',
  maxWidth: 880,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

const eyebrowStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--brass, #c9a23a)',
  margin: 0,
};

const headlineStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(32px, 5vw, 56px)',
  lineHeight: 1.1,
  fontWeight: 500,
  letterSpacing: '-0.01em',
};

const accentSpan: CSSProperties = {
  fontStyle: 'italic',
  color: 'var(--brass, #c9a23a)',
};

const ledeStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(18px, 2vw, 22px)',
  lineHeight: 1.5,
  color: 'var(--ink-2)',
  maxWidth: 640,
};

const statRowStyle: CSSProperties = {
  marginTop: 24,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 16,
};

const statCardStyle: CSSProperties = {
  padding: '14px 16px',
  border: '1px solid var(--rule-strong)',
  borderRadius: 6,
  background: 'rgba(20, 23, 27, 0.6)',
};

const statLabelStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
  marginBottom: 6,
};

const statValueStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 26,
  color: 'var(--ink)',
  fontVariantNumeric: 'tabular-nums',
};

const ctaRowStyle: CSSProperties = {
  marginTop: 32,
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
};

const primaryCta: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 20px',
  borderRadius: 24,
  background: 'var(--brass, #c9a23a)',
  color: 'var(--app-base)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  textDecoration: 'none',
};

const ghostCta: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 20px',
  borderRadius: 24,
  border: '1px solid var(--rule-strong)',
  color: 'var(--ink)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  textDecoration: 'none',
};

const sectionStyle: CSSProperties = {
  padding: '64px 24px',
  background: 'var(--top-chrome)',
  borderTop: '1px solid var(--rule-strong)',
};

const sectionInner: CSSProperties = {
  maxWidth: 880,
  margin: '0 auto',
};

const sectionTitleStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 28,
  fontWeight: 500,
  color: 'var(--ink)',
  margin: '0 0 24px',
};

const layerGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 18,
};

const layerCardStyle: CSSProperties = {
  padding: '18px 20px',
  border: '1px solid var(--rule-strong)',
  borderRadius: 6,
  background: 'var(--panel)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const layerNumStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.12em',
  color: 'var(--brass, #c9a23a)',
};

const layerNameStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 18,
  fontWeight: 500,
  color: 'var(--ink)',
};

const layerCopyStyle: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--ink-2)',
  margin: 0,
};

const SIX_LAYERS: Array<{ n: string; name: string; copy: string }> = [
  {
    n: '01',
    name: 'Capture',
    copy: 'Sources, files, and the web flow into a single graph of objects with provenance.',
  },
  {
    n: '02',
    name: 'Reason',
    copy: 'Claims, tensions, and questions are extracted and tracked through their epistemic life.',
  },
  {
    n: '03',
    name: 'Connect',
    copy: 'A learned scorer combines lexical, semantic, structural, and temporal signal into edge weights.',
  },
  {
    n: '04',
    name: 'Self-organize',
    copy: 'Communities, clusters, and emergent types reorganize the graph from its own outputs.',
  },
  {
    n: '05',
    name: 'Adapt',
    copy: 'Per-domain weights and few-shot relation learning let the engine specialize as the corpus grows.',
  },
  {
    n: '06',
    name: 'Simulate',
    copy: 'Counterfactual retraction, multi-agent debate, and what-if analysis stress-test what is known.',
  },
];

function formatNumber(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

function formatDelta(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${formatNumber(n)}`;
}

function formatIq(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toFixed(1);
}

export default async function TheseusLanding() {
  const weather = await loadGraphWeather();

  return (
    <div data-theseus-landing="true" style={{ minHeight: '100vh' }}>
      <section style={heroStyle}>
        <div style={haloStyle} aria-hidden />
        <div style={innerStyle}>
          <p style={eyebrowStyle}>Visual Intelligence Engine</p>
          <h1 style={headlineStyle}>
            A graph that <span style={accentSpan}>thinks with you.</span>
          </h1>
          <p style={ledeStyle}>
            Theseus reads your sources, extracts claims and tensions,
            connects related ideas, and reorganizes itself as it learns.
            What you see below is the live state of the engine.
          </p>

          {weather && (
            <div style={statRowStyle}>
              <div style={statCardStyle}>
                <div style={statLabelStyle}>Composite IQ</div>
                <div style={statValueStyle}>{formatIq(weather.composite_iq)}</div>
              </div>
              <div style={statCardStyle}>
                <div style={statLabelStyle}>Objects</div>
                <div style={statValueStyle}>{formatNumber(weather.total_objects)}</div>
              </div>
              <div style={statCardStyle}>
                <div style={statLabelStyle}>Edges</div>
                <div style={statValueStyle}>{formatNumber(weather.total_edges)}</div>
              </div>
              <div style={statCardStyle}>
                <div style={statLabelStyle}>Δ overnight</div>
                <div style={statValueStyle}>
                  {formatDelta(weather.object_delta)} obj · {formatDelta(weather.edge_delta)} edges
                </div>
              </div>
            </div>
          )}

          <div style={ctaRowStyle}>
            <a href="/api/auth/signin?callbackUrl=%2Ftheseus%2Fthreads" style={primaryCta}>
              Open the workbench →
            </a>
            <a href="/theseus/code" style={ghostCta}>
              Read the code
            </a>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionInner}>
          <h2 style={sectionTitleStyle}>Six layers of architecture</h2>
          <div style={layerGridStyle}>
            {SIX_LAYERS.map((layer) => (
              <article key={layer.n} style={layerCardStyle}>
                <div style={layerNumStyle}>{layer.n}</div>
                <div style={layerNameStyle}>{layer.name}</div>
                <p style={layerCopyStyle}>{layer.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
