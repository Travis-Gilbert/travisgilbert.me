import Link from "next/link";
import { priceTiers, type PricingSnapshot } from "@/lib/pricing";

export function PricingPage({ snapshot }: { readonly snapshot: PricingSnapshot }) {
  const ledgerLabel = snapshot.source === "observed"
    ? `${snapshot.observedOperationCount} observed operation medians`
    : "Launch defaults";

  return (
    <main className="page-shell pricing-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true" />
          <span>Theorem's Harness</span>
        </Link>
        <nav aria-label="Primary">
          <Link href="/">Showroom</Link>
        </nav>
      </header>

      <section className="pricing-hero">
        <h1>Pricing</h1>
        <p>{snapshot.creditDefinition}</p>
        <div className={`ledger-status ledger-${snapshot.source}`}>
          <span>{ledgerLabel}</span>
          <span>
            {snapshot.totalObservedEvents} events over {snapshot.sampleWindowDays} days
          </span>
          <span>{snapshot.minObservedEvents} event minimum</span>
        </div>
      </section>

      <section className="tier-grid" aria-label="Pricing tiers">
        {priceTiers.map((tier) => (
          <article className="tier-panel" key={tier.slug}>
            <div>
              <h2>{tier.name}</h2>
              <p>{tier.description}</p>
            </div>
            <div className="tier-price">
              <span>{tier.price}</span>
              <span>{tier.credits}</span>
            </div>
            <span className="grant">{tier.grantMultiplier}</span>
            <ul>
              {tier.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <Link className="button button-primary" href={tier.href}>
              {tier.cta}
            </Link>
          </article>
        ))}
      </section>

      <section className="cost-table" aria-label="Credit costs">
        <h2>Credit costs</h2>
        <div>
          {snapshot.creditCosts.map((cost) => (
            <article className="cost-row" key={cost.label}>
              <span>{cost.label}</span>
              <strong>{cost.credits}</strong>
              <span>{cost.meter}</span>
              <span className={`cost-source source-${cost.source}`}>
                {cost.source === "observed" ? `${cost.sampleCount} samples` : cost.source}
              </span>
              <span>{cost.cogs}</span>
            </article>
          ))}
        </div>
        {snapshot.error ? <p className="ledger-note">{snapshot.error}</p> : null}
      </section>
    </main>
  );
}
