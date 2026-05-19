/**
 * TechnicalNotebook
 *
 * Renders the ACT technical notebook at /act/notebook in the Retro Lab
 * register used by /act. The content here is the prose version of the
 * notebook delivered as `Index-API/act-technical-notebook.md` (updated
 * May 18, 2026; tracks ACC v2.1.0 and extension v0.2.0).
 *
 * Content lives entirely in this one file. Future swaps replace the
 * sections below; the page chrome (breadcrumb, title block, hero,
 * section frame, footer) is the stable surface.
 */

import Link from 'next/link';
import styles from './TechnicalNotebook.module.css';

const ACC_VERSION = '2.1.0';
const EXTENSION_VERSION = '0.2.0';
const NOTEBOOK_REVISION = 'May 18, 2026';
const LATEST_COMMIT = 'fbb311e';

export default function TechnicalNotebook() {
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
            ANTI-CONSPIRACY THEOREM
            <span className={styles.sub}>
              Technical notebook. ACC v{ACC_VERSION}, extension v{EXTENSION_VERSION}.
              Gemma 4 for Good submission.
            </span>
          </div>
          <div className={styles.right}>
            <div>ACC v{ACC_VERSION}</div>
            <div>EXT v{EXTENSION_VERSION}</div>
            <div>{NOTEBOOK_REVISION.toUpperCase()}</div>
          </div>
        </section>

        {/* ── Thesis hero ─────────────────────────────────────── */}
        <div className={styles.hero}>
          <span className={styles.heroLabel}>Thesis</span>
          <p className={styles.heroText}>
            <span className={styles.heroEm}>
              A small Gemma model should not decide what is true.
            </span>
            It should generate an inspectable interface from a graph-verifier
            packet, and let a deterministic scorer carry the load it was never
            built for. Models hallucinate. Graphs do not. ACT is the working
            version of that separation.
          </p>
        </div>

        {/* ── §1 Project snapshot ─────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 01</span>
            <h2 className={styles.secTitle}>Project snapshot</h2>
          </div>
          <p>
            ACT is the working version of the Anti-Conspiracy Constraint
            (ACC), a structural-integrity score for claim graphs. It does
            not ask whether a claim is popular, viral, or written
            confidently. It asks whether the claim is rooted, independently
            supported, specific, temporally spread, backed by enough
            evidence volume, free of collapsed citation loops, falsifiable,
            and not propped up by rhetorical pressure.
          </p>
          <p>
            Gemma 4 does the parts a graph cannot: it reads a page,
            extracts claims and sources, and renders the verifier packet
            into a human-legible cockpit. Gemma never overwrites the score.
            This separation is the whole architectural argument.
          </p>
          <div className={styles.pillRow}>
            <span className={styles.pill}>ACC v{ACC_VERSION}</span>
            <span className={styles.pill}>Extension v{EXTENSION_VERSION}</span>
            <span className={styles.pill}>Gemma 4 E4B</span>
            <span className={styles.pill}>WebLLM</span>
            <span className={styles.pill}>11-axis graph</span>
            <span className={styles.pill}>A2UI scene generation</span>
            <span className={styles.pill}>Local-first</span>
            <span className={styles.pill}>commit {LATEST_COMMIT}</span>
          </div>
        </section>

        {/* ── §2 The real-world problem ───────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 02</span>
            <h2 className={styles.secTitle}>The real-world problem</h2>
          </div>
          <p>
            The post-2020 information environment broke a load-bearing
            assumption: that a citation, by existing, contributes evidence.
            A single primary source can now be laundered through hundreds
            of secondary outlets and arrive in a feed looking like
            consensus. Standard fact-check UX treats each claim as a
            yes/no verdict, which collapses uncertainty and loses the
            structural reasons a claim is weak. Readers cannot tell the
            difference between <em>false</em>, <em>under-evidenced</em>,
            <em> source-collapsed</em>, and <em>contradicted</em>. All
            four read as &ldquo;flagged.&rdquo;
          </p>
          <p>
            The cost of this collapse is concrete: people stop reading
            interfaces that punish them with low-information verdicts, and
            the readers best positioned to update their priors &mdash; undecideds,
            skeptics, the merely curious &mdash; disengage first.
          </p>
          <p>ACT targets that gap with three commitments:</p>
          <ol>
            <li>
              <strong>Don&rsquo;t decide truth.</strong> Decide structural
              integrity. Make the structure visible.
            </li>
            <li>
              <strong>Run on the user&rsquo;s device.</strong> A
              page-analysis tool that phones home is a tool that won&rsquo;t
              be trusted by the audience that most needs it.
            </li>
            <li>
              <strong>Make the small model do small-model work.</strong>
              {' '}Extraction, classification, and explanation &mdash; not
              adjudication.
            </li>
          </ol>
        </section>

        {/* ── §3 How ACT uses Gemma 4 ─────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 03</span>
            <h2 className={styles.secTitle}>How ACT uses Gemma 4</h2>
          </div>
          <p>
            Gemma 4 lives in the browser extension&rsquo;s inference layer
            (<code className={styles.inlineCode}>browser-extension/src/inference/</code>).
            It runs through WebLLM, with the model artifact served from a
            hosted <code className={styles.inlineCode}>/act</code> route and a
            public WebLLM model as preflight fallback. The runner is a
            singleton, so a single download per session covers all
            subsequent page analyses.
          </p>
          <p>Gemma is used in three bounded jobs:</p>
          <ol>
            <li>
              <strong>Content-type classification.</strong> Before
              extraction, Gemma decides whether the active page is news,
              opinion, scientific writeup, social post, or non-content.
              This routes the extractor&rsquo;s prompt and prevents the
              system from treating a recipe page like a press release.
            </li>
            <li>
              <strong>Claim and evidence extraction.</strong> Gemma reads
              paragraphs from the active tab and emits structured claim
              nodes, source nodes, and evidence snippets that conform to
              the ACC graph schema. Gemma is the only component that
              touches raw natural language. Output is JSON-validated
              before it reaches the scorer.
            </li>
            <li>
              <strong>A2UI scene explanation.</strong> Once the
              deterministic builder has emitted a scene, Gemma may rewrite
              explanation cells &mdash; never scores, never component types,
              never trait values. A strict validator
              (<code className={styles.inlineCode}>schemaValidator.js</code> in
              the extension, <code className={styles.inlineCode}>validate_evidence_scene</code>{' '}
              in Python) rejects any Gemma output that drops props, alters
              ACC scores, or invents component types. The
              CalibrationBadge&rsquo;s <code className={styles.inlineCode}>source</code>
              {' '}field flips from <code className={styles.inlineCode}>deterministic</code>
              {' '}to <code className={styles.inlineCode}>model-adjusted</code> the
              moment Gemma touches a cell, so the reader sees the
              provenance.
            </li>
          </ol>
          <p>What Gemma is <strong>not</strong> used for:</p>
          <ul>
            <li>Deciding whether a claim is true.</li>
            <li>Computing trait values or weights.</li>
            <li>Producing the final ACC score.</li>
            <li>
              Promoting itself &mdash; there is no path by which Gemma&rsquo;s
              output can mutate the live threshold or trait weights.
            </li>
          </ul>
          <p>
            This is the deliberate boundary. The model is a renderer with
            high-bandwidth I/O. The scorer is the judge.
          </p>
        </section>

        {/* ── §4 System architecture ──────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 04</span>
            <h2 className={styles.secTitle}>System architecture</h2>
          </div>
          <p className={styles.codeLabel}>
            <span>pipeline</span>
            <span>active page → cockpit</span>
          </p>
          <pre className={styles.code}>
{`Active browser page
  │
  ▼
Content script: paragraph extraction
  │
  ▼
WebLLM (Gemma 4): content-type classification
  │
  ▼
WebLLM (Gemma 4): claim / evidence / source extraction → claim graph
  │
  ▼  (optional)
Tavily or Theseus web-search enrichment for top claims
  │
  ▼
Deterministic ACC v2.1 scorer  ──►  per-claim report
  │                                  (linear_score, geometric_core,
  │                                   penalty_total, rules, penalties,
  │                                   actions, claim_state,
  │                                   support_strength, epistemic_risk,
  │                                   verification_gap, diagnostics)
  ▼
A2UI scene builder  ──►  EvidenceCockpit JSON scene
  │
  ▼
WebLLM (Gemma 4): explanation cells only (validator-gated)
  │
  ▼
Browser cockpit renders the scene`}
          </pre>
          <p>
            Two implementations of the scorer ship in the repo and produce
            byte-identical outputs against contract tests:
          </p>
          <ul>
            <li>
              <strong>Python reference</strong> &mdash;{' '}
              <code className={styles.inlineCode}>theseus_acc/</code> package.
              NetworkX graphs in, full report out. This is the source of
              truth for behavior and the basis for benchmarks.
            </li>
            <li>
              <strong>JavaScript port</strong> &mdash; embedded in the extension.
              Same eleven traits, same weights, same rules and penalties,
              same diagnostics. Runs entirely in the extension process.
              Validated against Python-generated fixtures.
            </li>
          </ul>
          <p>
            The user can also run the extension installer with no model
            load at all. The deterministic path produces a complete ACC
            v2.1 report; Gemma&rsquo;s contribution is restricted to
            extraction (when input is page text rather than a pre-built
            graph) and explanation.
          </p>

          <h3 className={styles.subTitle}>Three runtime surfaces inside the extension</h3>
          <p>
            The Manifest V3 extension is split into three surfaces, each
            with a single responsibility. This separation is the reason
            the &ldquo;no telemetry, model loads only on user
            action&rdquo; guarantee is enforceable rather than a promise:
          </p>
          <ul>
            <li>
              <code className={styles.inlineCode}>src/background/service-worker.js</code>{' '}
              &mdash; coordinates model loading, active-tab analysis, Tavily and
              Theseus enrichment, deterministic scoring, and federation
              processing. The service worker owns the singleton{' '}
              <code className={styles.inlineCode}>MLCRunner</code>; nothing else
              can spin up a second model instance.
            </li>
            <li>
              <code className={styles.inlineCode}>src/content/content-script.js</code>{' '}
              &mdash; extracts visible page text and renders the claim marker rail
              in an isolated DOM. Page text never leaves this surface unless
              the user has explicitly enabled enrichment.
            </li>
            <li>
              <code className={styles.inlineCode}>src/popup/popup.js</code> &mdash;
              onboarding, model progress, analysis controls, settings, and the
              result summary. This is the only surface that can issue{' '}
              <code className={styles.inlineCode}>MSG_START_MODEL_LOAD</code>; the
              model cannot download without a user gesture in this UI.
            </li>
          </ul>
          <p>
            The pipeline reads cleanly as a message-passing flow:{' '}
            <code className={styles.inlineCode}>MSG_START_MODEL_LOAD</code> →{' '}
            <code className={styles.inlineCode}>MLCRunner</code> preflights the
            configured WebLLM route and falls back to the public model
            when allowed →{' '}
            <code className={styles.inlineCode}>MSG_ANALYZE_PAGE</code> collects
            page text from the content script → WebLLM classifies content
            type and extracts ACC feature JSON → optional enrichment via{' '}
            <code className={styles.inlineCode}>tavily-client.js</code> →{' '}
            <code className={styles.inlineCode}>inference/scoring.js</code>{' '}
            computes ACC v2.1 locally → federation processing adds
            correlation badge data → the content script paints the rail
            back onto the page.
          </p>

          <h3 className={styles.subTitle}>Federation: aggregation without leakage</h3>
          <p>
            The federation processor is opt-in and structurally incapable
            of leaking page content. When enabled, it transmits{' '}
            <strong>only</strong>:
          </p>
          <ul>
            <li>ACC feature bins (binned trait values, not raw scores)</li>
            <li>Score components (linear, geometric, penalty totals)</li>
            <li>Content type from the Gemma classification</li>
            <li>Cluster metadata</li>
            <li>Public key plus signature</li>
          </ul>
          <p>
            It explicitly does <strong>not</strong> transmit article text,
            claim text, page URL, or page content. This is the same
            boundary discipline as the Gemma-output validator and the
            outcome-layer &ldquo;propose, never mutate&rdquo; rule: shared
            state across users is bounded to the minimum information
            needed for aggregation, and every share is signed so an
            aggregator can detect replay or tampering without recovering
            the originating page.
          </p>
          <p>
            Federation is the path to a network effect that does not
            require trusting a central server with reader behavior. It is
            the version of &ldquo;this gets smarter as more people use
            it&rdquo; that does not silently compromise its own privacy
            posture.
          </p>
        </section>

        {/* ── §5 ACC v2.1: the algorithm ──────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 05</span>
            <h2 className={styles.secTitle}>ACC v2.1: the algorithm</h2>
          </div>
          <p>The score per claim:</p>
          <pre className={styles.code}>
{`ACC(c) = linear_score(c) + geometric_core(c) − penalty_total(c)`}
          </pre>
          <p>
            <code className={styles.inlineCode}>linear_score</code> is a
            weighted sum over eleven normalized traits.{' '}
            <code className={styles.inlineCode}>geometric_core</code> is a
            nonlinear combination that punishes claims passing on a single
            dominant trait while failing others &mdash; a structurally weak
            claim cannot ride one strong signal across the line.{' '}
            <code className={styles.inlineCode}>penalty_total</code>{' '}
            aggregates deterministic symbolic penalties (single-source
            collapse, citation chain collapse, contradiction load above
            threshold). Claims with <code className={styles.inlineCode}>ACC
            &lt; threshold</code> (default <code className={styles.inlineCode}>0.55</code>)
            are flagged <code className={styles.inlineCode}>suspect</code>.
          </p>

          <h3 className={styles.subTitle}>The eleven traits</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Trait</th>
                  <th>Weight</th>
                  <th>What it measures</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code className={styles.inlineCode}>root_depth</code></td>
                  <td>0.140</td>
                  <td>Distance from the claim to a verified or canonical root in the graph.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>source_independence</code></td>
                  <td>0.140</td>
                  <td>Diversity of canonical origins among supporting sources.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>support_ratio</code></td>
                  <td>0.105</td>
                  <td>Supporting evidence relative to total evidence, including contradictions.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>temporal_spread</code></td>
                  <td>0.126</td>
                  <td>Distribution of supporting evidence over time vs. single burst.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>evidence_volume</code></td>
                  <td>0.105</td>
                  <td>Raw count of distinct evidence snippets, saturated to prevent gaming.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>claim_specificity</code></td>
                  <td>0.084</td>
                  <td>Specificity of claim language: named entities, dates, units, numbers.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>falsifiability</code></td>
                  <td>0.060</td>
                  <td>Whether the claim admits a structurally defined disproof condition.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>rhetorical_pressure</code></td>
                  <td>0.060</td>
                  <td>Inverse weight on persuasion markers: intensifiers, certainty signaling.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>source_quality</code></td>
                  <td>0.060</td>
                  <td>Domain-list lookup against the bundled <code className={styles.inlineCode}>domains_v1.json</code> quality table.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>contradiction_load</code></td>
                  <td>0.060</td>
                  <td>Inverse weight on the count and weight of contradicting evidence.</td>
                </tr>
                <tr>
                  <td><code className={styles.inlineCode}>citation_chain_collapse</code></td>
                  <td>0.060</td>
                  <td>Penalty signal for citation chains terminating in a single canonical origin.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Weights sum to 1.000. The geometric core uses the same trait
            vector but with a stricter aggregation that prevents
            single-dimension dominance.
          </p>

          <h3 className={styles.subTitle}>Per-claim report shape</h3>
          <p>Every claim emits a structured report:</p>
          <pre className={styles.code}>
{`linear_score · geometric_core · penalty_total
rules        · penalties      · actions
support_strength · epistemic_risk
claim_state  · verification_gap
diagnostics`}
          </pre>
          <p>
            <code className={styles.inlineCode}>claim_state</code> is one of:{' '}
            <code className={styles.inlineCode}>well_supported</code>,{' '}
            <code className={styles.inlineCode}>source_collapsed</code>,{' '}
            <code className={styles.inlineCode}>contradicted</code>,{' '}
            <code className={styles.inlineCode}>under_evidenced</code>,{' '}
            <code className={styles.inlineCode}>rootless</code>,{' '}
            <code className={styles.inlineCode}>vague</code>,{' '}
            <code className={styles.inlineCode}>suspect</code>,{' '}
            <code className={styles.inlineCode}>unresolved</code>. This is
            the field that does the UI work the old yes/no fact-check
            could not do.
          </p>

          <h3 className={styles.subTitle}>The outcome layer</h3>
          <p>
            <code className={styles.inlineCode}>theseus_acc.outcomes</code>{' '}
            records every deterministic ACC decision alongside any later
            outcome label (editor verdict, retraction, correction). From
            replayed outcomes it can propose a calibrated threshold &mdash; but
            it cannot rewrite weights, mutate the live threshold, or
            promote itself automatically. Recalibration is a reviewable
            PR, not a runtime side effect. This is the same safety
            boundary as the Gemma-output validator: nothing
            model-adjacent gets to touch the scorer behind the user&rsquo;s
            back.
          </p>
        </section>

        {/* ── §6 A2UI: the verifier packet as an interface ────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 06</span>
            <h2 className={styles.secTitle}>A2UI: the verifier packet as an interface</h2>
          </div>
          <p>
            <code className={styles.inlineCode}>docs/a2ui-scene-schema.md</code>{' '}
            defines the EvidenceCockpit scene contract. The deterministic
            builder{' '}
            <code className={styles.inlineCode}>theseus_acc.a2ui.build_evidence_scene</code>
            {' '}produces a JSON envelope:
          </p>
          <p className={styles.codeLabel}>
            <span>EvidenceCockpit envelope</span>
            <span>v0.1.0</span>
          </p>
          <pre className={styles.code}>
{`{
  "scene": "EvidenceCockpit",
  "version": "0.1.0",
  "acc_version": "2.1.0",
  "claim_count": N,
  "threshold": 0.55,
  "summary": "",
  "components": [ ... ]
}`}
          </pre>
          <p>
            Each claim contributes a ClaimCard, TraitRadar, RuleChecklist,
            NextChecks, and CalibrationBadge. SourceCollapsePanel,
            PenaltyList, and ContradictionPanel are conditional &mdash; they
            only appear when the underlying signal is non-trivial, which
            keeps the cockpit from screaming about penalties that did not
            fire.
          </p>
          <p>
            Component IDs follow{' '}
            <code className={styles.inlineCode}>&lt;Type&gt;.&lt;claim_id&gt;</code>{' '}
            so the renderer can recover ownership without walking props.
            The validator is the security boundary: it rejects unknown
            component types, missing required props, wrong scene name,
            claim-count mismatches, and any{' '}
            <code className={styles.inlineCode}>CalibrationBadge.source</code>
            {' '}value other than <code className={styles.inlineCode}>deterministic</code>{' '}
            or <code className={styles.inlineCode}>model-adjusted</code>.
            Tests in <code className={styles.inlineCode}>tests/test_a2ui_scene.py</code>
            {' '}enumerate every rejection condition.
          </p>
          <p>
            This is the architectural payoff. The score lives in
            deterministic Python and JavaScript. The scene lives in JSON.
            Gemma renders the explanation, and only the explanation,
            against a schema that knows exactly what it is allowed to
            change.
          </p>
        </section>

        {/* ── §7 Engineering decisions and trade-offs ────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 07</span>
            <h2 className={styles.secTitle}>Engineering decisions and trade-offs</h2>
          </div>
          <p>
            <strong>On-device by default.</strong> WebLLM was chosen over
            a hosted inference endpoint because the audience that most
            needs ACT is the audience that least trusts a server-side
            fact-checker. The cost is a one-time model download per
            session; the benefit is that no page text ever leaves the
            browser unless the user explicitly enables Tavily or Theseus
            enrichment with their own credentials.
          </p>
          <p>
            <strong>Two implementations, one contract.</strong> The Python
            package is the source of truth for behavior; the JavaScript
            port is the deployment target. Both score the same fixtures
            to identical output. Contract tests run in CI. This is more
            code to maintain, but it means the browser extension can ship
            without any server dependency for the core scoring path.
          </p>
          <p>
            <strong>Geometric core, not just a weighted sum.</strong> A
            linear-only score lets a single dominant trait carry a
            structurally weak claim across the threshold. The geometric
            core punishes that. The cost is interpretive: explaining
            &ldquo;this claim scored 0.71 linearly but 0.43
            geometrically&rdquo; requires the cockpit to actually show
            both. The A2UI scene&rsquo;s TraitRadar and CalibrationBadge
            are how that explanation gets carried.
          </p>
          <p>
            <strong>Eleven traits, not five.</strong> ACC v2 had six
            traits. v2.1 added falsifiability, rhetorical_pressure,
            source_quality, contradiction_load, and citation_chain_collapse
            after the synthetic adversarial family in the benchmarks
            revealed that the v2 vector could be gamed by stacking
            specificity and temporal spread on a claim with no real
            evidence backbone. The new traits close those holes. The cost
            is more annotation surface in the graph schema; the synthetic
            generator was extended to match.
          </p>
          <p>
            <strong>No automatic threshold mutation.</strong> The outcome
            layer can propose a calibration but never apply one.
            Reviewable calibration is slower than runtime self-adjustment.
            It is also the only version of &ldquo;learning from
            outcomes&rdquo; that is safe to ship to an audience that does
            not trust the people running the system.
          </p>
        </section>

        {/* ── §8 Challenges and mitigations ────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 08</span>
            <h2 className={styles.secTitle}>Challenges and mitigations</h2>
          </div>
          <p>
            <strong>Model output drift.</strong> Early Gemma extraction
            runs produced JSON that was usually valid but occasionally
            invented sources or merged claims. The mitigation is a hard
            validator at the boundary: extraction output is parsed against
            a schema, and any failure rejects the entire packet and falls
            back to a deterministic chunked-paragraph heuristic. The
            system always produces <em>some</em> graph; the worst case is
            a thinner one.
          </p>
          <p>
            <strong>WebLLM cold start.</strong> Loading the model the
            first time a user opens the popup is a noticeable wait. The
            mitigation is a deterministic-first analysis path &mdash; the user
            can analyze pages with no model load at all, and the model
            load is gated behind an explicit user action with progress
            feedback.
          </p>
          <p>
            <strong>Chrome Web Store policy on remote WebAssembly.</strong>
            {' '}Manifest V3 disallows remotely hosted executable logic.
            The WebLLM runtime itself is bundled with the extension, but
            the configured model <code className={styles.inlineCode}>.wasm</code>
            {' '}library currently loads from a remote host &mdash; which means
            it must be treated as policy-sensitive executable code until
            proven otherwise.{' '}
            <code className={styles.inlineCode}>browser-extension/docs/CHROME_WEB_STORE.md</code>
            {' '}documents two acceptable paths to public store submission:
            (1) package the WebLLM <code className={styles.inlineCode}>.wasm</code>
            {' '}library inside the extension ZIP and reference it with an
            extension-local URL, or (2) ship a store-specific build that
            disables WebLLM and exposes only the deterministic local
            scorer plus optional user-enabled search enrichment. The
            deterministic path produces a complete ACC v2.1 report on its
            own, so option (2) is a fully functional fallback. The judging
            artifact in this submission is the unpacked extension loaded
            via Developer mode, which has no such restriction.
          </p>
          <p>
            <strong>Adversarial benchmarks.</strong> The synthetic
            generator produces four families: clean, suspect, mixed, and
            adversarial. The adversarial family specifically targets
            claims that look strong on a single dimension. ACC v2.1&rsquo;s
            penalty system was redesigned around what the adversarial
            family kept getting past v2.
          </p>
        </section>

        {/* ── §9 Why these design choices fit the problem ─────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 09</span>
            <h2 className={styles.secTitle}>Why these design choices fit the problem</h2>
          </div>
          <p>
            The problem is not &ldquo;we need a better truth oracle.&rdquo;
            The problem is that the audience that needs evidence-literacy
            tooling does not trust opaque verdicts, server-side processing,
            or anything that looks like the existing fact-check apparatus.
            ACT&rsquo;s design is shaped almost entirely by that
            constraint:
          </p>
          <ul>
            <li>Deterministic scoring means the score is auditable and reproducible.</li>
            <li>Local-first inference means the user keeps control of their page text.</li>
            <li>A small Gemma model in a narrow role means inference is feasible on consumer hardware.</li>
            <li>The A2UI cockpit means the user sees <em>why</em> a claim got the score it did, not just the verdict.</li>
            <li>The reviewable outcome layer means the system can improve without quietly retraining itself behind users.</li>
          </ul>
          <p>
            The Gemma 4 for Good framing is the right one because the win
            here is not raw capability &mdash; it is what becomes possible when
            a small model is constrained to honest, bounded work and a
            deterministic system carries the responsibility for
            adjudication.
          </p>
        </section>

        {/* ── §10 How to run ──────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 10</span>
            <h2 className={styles.secTitle}>How to run</h2>
          </div>
          <p className={styles.codeLabel}>
            <span>Python reference</span>
            <span>theseus_acc</span>
          </p>
          <pre className={styles.code}>
{`python -m pip install -e ".[dev]"
python -m theseus_acc.benchmarks.synthetic --full
python -m pytest`}
          </pre>
          <p className={styles.codeLabel}>
            <span>Browser extension (judges)</span>
            <span>npx installer</span>
          </p>
          <pre className={styles.code}>
{`npx act-theorem install --out ./anti-conspirarcy-theorem-extension
# Then chrome://extensions → Developer mode → Load unpacked`}
          </pre>
          <p className={styles.codeLabel}>
            <span>Browser extension (local checkout)</span>
            <span>repo build</span>
          </p>
          <pre className={styles.code}>
{`cd browser-extension
npm ci
npm run package
# load browser-extension/release/anti-conspirarcy-theorem-extension.zip`}
          </pre>
          <p>
            Once loaded, click the extension icon, run analysis on the
            active tab, and (optionally) start the WebLLM model load to
            enable Gemma-driven extraction and explanation.
          </p>
        </section>

        {/* ── §11 What is public and what is not ──────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 11</span>
            <h2 className={styles.secTitle}>What is public and what is not</h2>
          </div>
          <div className={styles.boundary}>
            <div className={styles.boundaryCol}>
              <p className={styles.boundaryHead}>Public, MIT-licensed</p>
              <ul>
                <li>ACC v2.1 Python reference implementation (<code className={styles.inlineCode}>theseus_acc/</code>)</li>
                <li>JavaScript scorer port (<code className={styles.inlineCode}>browser-extension/src/</code>)</li>
                <li>Manifest V3 browser extension (three runtime surfaces: service worker, content script, popup)</li>
                <li>NPX installer (<code className={styles.inlineCode}>act-theorem</code>)</li>
                <li>A2UI scene schema, builder, and validator (Python + JavaScript mirror)</li>
                <li>Privacy-preserving federation processor</li>
                <li>Synthetic benchmark generator and four-family eval harness</li>
                <li>Outcome layer and threshold calibration tooling</li>
                <li>Eleven-trait domain list lookup data</li>
                <li>Contract tests across Python ↔ JavaScript</li>
                <li>Chrome Web Store readiness documentation</li>
              </ul>
            </div>
            <div className={styles.boundaryCol}>
              <p className={styles.boundaryHead}>Not public</p>
              <ul>
                <li>The full Theseus research backplane that produced the ACC trait vector.</li>
              </ul>
              <p style={{ marginTop: 12, fontStyle: 'italic', fontSize: 13 }}>
                The split is intentional. The theorem is the contribution. The
                research that produced the theorem stays in its own repo.
              </p>
            </div>
          </div>
        </section>

        {/* ── §12 Acknowledgements ────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.secNum}>§ 12</span>
            <h2 className={styles.secTitle}>Acknowledgements</h2>
          </div>
          <p>
            ACC v2.1 owes its structure to the Theseus epistemic engine
            work that preceded it. The adversarial benchmark family is
            what forced the move from six traits to eleven. Every reader
            who told me a fact-check verdict felt useless is in some
            small way responsible for the cockpit existing at all.
          </p>
        </section>

        {/* ── Footer rule ─────────────────────────────────────── */}
        <footer className={styles.foot}>
          <div className={styles.footLeft}>
            Travis Gilbert · Anti-Conspiracy Theorem · v{EXTENSION_VERSION}
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
