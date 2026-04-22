import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Theseus Plugin SDK · Theseus',
  description:
    'How to build and install a plugin against the SPEC-C plugin runtime.',
};

const RUNTIME_DOC_URL =
  'https://github.com/Travis-Gilbert/Index-API/blob/main/docs/runtime/plugin-runtime-guide.md';

const BASE_ABCS = [
  {
    name: 'ConnectorPlugin',
    purpose:
      'Ingests from an upstream source. Emits IngestionEvent objects which the writeback API turns into Objects, Edges, and Claims.',
  },
  {
    name: 'ScorerPlugin',
    purpose:
      'Contributes a scoring signal to the learned-scorer ensemble. Must be deterministic over an EdgeContext; no synchronous LLM calls.',
  },
  {
    name: 'VerbPlugin',
    purpose:
      'Exposes a single MCP tool + HTTP endpoint + optional public verb page. One VerbPlugin per verb.',
  },
  {
    name: 'SurfacePlugin',
    purpose:
      'Registers Reflex pages, RSS feeds, and JSON-LD context terms under /ext/<slug>/. Pairs with SPEC-A.',
  },
  {
    name: 'TheoremPlugin',
    purpose:
      'SPEC-S. Uses graph-derived structural features as DPO preference oracles to distill compact language models.',
  },
];

/**
 * Theseus Plugin SDK landing page.
 *
 * Intentionally short. The full runtime reference (ABC signatures,
 * lifecycle state machine, capabilities, runner isolation, verification
 * steps) is maintained in the Index-API repo; this page links out to
 * it rather than duplicating the source of truth.
 */
export default function PluginsSdkPage() {
  return (
    <article
      style={{
        maxWidth: 760,
        margin: '40px auto',
        padding: '0 28px',
        color: 'var(--paper-ink)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div
        style={{
          font: '500 11px/1.2 var(--font-mono)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--paper-ink-3)',
        }}
      >
        Plugin SDK
      </div>
      <h1
        style={{
          margin: '6px 0 16px',
          fontFamily: 'var(--font-display)',
          fontSize: 44,
          fontWeight: 500,
          letterSpacing: '-0.015em',
          color: 'var(--paper-ink)',
        }}
      >
        Build against the Theseus plugin runtime
      </h1>

      <p
        style={{
          margin: '0 0 24px',
          fontSize: 17,
          lineHeight: 1.6,
          color: 'var(--paper-ink-2)',
        }}
      >
        The Theseus Index-API ships a single plugin runtime at
        <code
          style={{
            padding: '2px 6px',
            margin: '0 4px',
            background: 'var(--paper-2, rgba(0,0,0,0.04))',
            border: '1px solid var(--paper-rule)',
            borderRadius: 3,
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
          }}
        >
          /api/v2/plugins/
        </code>
        . A plugin is a Python package that declares a
        <code
          style={{
            padding: '2px 6px',
            margin: '0 4px',
            background: 'var(--paper-2, rgba(0,0,0,0.04))',
            border: '1px solid var(--paper-rule)',
            borderRadius: 3,
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
          }}
        >
          theseus.plugins
        </code>
        entry point resolving to a <strong>TheseusPlugin</strong> subclass.
        Discovery happens once at Django startup; there is no dynamic code
        loading.
      </p>

      <h2
        style={{
          marginTop: 32,
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          fontWeight: 500,
          color: 'var(--paper-ink)',
        }}
      >
        The five plugin categories
      </h2>
      <ul style={{ padding: 0, margin: '12px 0', listStyle: 'none' }}>
        {BASE_ABCS.map((abc) => (
          <li
            key={abc.name}
            style={{
              padding: '14px 16px',
              margin: '8px 0',
              border: '1px solid var(--paper-rule)',
              borderRadius: 4,
              background: 'var(--paper-2, rgba(0,0,0,0.02))',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--paper-ink)',
              }}
            >
              {abc.name}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--paper-ink-2)',
              }}
            >
              {abc.purpose}
            </div>
          </li>
        ))}
      </ul>

      <h2
        style={{
          marginTop: 32,
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          fontWeight: 500,
          color: 'var(--paper-ink)',
        }}
      >
        What the runtime gives you
      </h2>
      <ul
        style={{
          margin: '12px 0',
          padding: '0 0 0 20px',
          fontSize: 15,
          lineHeight: 1.7,
          color: 'var(--paper-ink-2)',
        }}
      >
        <li>
          Lifecycle state machine: discovered → enabled ⇄ disabled, with
          failing and quarantined penalty states. Auto-quarantine after 3
          failures in 5 minutes.
        </li>
        <li>
          Capability-based permissions: every plugin declares the subset
          of <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>read_graph</code>,
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}> write_objects</code>,
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}> sign_claims</code>,
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}> train_model</code>,
          … it needs; anything else raises CapabilityDenied.
        </li>
        <li>
          Subprocess runner with memory (resource.setrlimit) and
          wall-clock timeouts. Cgroups unsupported on Railway; the
          reduced isolation is reported honestly via
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}> GET /api/v2/plugins/capabilities</code>.
        </li>
        <li>
          Per-invocation telemetry: every call records a PluginRun
          (hash-only inputs, SPEC-C §3.14) and every exception records a
          PluginFailure.
        </li>
      </ul>

      <h2
        style={{
          marginTop: 32,
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          fontWeight: 500,
          color: 'var(--paper-ink)',
        }}
      >
        Full reference
      </h2>
      <p
        style={{
          margin: '12px 0',
          fontSize: 15,
          lineHeight: 1.6,
          color: 'var(--paper-ink-2)',
        }}
      >
        The canonical runtime reference lives in the Index-API repo. It
        covers every module under
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}> apps/plugins/</code>,
        the API surface at <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>/api/v2/plugins/</code>,
        deferred SPEC-C batches (the <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>theseus-plugin-sdk</code> PyPI package,
        the four connector repos, sigstore supply-chain signing), and the
        verification log.
      </p>

      <a
        href={RUNTIME_DOC_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-block',
          marginTop: 8,
          padding: '10px 18px',
          border: '1px solid var(--paper-pencil)',
          borderRadius: 3,
          color: 'var(--paper-pencil)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textDecoration: 'none',
        }}
      >
        Open the runtime guide on GitHub →
      </a>

      <p
        style={{
          marginTop: 32,
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--paper-ink-3)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.02em',
        }}
      >
        The four reference connectors (Nextcloud, copyparty, Filestash,
        Transmission), the published{' '}
        <code>theseus-plugin-sdk</code> package, and sigstore signing are
        tracked in SPEC-C Batches 3, 6–10. This page will grow an
        inline-rendered version of the guide once those ship.
      </p>
    </article>
  );
}
