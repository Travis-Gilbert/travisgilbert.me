import "server-only";

import type { CreditCostForecastOperation } from "@context/theorem";
import { createTheoremClient } from "@/lib/theorem-client";

export interface CreditCost {
  readonly label: string;
  readonly credits: string;
  readonly meter: string;
  readonly source: "observed" | "fallback" | "error";
  readonly sampleCount: number;
  readonly cogs: string;
}

export interface PriceTier {
  readonly slug: "free" | "power" | "team" | "enterprise";
  readonly name: string;
  readonly price: string;
  readonly credits: string;
  readonly grantMultiplier: string;
  readonly description: string;
  readonly cta: string;
  readonly href: string;
  readonly notes: readonly string[];
}

export interface PricingSnapshot {
  readonly creditDefinition: string;
  readonly creditCosts: readonly CreditCost[];
  readonly source: "observed" | "fallback" | "error";
  readonly observedOperationCount: number;
  readonly totalObservedEvents: number;
  readonly sampleWindowDays: number;
  readonly minObservedEvents: number;
  readonly generatedAt: string;
  readonly error?: string;
}

export const creditDefinition =
  "1 credit represents $0.001 in measured operation cost components, rounded up behind a stable user-facing unit.";

export const fallbackCreditCosts: readonly CreditCost[] = [
  {
    label: "Context compilation",
    credits: "1 credit",
    meter: "per compiled artifact",
    source: "fallback",
    sampleCount: 0,
    cogs: "$0.001000 fallback COGS",
  },
  {
    label: "Fractal expansion",
    credits: "5 credits",
    meter: "per expansion",
    source: "fallback",
    sampleCount: 0,
    cogs: "$0.005000 fallback COGS",
  },
  {
    label: "Code crawler",
    credits: "5-50 credits",
    meter: "by repo size and runtime cost",
    source: "fallback",
    sampleCount: 0,
    cogs: "$0.005000-$0.050000 fallback COGS",
  },
  {
    label: "Personal adapter iteration",
    credits: "100 credits",
    meter: "per personal B matrix training pass",
    source: "fallback",
    sampleCount: 0,
    cogs: "$0.100000 fallback COGS",
  },
  {
    label: "Coordination messages",
    credits: "0 credits",
    meter: "free substrate traffic",
    source: "fallback",
    sampleCount: 0,
    cogs: "$0.000000 fallback COGS",
  },
  {
    label: "Federated participation",
    credits: "0 credits",
    meter: "free cohort contribution",
    source: "fallback",
    sampleCount: 0,
    cogs: "$0.000000 fallback COGS",
  },
];

export const priceTiers: readonly PriceTier[] = [
  {
    slug: "free",
    name: "Free",
    price: "$0",
    credits: "500 credits / month",
    grantMultiplier: "1x grant",
    description: "Start a public workspace without payment info.",
    cta: "Create workspace",
    href: "/?mode=memory",
    notes: ["Monthly reset", "Public harness access", "Personal memory graph"],
  },
  {
    slug: "power",
    name: "Power",
    price: "$20 / month",
    credits: "10,000 credits / month",
    grantMultiplier: "5x grant",
    description: "For individual builders running serious agent work.",
    cta: "Subscribe with Stripe",
    href: "/api/checkout?plan=power",
    notes: ["Rollover ready", "Private workspaces", "Personal adapter runs"],
  },
  {
    slug: "team",
    name: "Team",
    price: "$100 / month",
    credits: "100,000 credits / month",
    grantMultiplier: "3x grant",
    description: "For up to ten seats sharing memory and cohort signal.",
    cta: "Subscribe with Stripe",
    href: "/api/checkout?plan=team",
    notes: ["Federated cohort access", "Team coordination graph", "Shared skill installs"],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    price: "Custom",
    credits: "Custom credits",
    grantMultiplier: "Contract grant",
    description: "Dedicated deployment, private graph boundaries, and support.",
    cta: "Contact",
    href: process.env.ENTERPRISE_CONTACT_URL ?? "mailto:travis@travisgilbert.me?subject=Theorem%20enterprise",
    notes: ["Security review", "Custom retention", "Dedicated rollout support"],
  },
];

export async function loadPricingSnapshot(): Promise<PricingSnapshot> {
  const days = positiveInt(process.env.THEOREM_PRICING_WINDOW_DAYS, 30);
  const minEvents = positiveInt(process.env.THEOREM_PRICING_MIN_EVENTS, 10);
  try {
    const forecast = await createTheoremClient().harness.creditCosts({
      days,
      minEvents,
    });
    const creditCosts = forecast.operations.length > 0
      ? forecast.operations.map(operationToCreditCost)
      : fallbackCreditCosts;
    const observedOperationCount = forecast.operations.filter(
      (operation) => operation.source === "observed",
    ).length;
    return {
      creditDefinition: forecast.credit_definition || creditDefinition,
      creditCosts,
      source: observedOperationCount > 0 ? "observed" : "fallback",
      observedOperationCount,
      totalObservedEvents: forecast.total_observed_events,
      sampleWindowDays: forecast.sample_window_days,
      minObservedEvents: forecast.min_observed_events,
      generatedAt: forecast.generated_at,
      error: forecast.error || undefined,
    };
  } catch (error) {
    return {
      creditDefinition,
      creditCosts: fallbackCreditCosts,
      source: "fallback",
      observedOperationCount: 0,
      totalObservedEvents: 0,
      sampleWindowDays: days,
      minObservedEvents: minEvents,
      generatedAt: new Date().toISOString(),
      error: compactPricingError(error),
    };
  }
}

function operationToCreditCost(operation: CreditCostForecastOperation): CreditCost {
  return {
    label: operation.label,
    credits: operation.display_credits,
    meter: operation.meter,
    source: operation.source === "observed" ? "observed" : "fallback",
    sampleCount: operation.sample_count,
    cogs: operation.source === "observed" && operation.median_cogs_dollars
      ? `$${operation.median_cogs_dollars} median COGS`
      : fallbackCogsLabel(operation),
  };
}

function fallbackCogsLabel(operation: CreditCostForecastOperation): string {
  const minimum = `$${operation.fallback_cogs_dollars_min}`;
  const maximum = `$${operation.fallback_cogs_dollars_max}`;
  if (minimum === maximum) {
    return `${minimum} fallback COGS`;
  }
  return `${minimum}-${maximum} fallback COGS`;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function compactPricingError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/404|not found/i.test(message)) {
    return "Pricing forecast endpoint is not deployed yet; using launch defaults.";
  }
  const firstLine = message.split("\n")[0] ?? "unknown error";
  return `Pricing forecast unavailable; using launch defaults. ${firstLine}`;
}
