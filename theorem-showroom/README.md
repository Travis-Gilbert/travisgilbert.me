# Theorem Showroom

Launch surface for Theorem's Harness. This is the CommonPlace fork as a
standalone product repo, wired through the TypeScript SDK rather than a
bespoke frontend client.

## Local Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set server-side values there. Do not
put service tokens in `NEXT_PUBLIC_*`; the app is intentionally server-first so
SDK calls that need credentials stay out of the browser bundle.

## Runtime Contracts

- Coordination demo: `cc.coordinate.presence()` and `cc.coordinate.mentions()`
- Playground: `cc.fractal.expand()`, `cc.code.search()`, `cc.provenance.trace()`,
  and `cc.memory.recall()` through the SDK surface
- Gallery: `cc.harness.list()` and `cc.harness.replay()`
- Pricing: `cc.harness.creditCosts()` for aggregate COGS-derived forecasts,
  plus Stripe payment links via server route redirects, not frontend tokens

The app must render real SDK results or honest empty/error states. It should
not ship seeded rows, simulated progress, or dead-link purchase buttons.

## License

AGPL-3.0-only. The harness layer is open-source; the closed Theseus
intelligence layer, hosted service, curated knowledge graph, and trained
adapters remain outside this repo.
