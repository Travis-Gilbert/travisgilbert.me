# Stage 4: Deployment

This stage stands up the Reflex Railway service, provisions the public hostname, sets the Vercel env var, and runs the six production smoke checks from design-doc section 8.

The first three tasks operate on Railway and Vercel dashboards plus DNS. The fourth task is pure verification.

---

## Task 28: Create the reflex-node-detail Railway service

Goal: a new Railway service named `reflex-node-detail` in the existing Index-API project, pointed at `Dockerfile.reflex` via `railway.reflex.toml`, with the four required env vars set.

Steps (operator):

1. Open the Railway project that hosts Index-API web + worker.
2. Click "New Service" -> "Deploy from GitHub Repo" and select the same Index-API repo.
3. Name the service `reflex-node-detail`.
4. In the service settings, set:
   - Build Source: GitHub repo, branch `main`.
   - Dockerfile Path: `reflex_node_detail/Dockerfile.reflex` (matches `railway.reflex.toml`).
   - Config Path (if Railway asks): `railway.reflex.toml`.
   - Watch Paths: `reflex_node_detail/**` and `railway.reflex.toml` (so unrelated commits don't trigger redeploys).
5. Set environment variables on the service (via Railway dashboard or `railway variables set`):
   - `RESEARCH_API_BASE_URL=https://index-api-production-a5f7.up.railway.app`
   - `INTERNAL_API_KEY=` (leave empty for now; the `/api/v1/notebook/` exemption is still in effect)
   - `REFLEX_API_URL=https://node.travisgilbert.me`
   - `REFLEX_DB_URL=sqlite:////app/reflex.db`
   - `REFLEX_ENV=prod`
   - `PORT=3000`
6. Trigger the first deploy. Wait for the build to succeed and the health check (`/`) to return 200.

Verification command (run from any machine):

```bash
RAILWAY_DOMAIN=$(echo "<paste the Railway-issued domain here, e.g. reflex-node-detail-production.up.railway.app>") && curl -s -o /dev/null -w "HOME=%{http_code}\n" "https://$RAILWAY_DOMAIN/" && curl -s -o /dev/null -w "NODE=%{http_code}\n" "https://$RAILWAY_DOMAIN/n/1"
```

Acceptance criterion: `HOME=200`. `NODE` is `200` (or `404` rendered as 200 with the not-found surface; Reflex renders the page and the 404 state is server-rendered HTML, so the HTTP status is 200).

Delegate to: plan-pro (self)

---

## Task 29: Provision node.travisgilbert.me custom domain

Goal: assign `node.travisgilbert.me` to the Railway `reflex-node-detail` service. HTTPS auto-provisioned by Railway. Update `REFLEX_API_URL` to match.

Steps (operator):

1. In the Railway service settings -> "Networking" -> "Custom Domain", enter `node.travisgilbert.me`. Railway returns a CNAME target.
2. In the DNS provider for `travisgilbert.me`, add a CNAME record: `node` -> `<railway-cname-target>`.
3. Wait for DNS propagation (usually under 5 minutes). Railway shows a green "Active" status when the cert provisions.
4. Verify the domain resolves: `dig +short node.travisgilbert.me` should return the Railway IPs (or a chain of CNAMEs ending at one).

Fallback if custom-domain provisioning is blocked or denied:

1. Add a Vercel rewrite at the Website repo: in `next.config.ts`, append a rule that rewrites `/theseus/node/:path*` to `https://<railway-domain>/:path*`. This requires the existing `next.config.ts` rewrites array to be modified (additive change).
2. Set `NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL=https://travisgilbert.me/theseus/node` on Vercel (preview AND production).
3. Document the fallback in `reflex_node_detail/README.md`.

Verification command (primary path):

```bash
curl -s -o /dev/null -w "HTTPS=%{http_code} CERT=%{ssl_verify_result}\n" "https://node.travisgilbert.me/" && curl -s -o /dev/null -w "NODE=%{http_code}\n" "https://node.travisgilbert.me/n/1"
```

Acceptance criterion: `HTTPS=200`, `CERT=0` (cert verifies cleanly). If the fallback path is taken instead, the equivalent commands against `https://travisgilbert.me/theseus/node/` succeed.

Delegate to: plan-pro (self)

---

## Task 30: Set NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL on Vercel

Goal: configure the env var on Vercel so the build inlines the correct base URL. Since `NEXT_PUBLIC_*` env vars are inlined at build time (Website CLAUDE.md gotcha), a redeploy is required.

Steps (operator):

1. Open the Vercel project for `travisgilbert.me`.
2. Settings -> Environment Variables -> add `NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL`:
   - Production: `https://node.travisgilbert.me`
   - Preview: `https://node.travisgilbert.me`
   - Development: `http://localhost:3000`
3. Save.
4. Trigger a new preview deploy from any branch (Deployments -> "Redeploy" or push a no-op commit) to inline the var.
5. Once the preview deploy is green, promote to production.

Verification command:

```bash
curl -s "https://travisgilbert.me/theseus/explorer" | grep -c "node.travisgilbert.me"
```

Acceptance criterion: the count is at least 1 (the Reflex hostname is referenced in the bundled JS, confirming the env var was inlined). If the count is 0, the env var was not picked up: re-trigger the production build.

Delegate to: plan-pro (self)

---

## Task 31: Run the six design-doc smoke checks

Goal: walk through every check in design-doc section 8 and record pass / fail. Any fail blocks the "feature done" call.

Steps:

Execute the following six checks and report each result inline:

**Check 1**: `curl -s -o /dev/null -w "%{http_code}\n" https://node.travisgilbert.me/`
- Expected: `200`.

**Check 2**: `curl -s -o /dev/null -w "%{http_code}\n" https://node.travisgilbert.me/n/1`
- Expected: `200` (whether pk=1 exists with full data or returns the not-found surface; both render with HTTP 200).

**Check 3 (manual, browser)**: open `https://travisgilbert.me/theseus/explorer`, wait for the graph to load, double-click any visible node.
- Expected: a new tab opens at `https://node.travisgilbert.me/n/<pk>` and renders all five sections with real data.

**Check 4 (manual, browser)**: in the Explorer tab from Check 3, observe the lens after the double-click.
- Expected: the lens stays on whatever it was before the gesture (`flow` by default). The atlas lens did NOT activate.

**Check 5 (manual, browser)**: in the Explorer, double-click on empty canvas space (not on a node).
- Expected: the lens toggles to `atlas` (existing behaviour preserved).

**Check 6 (manual, browser)**: on the Reflex page from Check 3, click any "Connections" row's other-side title link.
- Expected: navigation to `https://node.travisgilbert.me/n/<other_pk>` with real data for that node. Connections list re-populates with the new node's edges.

Verification command:

```bash
echo "=== Smoke 1+2 ===" && curl -s -o /dev/null -w "1: %{http_code}\n" https://node.travisgilbert.me/ && curl -s -o /dev/null -w "2: %{http_code}\n" https://node.travisgilbert.me/n/1 && echo "=== Smoke 3-6: manual browser walkthrough required ==="
```

Acceptance criterion: all six checks pass. Record results in the operator notes (or paste into the PR description). If any check fails, file the failure as the next task before declaring the feature done.

Delegate to: plan-pro (self)

---

## Stage 4 exit criteria

- `https://node.travisgilbert.me/` and `https://node.travisgilbert.me/n/1` both serve 200 over HTTPS with a valid cert.
- `NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL` is set on Vercel for production, preview, and development.
- All six smoke checks from design-doc section 8 pass.
- The feature is functionally complete: per-node double-click in the Explorer opens the Reflex tab, recursive connection navigation works, and the lens-toggle muscle memory is preserved.
