/**
 * TechnicalNotebook
 *
 * Static port of the Observable Notebook Kit draft delivered as
 * `act-technical-notebook (2).zip`. Source files (read-only, not
 * committed):
 *   /tmp/act-notebook-extract/act-technical-notebook/
 *     act-evidence-cockpit-notebook.html  (Notebook Kit HTML)
 *     act-technical-notebook.md           (markdown fallback)
 *
 * The HTML draft uses Observable's `<script type="module" pinned>` live
 * cells. Those cells contain ordinary JS (data + scoring + display
 * calls), so we port them to TSX directly: data constants up top, the
 * `scoreACC` function used inline, and a couple of computed cards
 * rendered as static React markup. No Observable runtime required.
 *
 * Content here is a first-pass wiring of the user's draft. The user
 * will swap it out later via Claude Cowork; the page chrome
 * (breadcrumb, title block, hero, section frame, footer) is the part
 * that should stay stable. Editing this file replaces content; the
 * shape of the surface stays.
 */

import Link from 'next/link';
import styles from './TechnicalNotebook.module.css';

/* ── Live cell #1: synthetic claim graph ───────────────────── */

const sampleGraph = {
  claim: {
    id: 'claim_001',
    text: 'A new policy was secretly enacted last week and is already active nationwide.',
    type: 'empirical_event',
  },
  sources: [
    { id: 'blog_a', label: 'Blog A', origin: 'post_x', kind: 'commentary' },
    { id: 'news_b', label: 'News B', origin: 'post_x', kind: 'news' },
    { id: 'social_c', label: 'Social C', origin: 'post_x', kind: 'social' },
    { id: 'official_d', label: 'Official registry', origin: 'official_d', kind: 'primary' },
  ],
  edges: [
    { from: 'blog_a', to: 'claim_001', type: 'supports' },
    { from: 'news_b', to: 'claim_001', type: 'supports' },
    { from: 'social_c', to: 'claim_001', type: 'supports' },
    { from: 'official_d', to: 'claim_001', type: 'contradicts' },
    { from: 'news_b', to: 'blog_a', type: 'cites' },
    { from: 'social_c', to: 'blog_a', type: 'cites' },
  ],
  traits: {
    root_depth: 0.35,
    source_independence: 0.28,
    support_ratio: 0.60,
    claim_specificity: 0.78,
    temporal_spread: 0.22,
    evidence_volume: 0.64,
  },
} as const;

/* ── Live cell #2: ACC v2 scoring function ─────────────────── */

const weights: Record<string, number> = {
  root_depth: 0.20,
  source_independence: 0.20,
  support_ratio: 0.15,
  claim_specificity: 0.12,
  temporal_spread: 0.18,
  evidence_volume: 0.15,
};

function scoreACC(
  traits: Record<string, number>,
  penaltyTotal = 0.08,
  epsilon = 0.001,
) {
  const linear = Object.entries(weights).reduce(
    (sum, [key, w]) => sum + w * traits[key],
    0,
  );
  const geometric = Object.entries(weights).reduce(
    (prod, [key, w]) => prod * Math.pow(Math.max(traits[key], epsilon), w),
    1,
  );
  const acc = 0.65 * linear + 0.35 * geometric - penaltyTotal;
  return {
    linear: Number(linear.toFixed(3)),
    geometric: Number(geometric.toFixed(3)),
    penaltyTotal,
    acc: Number(acc.toFixed(3)),
    label:
      acc < 0.55
        ? 'source-collapsed / under-evidenced'
        : 'structurally supported',
  };
}

/* ── Live cell #3: verifier packet shape ───────────────────── */

function buildVerifierPacket() {
  const acc = scoreACC(sampleGraph.traits);
  return {
    claim_id: 'claim_001',
    claim_text: sampleGraph.claim.text,
    status: 'under_evidenced_source_collapsed',
    acc,
    traits: sampleGraph.traits,
    diagnostics: {
      visible_support_sources: 3,
      canonical_support_origins: 1,
      contradiction_sources: 1,
      source_collapse_ratio: 0.67,
      primary_source_present: true,
    },
    graph_paths: [
      ['news_b', 'cites', 'blog_a', 'supports', 'claim_001'],
      ['social_c', 'cites', 'blog_a', 'supports', 'claim_001'],
      ['official_d', 'contradicts', 'claim_001'],
    ],
    next_checks: [
      'Find an independent primary source.',
      'Check the official registry date.',
      'Separate the empirical claim from interpretation.',
    ],
  };
}

/* ── Live cell #4: A2UI scene ──────────────────────────────── */

function buildA2UIScene(packet: ReturnType<typeof buildVerifierPacket>) {
  return {
    scene: 'EvidenceCockpit',
    version: '0.1',
    components: [
      {
        type: 'ClaimCard',
        props: {
          claim: packet.claim_text,
          status: 'Under-evidenced, not proven false',
          score: packet.acc.acc,
        },
      },
      {
        type: 'SourceCollapsePanel',
        props: {
          visibleSources: 3,
          canonicalOrigins: 1,
          message: 'Multiple support sources appear downstream of the same origin.',
        },
      },
      {
        type: 'EvidencePathGraph',
        props: { paths: packet.graph_paths },
      },
      {
        type: 'ContradictionPanel',
        props: {
          count: 1,
          message: 'A primary source conflicts with the timing claim.',
        },
      },
      {
        type: 'NextChecks',
        props: { items: packet.next_checks },
      },
    ],
  };
}

/* Pretty-print helper for the JSON readouts. Compact-but-readable; no
   trailing whitespace, hand-tunable spacing for the small examples. */
function fmt(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default function TechnicalNotebook() {
  const accResult = scoreACC(sampleGraph.traits);
  const verifierPacket = buildVerifierPacket();
  const a2uiScene = buildA2UIScene(verifierPacket);

  const today = new Date()
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    .toUpperCase();

  return (
    <div className={styles.root}>
      <main className={styles.workbench}>
        {/* ── Breadcrumb strip ────────────────────────────────── */}
        <header className={styles.strip}>
          <span className={styles.crumbs}>
            <Link href="/">TRAVISGILBERT.ME</Link>
            <span className={styles.sep}>/</span>
            <Link href="/projects">PROJECTS</Link>
            <span className={styles.sep}>/</span>
            <Link href="/act">ANTI-CONSPIRACY THEOREM</Link>
            <span className={styles.sep}>/</span>
            <span className={styles.here}>TECHNICAL NOTEBOOK</span>
          </span>
          <span className={styles.sheet}>SHEET 05 / N</span>
        </header>

        {/* ── Title block ─────────────────────────────────────── */}
        <section className={styles.titleblock}>
          <div className={styles.left}>
            <div>{today}</div>
            <div>T. GILBERT</div>
            <div className={styles.role}>Inventor</div>
          </div>
          <div className={styles.center}>
            ACT EVIDENCE COCKPIT
            <span className={styles.sub}>
              A technical notebook: Gemma 4 + ACC + A2UI as an inspectable evidence
              instrument, not a truth oracle.
            </span>
          </div>
          <div className={styles.right}>
            <div>NB / V0.1</div>
            <div>OBSERVABLE KIT</div>
            <div>DRAFT</div>
          </div>
        </section>

        {/* ── Thesis hero ─────────────────────────────────────── */}
        <div className={styles.hero}>
          <span className={styles.heroLabel}>Thesis</span>
          <p className={styles.heroText}>
            <span className={styles.heroEm}>
              A small Gemma model should not decide truth directly.
            </span>
            It should generate an inspectable interface from a graph-verifier
            packet. ACT packages that pattern as a browser-runnable evidence
            cockpit: ACC v2 scores the claim graph deterministically; Gemma 4
            generates the A2UI scene that lets a person inspect the score
            instead of trusting it.
          </p>
        </div>

        {/* ── §1 Project snapshot ─────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 01</span>
            <h2 className={styles.secTitle}>Project snapshot</h2>
          </div>
          <p>
            ACT packages the <strong>Anti-Conspiracy Constraint</strong>
            (ACC) as a standalone theorem implementation and deployable
            browser extension. ACC is not a popularity metric and not a truth
            oracle. It asks whether a claim is structurally rooted,
            independently supported, specific, temporally spread, backed by
            enough evidence volume, and free of collapsed citation loops.
          </p>
          <p>
            The competition build keeps the graph verifier small enough to
            run locally while using Gemma 4 to turn verifier output into a
            useful interface.
          </p>
          <div className={styles.pillRow}>
            <span className={styles.pill}>Browser extension</span>
            <span className={styles.pill}>Gemma 4 E4B</span>
            <span className={styles.pill}>ACC v2</span>
            <span className={styles.pill}>A2UI scene generation</span>
            <span className={styles.pill}>Claim graph</span>
            <span className={styles.pill}>Source collapse detection</span>
          </div>
        </section>

        {/* ── §2 Problem ──────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 02</span>
            <h2 className={styles.secTitle}>Problem</h2>
          </div>
          <p>
            People do not only need a label saying &ldquo;true&rdquo; or
            &ldquo;false.&rdquo; They need to understand <strong>why</strong>
            {' '}a claim is strong, weak, ambiguous, source-collapsed,
            contradicted, or still unresolved.
          </p>
          <p>
            Current fact-checking interfaces compress reasoning into a single
            verdict. ACT instead exposes the graph shape behind the verdict:
            which evidence paths support the claim, which appear independent
            but collapse to one origin, which primary sources contradict, and
            which next checks would resolve the uncertainty.
          </p>
        </section>

        {/* ── §3 One-sentence thesis ──────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 03</span>
            <h2 className={styles.secTitle}>One-sentence technical thesis</h2>
          </div>
          <p>
            A deterministic claim-graph verifier produces a compact packet; a
            small Gemma model converts that packet into a structured UI
            scene; the user inspects the reasoning rather than trusting the
            verdict.
          </p>
        </section>

        {/* ── §4 Architecture ─────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 04</span>
            <h2 className={styles.secTitle}>Architecture</h2>
          </div>
          <ol className={styles.flow}>
            <li className={styles.flowItem}>
              <span className={styles.flowNum}>1</span>
              <span className={styles.flowText}>Web page or pasted text</span>
            </li>
            <li className={styles.flowItem}>
              <span className={styles.flowNum}>2</span>
              <span className={styles.flowText}>Gemma 4 claim extraction</span>
            </li>
            <li className={styles.flowItem}>
              <span className={styles.flowNum}>3</span>
              <span className={styles.flowText}>Claim, evidence, source graph</span>
            </li>
            <li className={styles.flowItem}>
              <span className={styles.flowNum}>4</span>
              <span className={styles.flowText}>ACC v2 deterministic verifier</span>
            </li>
            <li className={styles.flowItem}>
              <span className={styles.flowNum}>5</span>
              <span className={styles.flowText}>Optional EpiGNN residual layer</span>
            </li>
            <li className={styles.flowItem}>
              <span className={styles.flowNum}>6</span>
              <span className={styles.flowText}>Verifier packet</span>
            </li>
            <li className={styles.flowItem}>
              <span className={styles.flowNum}>7</span>
              <span className={styles.flowText}>Gemma 4 A2UI scene generator</span>
            </li>
            <li className={styles.flowItem}>
              <span className={styles.flowNum}>8</span>
              <span className={styles.flowText}>Browser evidence cockpit</span>
            </li>
          </ol>
        </section>

        {/* ── §5 Public graph schema ──────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 05</span>
            <h2 className={styles.secTitle}>Public graph schema</h2>
          </div>
          <p>
            <strong>Nodes.</strong>{' '}
            <code className={styles.inlineCode}>claim</code>,{' '}
            <code className={styles.inlineCode}>source</code>,{' '}
            <code className={styles.inlineCode}>evidence_snippet</code>,{' '}
            <code className={styles.inlineCode}>canonical_origin</code>,{' '}
            <code className={styles.inlineCode}>review</code>.
          </p>
          <p>
            <strong>Edges.</strong>{' '}
            <code className={styles.inlineCode}>supports</code>,{' '}
            <code className={styles.inlineCode}>contradicts</code>,{' '}
            <code className={styles.inlineCode}>cites</code>,{' '}
            <code className={styles.inlineCode}>same_origin_as</code>,{' '}
            <code className={styles.inlineCode}>extracted_from</code>.
          </p>
        </section>

        {/* ── §6 ACC v2 formula and traits ────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 06</span>
            <h2 className={styles.secTitle}>ACC v2 formula and traits</h2>
          </div>
          <pre className={styles.code}>
{`ACC(c) = 0.65 * linear_score(traits, w)
       + 0.35 * geometric_core(traits, w)
       -        penalty_total(rules, c)`}
          </pre>
          <p>The six normalized traits weighted by the linear and geometric components:</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Trait</th>
                  <th>Weight</th>
                  <th>Reads</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code className={styles.inlineCode}>root_depth</code></td>
                  <td>0.20</td>
                  <td>Distance from the claim to a primary source.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>source_independence</code></td>
                  <td>0.20</td>
                  <td>How many canonical origins back the visible support set.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>support_ratio</code></td>
                  <td>0.15</td>
                  <td>Supports vs. contradicts on the claim node.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>claim_specificity</code></td>
                  <td>0.12</td>
                  <td>Specific enough to be falsifiable.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>temporal_spread</code></td>
                  <td>0.18</td>
                  <td>Sources span time vs. clustered in a window.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>evidence_volume</code></td>
                  <td>0.15</td>
                  <td>Independent evidence count, capped.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── §7 Synthetic graph ─────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 07</span>
            <h2 className={styles.secTitle}>Synthetic claim graph example</h2>
          </div>
          <p>
            A small handwritten graph that exercises source collapse:
            three visible support sources all trace back to the same canonical
            origin, while the primary source contradicts the claim.
          </p>
          <p className={styles.codeLabel}>
            <span>sampleGraph</span>
            <span>fixture</span>
          </p>
          <pre className={styles.code}>{fmt(sampleGraph)}</pre>
        </section>

        {/* ── §8 ACC scoring example ─────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 08</span>
            <h2 className={styles.secTitle}>ACC scoring example</h2>
          </div>
          <p>
            <code className={styles.inlineCode}>scoreACC(sampleGraph.traits)</code>
            {' '}returns:
          </p>
          <div className={styles.scoreCard}>
            <span className={styles.scoreLabel}>ACC SCORE</span>
            <span className={styles.scoreValue}>{accResult.acc}</span>
            <span className={styles.scoreStatus}>{accResult.label}</span>
            <div className={styles.scoreNote}>
              Three visible support sources trace back to the same canonical
              origin (post_x). The primary source contradicts the timing.
              Linear component: <strong>{accResult.linear}</strong>.
              Geometric core: <strong>{accResult.geometric}</strong>. Penalty
              total: <strong>{accResult.penaltyTotal}</strong>.
            </div>
          </div>
        </section>

        {/* ── §9 Verifier packet ─────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 09</span>
            <h2 className={styles.secTitle}>Verifier packet passed to Gemma</h2>
          </div>
          <p>
            Gemma receives a compact, schema-validated packet. The model never
            touches raw graph topology; only the deterministic packet shape.
          </p>
          <p className={styles.codeLabel}>
            <span>verifierPacket</span>
            <span>schema v0.1</span>
          </p>
          <pre className={styles.code}>{fmt(verifierPacket)}</pre>
        </section>

        {/* ── §10 A2UI scene ─────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 10</span>
            <h2 className={styles.secTitle}>A2UI scene generated by Gemma</h2>
          </div>
          <p>
            The core product move: Gemma does not only explain. It produces a
            structured scene that the extension renders deterministically.
          </p>
          <p className={styles.codeLabel}>
            <span>a2uiScene</span>
            <span>EvidenceCockpit</span>
          </p>
          <pre className={styles.code}>{fmt(a2uiScene)}</pre>
        </section>

        {/* ── §11 Training strategy ──────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 11</span>
            <h2 className={styles.secTitle}>Training strategy</h2>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Goal</th>
                  <th>Data source</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>SFT</td>
                  <td>Teach Gemma the output schema and calibrated voice.</td>
                  <td>ACC verifier packets, template gold outputs.</td>
                  <td>Low</td>
                </tr>
                <tr>
                  <td>Ranking / DPO</td>
                  <td>Prefer grounded, uncertainty-preserving explanations.</td>
                  <td>Multiple Gemma candidates scored by ACC checklists.</td>
                  <td>Medium</td>
                </tr>
                <tr>
                  <td>EpiGNN residual</td>
                  <td>Learn graph-state patterns ACC may miss.</td>
                  <td>Graph snapshots, ACC labels, review outcomes.</td>
                  <td>Medium-high</td>
                </tr>
                <tr>
                  <td>RLVR / process rewards</td>
                  <td>Reward correct intermediate reasoning steps.</td>
                  <td>Verifier checklists over evidence paths.</td>
                  <td>High</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Recommendation: ship <strong>SFT plus verifier-ranked examples</strong>
            {' '}first. Treat RL as future work unless compute and evals are
            stable.
          </p>
        </section>

        {/* ── §12 ACC + EpiGNN fusion ────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 12</span>
            <h2 className={styles.secTitle}>ACC + EpiGNN fusion</h2>
          </div>
          <p>
            ACC stays visible and deterministic. EpiGNN acts as a learned
            residual layer on top.
          </p>
          <pre className={styles.code}>
{`symbolic_score = ACC(graph, claim)
z              = EpiGNN(graph, claim)
learned_delta  = residual_head(z, ACC_traits)
uncertainty    = uncertainty_head(z)
final_risk     = calibrate(symbolic_score + learned_delta, uncertainty)`}
          </pre>
          <p>The UI shows the separation:</p>
          <pre className={styles.code}>
{`{
  "acc_score":          0.47,
  "learned_adjustment": -0.06,
  "uncertainty":        0.24,
  "final_status":       "source-collapsed / under-evidenced"
}`}
          </pre>
        </section>

        {/* ── §13 Generative ACC, safely defined ─────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 13</span>
            <h2 className={styles.secTitle}>Generative ACC, safely defined</h2>
          </div>
          <p>
            A generative verifier may generate hypotheses that require
            verification, but never new truth.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Generated object</th>
                  <th>Safe</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code className={styles.inlineCode}>same_origin_candidate</code></td>
                  <td>Yes</td>
                  <td>&ldquo;These two articles may share the same origin.&rdquo;</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>missing_primary_source_check</code></td>
                  <td>Yes</td>
                  <td>&ldquo;Search for the original filing.&rdquo;</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>claim_decomposition</code></td>
                  <td>Yes</td>
                  <td>&ldquo;Separate the policy-existence claim from the intent claim.&rdquo;</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>fake_supporting_citation</code></td>
                  <td>No</td>
                  <td>Never generate evidence as fact.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── §14 Browser extension surface ──────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 14</span>
            <h2 className={styles.secTitle}>Browser extension surface</h2>
          </div>
          <ol>
            <li>User opens an article.</li>
            <li>ACT extracts candidate claims locally or with a small model.</li>
            <li>The extension builds a page-local claim graph.</li>
            <li>ACC scores the graph.</li>
            <li>Gemma generates the A2UI scene from the verifier packet.</li>
            <li>The user sees claim cards, source collapse warnings, evidence paths, contradictions, and next checks.</li>
          </ol>
          <p>
            Privacy posture: the default demo works locally or with minimal
            hosted fallback, and the user can inspect what text is sent
            anywhere.
          </p>
        </section>

        {/* ── §15 Evaluation plan ────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 15</span>
            <h2 className={styles.secTitle}>Evaluation plan</h2>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Eval</th>
                  <th>What it proves</th>
                  <th>Metric</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Source-collapse benchmark</td>
                  <td>Finds citation laundering.</td>
                  <td>Precision and recall on synthetic plus hand-labeled cases.</td>
                </tr>
                <tr>
                  <td>A2UI schema validity</td>
                  <td>Gemma emits renderable UI.</td>
                  <td>Percent valid scenes.</td>
                </tr>
                <tr>
                  <td>Grounding check</td>
                  <td>Explanations only cite packet facts.</td>
                  <td>Unsupported-claim rate.</td>
                </tr>
                <tr>
                  <td>Calibration set</td>
                  <td>Scores match human review buckets.</td>
                  <td>Reliability curve, Brier score.</td>
                </tr>
                <tr>
                  <td>Browser latency</td>
                  <td>Extension feels usable.</td>
                  <td>Time to first claim card.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The important demo metric is not &ldquo;truth accuracy&rdquo;
            alone. It is <strong>inspectable reasoning quality</strong>.
          </p>
        </section>

        {/* ── §16 Open-source boundary ───────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 16</span>
            <h2 className={styles.secTitle}>Open-source boundary</h2>
          </div>
          <div className={styles.boundary}>
            <div className={styles.boundaryCol}>
              <p className={styles.boundaryHead}>Public</p>
              <ul>
                <li>ACC v2 Python implementation</li>
                <li>ACC JavaScript scorer</li>
                <li>Public claim graph schema</li>
                <li>Browser extension</li>
                <li>A2UI component catalog</li>
                <li>Small synthetic datasets</li>
                <li>Training data generator</li>
                <li>Model card and limitations</li>
              </ul>
            </div>
            <div className={styles.boundaryCol}>
              <p className={styles.boundaryHead}>Private</p>
              <ul>
                <li>Full Theseus research backplane</li>
                <li>Production graph database</li>
                <li>Internal training pipelines</li>
                <li>Memgraph snapshots</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── §17 Limitations ────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 17</span>
            <h2 className={styles.secTitle}>Limitations</h2>
          </div>
          <ul>
            <li>ACC measures evidence structure, not metaphysical truth.</li>
            <li>A claim can be under-evidenced without being false.</li>
            <li>Source independence is hard because origins can be hidden.</li>
            <li>A small browser model may miss nuance during claim extraction.</li>
            <li>EpiGNN residuals must be shown separately from deterministic scores.</li>
            <li>Generated UI must be schema-validated before rendering.</li>
          </ul>
        </section>

        {/* ── §18 Competition build plan ─────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 18</span>
            <h2 className={styles.secTitle}>Competition build plan</h2>
          </div>
          <ol>
            <li>Fix deterministic ACC edge cases around root depth and single-source independence.</li>
            <li>
              Add <code className={styles.inlineCode}>canonical_origin_count</code>,{' '}
              <code className={styles.inlineCode}>source_collapse_ratio</code>, and{' '}
              <code className={styles.inlineCode}>verification_gap</code> to reports.
            </li>
            <li>Build the A2UI component catalog.</li>
            <li>Make Gemma output validated A2UI scenes from verifier packets.</li>
            <li>Create three polished demos: source collapse, unresolved claim, strong support.</li>
            <li>Add a short model card and limitation page.</li>
          </ol>
        </section>

        {/* ── Footer rule ─────────────────────────────────────── */}
        <footer className={styles.foot}>
          <div className={styles.footLeft}>
            Travis Gilbert · Anti-Conspiracy Theorem · v0.4.2
          </div>
          <div className={styles.footCenter}>
            <Link href="/act">← Return to /act</Link>
          </div>
          <div className={styles.footRight}>NB 05 · {today}</div>
        </footer>
      </main>
    </div>
  );
}
