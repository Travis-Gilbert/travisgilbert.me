import type { HarnessRun } from "@context/theorem";
import { createTheoremClient, publicTenantSlug } from "@/lib/theorem-client";

export type PlaygroundMode = "fractal" | "code" | "provenance" | "memory";

export interface OperationState {
  readonly state: "idle" | "ready" | "empty" | "error";
  readonly title: string;
  readonly detail: string;
  readonly payload?: unknown;
}

export interface CoordinationSnapshot {
  readonly codex: OperationState;
  readonly claudeCode: OperationState;
  readonly mentions: OperationState;
}

export interface ShowroomSnapshot {
  readonly coordination: CoordinationSnapshot;
  readonly playground: OperationState;
  readonly gallery: OperationState;
  readonly mode: PlaygroundMode;
  readonly query: string;
  readonly repo: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined, fallback = "") {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

function normalizeMode(value: string): PlaygroundMode {
  if (value === "code" || value === "provenance" || value === "memory") {
    return value;
  }
  return "fractal";
}

function compactError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function settledState(
  label: string,
  result: PromiseSettledResult<unknown>,
  emptyDetail: string,
): OperationState {
  if (result.status === "rejected") {
    return {
      state: "error",
      title: `${label} unavailable`,
      detail: compactError(result.reason),
    };
  }

  const payload = result.value;
  const count = Array.isArray(payload)
    ? payload.length
    : typeof payload === "object" && payload !== null && "count" in payload
      ? Number((payload as { count?: unknown }).count ?? 0)
      : 1;

  if (count === 0) {
    return {
      state: "empty",
      title: `${label} empty`,
      detail: emptyDetail,
      payload,
    };
  }

  return {
    state: "ready",
    title: `${label} live`,
    detail: "Loaded from the Theorem SDK.",
    payload,
  };
}

export async function loadShowroomSnapshot(searchParams: SearchParams): Promise<ShowroomSnapshot> {
  const client = createTheoremClient();
  const mode = normalizeMode(first(searchParams.mode, "fractal"));
  const query = first(searchParams.query, "");
  const repo = first(searchParams.repo, "openai/openai-python");

  const [codexPresence, claudePresence, codexMentions, gallery, playground] =
    await Promise.allSettled([
      client.coordinate.presence({ actor: "codex", mode: "get" }),
      client.coordinate.presence({ actor: "claude-code", mode: "get" }),
      client.coordinate.mentions({ actor: "codex", limit: 6, consume: false }),
      client.harness.list({ limit: 6, status: "completed" }),
      runPlaygroundQuery({ client, mode, query, repo }),
    ]);

  return {
    coordination: {
      codex: settledState("Codex presence", codexPresence, "Codex is not heartbeating right now."),
      claudeCode: settledState("Claude Code presence", claudePresence, "Claude Code is not heartbeating right now."),
      mentions: settledState("Coordination queue", codexMentions, "No pending coordination messages."),
    },
    playground: settledState("Playground result", playground, "Run a query against the public corpus."),
    gallery: settledState("Run gallery", gallery, "No completed public harness runs are available yet."),
    mode,
    query,
    repo,
  };
}

async function runPlaygroundQuery({
  client,
  mode,
  query,
  repo,
}: {
  client: ReturnType<typeof createTheoremClient>;
  mode: PlaygroundMode;
  query: string;
  repo: string;
}) {
  const trimmed = query.trim();
  if (!trimmed) {
    return { count: 0, results: [] };
  }

  if (mode === "code") {
    return client.code.search({ query: trimmed, repo, limit: 8 });
  }

  if (mode === "provenance") {
    return client.provenance.trace({ query: trimmed, limit: 8 });
  }

  if (mode === "memory") {
    return client.recall({
      query: trimmed,
      tenantSlug: publicTenantSlug,
      limit: 8,
    });
  }

  return client.fractal.expand({
    query: trimmed,
    budget: { top_k: 8 },
    scope: { tenant_slug: publicTenantSlug, source: "showroom" },
  });
}

export function summarizeRun(run: HarnessRun) {
  return {
    id: run.run_id,
    title: run.task || run.run_id,
    status: run.status,
    actor: run.actor,
  };
}
