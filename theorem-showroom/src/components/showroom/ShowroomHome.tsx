import Link from "next/link";
import type { OperationState, ShowroomSnapshot } from "@/lib/showroom-data";
import { summarizeRun } from "@/lib/showroom-data";
import { creditDefinition } from "@/lib/pricing";

interface ShowroomHomeProps {
  readonly snapshot: ShowroomSnapshot;
}

const modes = [
  { value: "fractal", label: "Fractal expansion" },
  { value: "code", label: "Code crawler" },
  { value: "provenance", label: "Provenance trace" },
  { value: "memory", label: "Memory recall" },
] as const;

export function ShowroomHome({ snapshot }: ShowroomHomeProps) {
  return (
    <main className="page-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true" />
          <span>Theorem's Harness</span>
        </Link>
        <nav aria-label="Primary">
          <Link href="#playground">Playground</Link>
          <Link href="#gallery">Gallery</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <h1>Theorem's Harness</h1>
          <p>
            The open coordination layer where Claude Code, Codex, and the Context Theorem SDK
            work against the same memory, run traces, and public graph.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="#playground">
              Run public query
            </Link>
            <Link className="button button-secondary" href="/pricing">
              View credits
            </Link>
          </div>
        </div>

        <div className="coordination-console" aria-label="Live coordination status">
          <div className="console-header">
            <span>coordination/live</span>
            <span>{creditDefinition}</span>
          </div>
          <div className="actor-grid">
            <StatusPanel label="Codex" state={snapshot.coordination.codex} />
            <StatusPanel label="Claude Code" state={snapshot.coordination.claudeCode} />
          </div>
          <ResultPanel state={snapshot.coordination.mentions} compact />
        </div>
      </section>

      <section className="section-grid" id="playground">
        <div>
          <h2>Public playground</h2>
          <p>
            Run the same SDK surfaces the agents use. Results come from the configured
            harness endpoint, with empty states when the public corpus has nothing to return.
          </p>
        </div>
        <form className="query-panel" action="/" method="get">
          <div className="mode-row">
            {modes.map((mode) => (
              <label key={mode.value} className="mode-option">
                <input
                  type="radio"
                  name="mode"
                  value={mode.value}
                  defaultChecked={snapshot.mode === mode.value}
                />
                <span>{mode.label}</span>
              </label>
            ))}
          </div>
          <label className="field">
            <span>Query</span>
            <input name="query" defaultValue={snapshot.query} placeholder="pairformer adapter review" />
          </label>
          <label className="field">
            <span>Repository for code crawler</span>
            <input name="repo" defaultValue={snapshot.repo} placeholder="owner/repo" />
          </label>
          <button className="button button-primary" type="submit">
            Run query
          </button>
        </form>
        <ResultPanel state={snapshot.playground} />
      </section>

      <section className="section-grid" id="gallery">
        <div>
          <h2>Run gallery</h2>
          <p>
            Completed public harness runs become inspectable artifacts with replayable timelines.
          </p>
        </div>
        <GalleryPanel state={snapshot.gallery} />
      </section>
    </main>
  );
}

function StatusPanel({ label, state }: { readonly label: string; readonly state: OperationState }) {
  return (
    <div className={`status-panel status-${state.state}`}>
      <div className="status-heading">
        <span>{label}</span>
        <span>{state.state}</span>
      </div>
      <p>{state.detail}</p>
    </div>
  );
}

function ResultPanel({
  state,
  compact = false,
}: {
  readonly state: OperationState;
  readonly compact?: boolean;
}) {
  return (
    <div className={`result-panel result-${state.state} ${compact ? "result-compact" : ""}`}>
      <div className="result-heading">
        <span>{state.title}</span>
        <span>{state.state}</span>
      </div>
      <p>{state.detail}</p>
      {state.payload ? <pre>{JSON.stringify(state.payload, null, 2).slice(0, compact ? 700 : 1800)}</pre> : null}
    </div>
  );
}

function GalleryPanel({ state }: { readonly state: OperationState }) {
  if (!Array.isArray(state.payload)) {
    return <ResultPanel state={state} />;
  }

  const runs = state.payload.map((run) => summarizeRun(run));
  if (runs.length === 0) {
    return <ResultPanel state={{ ...state, state: "empty" }} />;
  }

  return (
    <div className="gallery-list">
      {runs.map((run) => (
        <article className="run-row" key={run.id}>
          <span>{run.title}</span>
          <span>{run.actor}</span>
          <span>{run.status}</span>
        </article>
      ))}
    </div>
  );
}
