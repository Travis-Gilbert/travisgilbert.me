'use client';

import Link from 'next/link';
import styles from './AntiConspiracyPageBlueprint.module.css';

/**
 * /act Blueprint redesign shell.
 *
 * Sibling of AntiConspiracyPage. Only active when ?bp=1 is on the URL.
 * The current parchment page remains the default until the Do Not
 * Downgrade gate (E18) passes and the user explicitly flips the flag.
 *
 * This file ships the foundation: palette + tokens + page frame +
 * masthead + drafting title block + colophon, plus labeled placeholders
 * where the real primitives will be installed in later commits:
 *   E7  TreeView   evidence support tree
 *   E9  FileUpload specimen tray (document intake)
 *   E11 TraitRadar 11-axis drafting compass
 *   E12 EvidenceCockpit fields (claim_state, support_strength,
 *       epistemic_risk, verification_gap)
 *
 * Source of truth: Index-API/docs/plans/act-evidence-cockpit/
 * track-e-public-site-design/{vision-delta,implementation-plan}.md
 */
export default function AntiConspiracyPageBlueprint() {
  return (
    <div className={styles.root}>
      <div className={styles.crosshatch} aria-hidden="true" />

      <div className={styles.topbar}>
        <div className={styles.crumbs}>
          <Link href="/">travisgilbert.me</Link>
          <span className={styles.sep}>/</span>
          <Link href="/projects">projects</Link>
          <span className={styles.sep}>/</span>
          <span className={styles.here}>act</span>
          <span className={styles.sep}>/</span>
          <span className={styles.here}>blueprint</span>
        </div>
        <div className={styles.topbarRight}>
          <span>
            <span className={styles.led} aria-hidden="true" />
            v2.1 BP / field beta
          </span>
        </div>
      </div>

      <div className={styles.page}>
        <span className={`${styles.corner} ${styles.tl}`} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.tr}`} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.bl}`} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.br}`} aria-hidden="true" />

        <header className={styles.masthead}>
          <div>
            <div className={styles.figRibbon}>
              FIG. 04 / ANTI-CONSPIRACY THEOREM / REV. v2.1
            </div>
            <h1 className={styles.title}>Anti-Conspiracy Theorem</h1>
            <p className={styles.lede}>
              A live inspector for the structure of evidence behind a claim. Drop a document
              or paste a URL: the page diagrams the support tree, source independence,
              contradictions, and the next check most likely to resolve uncertainty.
            </p>
            <p className={styles.builtOn}>
              Built on <span className={styles.builtOnName}>Theorem</span>
            </p>
          </div>

          <aside className={styles.titleBlock} aria-label="Drafting title block">
            <div className={styles.titleBlockCell}>
              <span className={styles.titleBlockKey}>Drawing</span>
              <span className={styles.titleBlockVal}>ACT / EvidenceCockpit</span>
            </div>
            <div className={styles.titleBlockCell}>
              <span className={styles.titleBlockKey}>Algorithm</span>
              <span className={styles.titleBlockVal}>ACC v2.1</span>
            </div>
            <div className={styles.titleBlockCell}>
              <span className={styles.titleBlockKey}>Axes</span>
              <span className={styles.titleBlockVal}>11 / 11 active</span>
            </div>
            <div className={styles.titleBlockCell}>
              <span className={styles.titleBlockKey}>Inputs</span>
              <span className={styles.titleBlockVal}>URL · TXT · MD · HTML</span>
            </div>
            <div className={styles.titleBlockCell}>
              <span className={styles.titleBlockKey}>License</span>
              <span className={styles.titleBlockVal}>MIT</span>
            </div>
            <div className={styles.titleBlockCell}>
              <span className={styles.titleBlockKey}>Revision</span>
              <span className={styles.titleBlockVal}>Apr 2026</span>
            </div>
          </aside>
        </header>

        <section className={styles.workbench} aria-label="Workbench">
          <div className={styles.placeholder}>
            <span className={styles.dimensionMark}>A.01 / 280×460</span>
            <span className={styles.placeholderLabel}>Specimen tray</span>
            <h3 className={styles.placeholderTitle}>Drop a document for inspection</h3>
            <p className={styles.placeholderHint}>
              FileUpload primitive is installed in E9. Drag-drop, URL fetch, and paste-text
              intake share this tray. The current default page (without the BP flag)
              continues to serve the same flow until this surface reaches parity.
            </p>
          </div>

          <div className={styles.placeholder}>
            <span className={styles.dimensionMark}>A.02 / 240×460</span>
            <span className={styles.placeholderLabel}>Trace detail</span>
            <h3 className={styles.placeholderTitle}>Inspection readout</h3>
            <p className={styles.placeholderHint}>
              Per-claim rules, penalties, and the next-check ribbon appear here. EvidenceCockpit
              fields land in E12: claim_state, support_strength, epistemic_risk, verification_gap.
            </p>
          </div>
        </section>

        <section className={styles.workbench} aria-label="Diagrams">
          <div className={styles.placeholder} style={{ minHeight: 360 }}>
            <span className={styles.dimensionMark}>B.01 / 480×360</span>
            <span className={styles.placeholderLabel}>Support tree</span>
            <h3 className={styles.placeholderTitle}>Evidence support diagram</h3>
            <p className={styles.placeholderHint}>
              TreeView primitive is installed in E7. The diagram traces the support paths from
              claim root, through citation branches, to canonical origins. Selecting a node
              highlights its provenance.
            </p>
          </div>

          <div className={styles.placeholder} style={{ minHeight: 360 }}>
            <span className={styles.dimensionMark}>B.02 / 360×360</span>
            <span className={styles.placeholderLabel}>Trait radar</span>
            <h3 className={styles.placeholderTitle}>11-axis drafting compass</h3>
            <p className={styles.placeholderHint}>
              TraitRadar primitive is built in E11. All eleven first-class ACC traits plot on
              a hairline polar grid with their default weights and computed values.
            </p>
          </div>
        </section>

        <div className={styles.sectionHead}>
          <span className={styles.sectionHeadNum}>§ 02</span>
          <h2>How information is scored</h2>
          <span className={styles.sectionHeadStatus}>11 axes</span>
        </div>

        <div className={styles.method}>
          <div className={styles.step}>
            <div className={styles.stepNum}>01 / EVIDENCE SHAPE</div>
            <h4>What is holding the claim up?</h4>
            <p>
              Each claim is matched against citations, links, and anecdote. A claim with a
              single anecdote loses points; one with three independent sources gains them.
            </p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNum}>02 / SOURCE DIVERSITY</div>
            <h4>Who else says so?</h4>
            <p>
              The lab walks outbound links and counts independent canonical origins. A
              citation chain that traces back to one source is flagged as collapsed.
            </p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNum}>03 / FALSIFIABILITY</div>
            <h4>Could it be wrong?</h4>
            <p>
              Claims that volunteer specific anchors, numbers, dates, named entities, score
              higher than untestable ones. Pure value claims are noted but not scored.
            </p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNum}>04 / RHETORICAL PRESSURE</div>
            <h4>Tone vs. substance</h4>
            <p>
              Loaded language, urgency, identity threats are weighed against the substance
              underneath. High pressure plus thin evidence triggers a penalty.
            </p>
          </div>
        </div>

        <footer className={styles.colophon}>
          <span>
            <span className={styles.colophonName}>TRAVIS GILBERT</span> · Anti-Conspiracy Theorem · v2.1 BP
          </span>
          <span>
            Built on <span className={styles.colophonName}>Theorem</span>
          </span>
          <span>Fig. 04 · Apr 2026</span>
        </footer>
      </div>

      <span className={styles.variantBadge} aria-label="Blueprint variant active">
        BP / FLAG ?bp=1 / SHELL ONLY
      </span>
    </div>
  );
}
