# THESEUS-MOBILE-RN-HANDOFF · v2

> **What this is.** A planning doc for `theseus-mobile`: an Expo / React Native iOS app that talks to the existing Django backend at `/api/v2/theseus/` and reaches TestFlight in 4 to 6 weeks. Lives in a NEW repo (`Travis-Gilbert/theseus-mobile`) that does not exist yet.
>
> **Audience.** Claude Code with the `plan-pro` plugin. Travis as the human-in-the-loop.

---

## CRITICAL SCOPE GUARDS (read every time before implementing)

This spec touches three repositories. Two of them are **live production code**. Read this section before making any changes anywhere.

### `Travis-Gilbert/travisgilbert.me` (live web app)

**MUST NOT modify any of these files:**
- `src/app/theseus/page.tsx`
- `src/app/theseus/layout.tsx`
- `src/components/theseus/PanelManager.tsx`
- Any file under `src/components/theseus/intelligence/`
- Any file under `src/components/theseus/explorer/` (read only — wrap, do not edit)
- Any file under `src/components/theseus/panels/` (read only — wrap, do not edit)
- `src/styles/theseus.css`
- `src/styles/assistant-ui-theme.css`
- The existing PWA files: `public/theseus-sw.js`, `src/app/theseus/manifest.ts`, `src/components/theseus/TheseusServiceWorker.tsx`

**MAY add new files only**, in these locations:
- `src/app/theseus/_mobile/` (new directory for chrome-less mobile-companion routes)
- `src/app/api/v2/auth/mobile-callback/` (if the mobile-auth endpoint lives in Next.js — see Phase 1 decision)
- `public/.well-known/apple-app-site-association` (universal-link config)

If at any point during a Claude Code session the implementation requires editing a file in the "MUST NOT modify" list, **STOP and ask Travis**. Do not "just make a small change." There is no small change to those files.

### `Travis-Gilbert/index-api` (live Django backend)

**MUST NOT modify any of these files:**
- Any file under `apps/notebook/api/` except as a NEW file (e.g., new endpoints)
- `config/api_v2.py` except to register a NEW router
- Any existing endpoint's `auth=` parameter or `request.user` resolution

**MAY add new files**:
- `apps/auth/api.py` (new mobile-auth endpoints)
- `apps/auth/jwt_auth.py` (new JWT auth class for new endpoints only)
- A new router registered in `config/api_v2.py` via `api.add_router(...)`

**JWT auth is additive only.** Do not "migrate" existing endpoints from session-cookie auth to JWT. Do not rewrite the auth resolution path. New mobile endpoints get `auth=JWTAuth()`. Existing endpoints keep their current `request.user` resolution. The web frontend's NextAuth session cookies must continue to work exactly as they do today.

### `Travis-Gilbert/theseus-mobile` (new RN repo, does not exist)

This is greenfield. Build whatever Phase 0 says.

---

## Context

**The product.** Theseus is a self-organizing epistemic knowledge graph engine. The web app at `travisgilbert.me/theseus` is its primary surface, mounted as `<PanelManager />` from `src/components/theseus/PanelManager.tsx`. PanelManager renders all panels (Threads, Explorer, Intelligence, Code, Plugins, Notebook) inside a single page. **None of that changes.**

**The constraint.** Solo founder. Launch is imminent. The RN app is a separate iOS deliverable that talks to the same backend.

**Three repos:**
- `Travis-Gilbert/travisgilbert.me` — Next.js 16 frontend + NextAuth (LIVE)
- `Travis-Gilbert/index-api` — Django + Ninja v2 backend (LIVE)
- `Travis-Gilbert/theseus-mobile` — Expo RN app (NEW, this spec creates it)

**Tokens, types, contracts shared via the network.** Django Ninja exposes OpenAPI at `/api/v2/openapi.json`. RN consumes it via `openapi-typescript` codegen. Web app's design tokens are in `src/styles/theseus.css` lines 9-77 and the RN repo mirrors them in a `tokens.json`. No shared package needed for v1.

---

## Stack decisions, decided

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Expo SDK 52 + dev client | EAS Build, OTA updates, no Xcode in the loop |
| Navigation | Expo Router | File-based, mirrors Next.js mental model |
| State | Zustand | Same primitives as web; minimal API |
| Server cache | TanStack Query + `query-async-storage-persister` | Offline reads via SQLite |
| Local DB | `expo-sqlite` | Required for offline thread cache |
| Streaming | `react-native-sse` | Standard SSE polyfill; consumes `/ask/stream/<job_id>/` directly |
| Markdown | `react-native-markdown-display` | Theming hooks; works with custom fonts |
| Styling | NativeWind v4 | Tailwind on RN |
| Icons | `lucide-react-native` | Same icon set as web |
| Bottom sheets | `@gorhom/bottom-sheet` | The Lens UI; gesture-driven, reduce-motion aware |
| Auth storage | `expo-secure-store` | iOS Keychain |
| OAuth | `expo-auth-session` | GitHub OAuth flow native; redirects back to app |
| Push | `expo-notifications` | Engine-completion alerts |
| Share extension | `expo-share-extension` community plugin | Quick capture from Safari |
| WebView | `react-native-webview` | Hosts the cosmos.gl Explorer |
| Build/distrib | EAS Build + EAS Submit | One command to TestFlight |
| Codegen | `openapi-typescript` | `/api/v2/openapi.json` → `src/api/types.ts` |

**Hard "no" list:**
- React Native CLI (bare workflow). Use Expo.
- Redux. Zustand exists; don't add a second store paradigm.
- Realm or WatermelonDB. SQLite via TanStack persister is enough.
- Custom WebGL graph renderer in RN. Phase 4 wraps the existing cosmos.gl in a WebView. Native Metal port is the future Swift app's job.
- Any modification to the live web app's UI surface.

---

## Auth strategy

Travis is single-user today (NextAuth GitHub OAuth restricted to `Travis-Gilbert`) but launch will change that. The mobile auth model has to work for the multi-user case.

**Pattern: GitHub OAuth on mobile via `expo-auth-session`. Backend issues JWT.**

Flow:
1. RN opens GitHub OAuth flow via `expo-auth-session` with scope `read:user`.
2. RN gets the OAuth code back at `theseus://auth/callback`.
3. RN POSTs the code to a new backend endpoint (location decided in Phase 1, see below).
4. Backend exchanges the code with GitHub, validates the user against an allowlist (default: same as `src/lib/auth.ts` allowlist; expand if Travis says so), mints a signed JWT.
5. RN stores tokens in SecureStore. Refresh token used to mint new access tokens.
6. Every API call: `Authorization: Bearer <access_token>`.

**Endpoint location decision (defer to Travis at start of Phase 1):**

Two valid implementations exist:
- **Option A: Next.js API route** (`travisgilbert.me/src/app/api/v2/auth/mobile-callback/route.ts`). Minimal Django changes; the Next.js app handles the OAuth dance and the JWT signing. Django then trusts JWTs signed with a shared secret.
- **Option B: Django Ninja endpoint** (`apps/auth/api.py` in `index-api`). Django owns OAuth and JWT entirely. Next.js app does not change.

Option B is cleaner separation of concerns. Option A is faster to ship. Travis picks before Phase 1 starts.

**JWT auth is ADDITIVE.** New mobile-only endpoints use the new JWT auth class. Existing endpoints keep their `request.user` resolution. The web frontend's session cookies must continue to work exactly as they do today. Do not refactor the auth path.

**Why not API key?** Multi-user is coming. JWT now is one phase, JWT later is two phases plus a migration.

**Why not pure GitHub OAuth from the RN app?** GitHub `client_secret` cannot live in an RN bundle (decompilable). Backend exchanges the code so the secret stays server-side.

**Allowlist decision (defer to Travis at start of Phase 1):** the existing `ALLOWED_GITHUB_USERNAME = 'Travis-Gilbert'` in `src/lib/auth.ts` either stays as-is (single-user testing first) or expands to a list (small beta) or opens to all GitHub users (full launch). The mobile-callback endpoint mirrors whatever decision lands here.

---

## Repo structure (theseus-mobile only)

```
theseus-mobile/
├── app/                              # Expo Router file-based routing
│   ├── _layout.tsx                   # Root: theme, query client, auth provider
│   ├── index.tsx                     # Splash → redirect on auth state
│   ├── (auth)/
│   │   ├── _layout.tsx               # Stack
│   │   └── sign-in.tsx               # GitHub OAuth flow
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Bottom tabs
│   │   ├── threads.tsx
│   │   ├── explorer.tsx              # Hosts ExplorerWebView
│   │   ├── plugins.tsx
│   │   └── code.tsx
│   ├── threads/[id].tsx              # Conversation view
│   ├── lens/[nodeId].tsx             # Modal Lens
│   └── settings.tsx
├── src/
│   ├── api/
│   │   ├── client.ts                 # fetch wrapper, token injection, refresh
│   │   ├── threads.ts
│   │   ├── graph.ts
│   │   ├── lens.ts
│   │   ├── plugins.ts
│   │   ├── code.ts
│   │   ├── auth.ts
│   │   └── types.ts                  # generated from OpenAPI
│   ├── auth/
│   │   ├── AuthProvider.tsx
│   │   ├── useAuth.ts
│   │   └── token-store.ts
│   ├── components/
│   │   ├── chat/
│   │   ├── explorer/
│   │   ├── plugins/
│   │   ├── code/
│   │   └── ui/
│   ├── theme/
│   │   ├── tokens.ts                 # mirrors web theseus.css tokens
│   │   ├── ThemeProvider.tsx
│   │   └── fonts.ts
│   ├── stores/
│   ├── lib/
│   └── hooks/
├── tokens/
│   └── tokens.json
├── ios/                              # Expo prebuild output (gitignored)
├── share-extension/
├── scripts/
│   └── codegen-api.ts
├── app.config.ts
├── eas.json
└── package.json
```

The RN repo is greenfield. Build it however Phase 0 lays out. The web repo and the Django repo do not gain a `theseus-mobile` directory.

---

## Phase plan

Each phase ships something demoable. Auth foundation lands first.

### Phase 0 · Bootstrap (4 hours)

**Read first:**
- `travisgilbert.me/src/styles/theseus.css` lines 9-77 (token block to mirror in `tokens.json`)

**Goal.** New repo, Expo SDK 52 dev client, file-based routing, theme provider, four placeholder tabs.

**Deliverable:**
1. `Travis-Gilbert/theseus-mobile` initialized with `npx create-expo-app theseus-mobile -t expo-template-blank-typescript`. Upgrade to dev client.
2. `app.config.ts` with bundle ID `com.travisgilbert.theseus`, scheme `theseus`, associated domains `travisgilbert.me`.
3. NativeWind v4 wired with `tailwind.config.js` referencing `tokens/tokens.json`.
4. Vollkorn + IBM Plex Sans + Mono loaded via `expo-font` from Google Fonts.
5. Bottom tab navigator with four routes (`threads`, `explorer`, `plugins`, `code`). Each renders a placeholder card with the route name. **No real screens, no API calls, no auth yet.**
6. Tab bar uses `lucide-react-native` icons.
7. `tokens/tokens.json` initial cut, palette ported from web `theseus.css` lines 9-77.
8. README explaining how to run dev client, how to push to EAS Build.
9. Universal-links scaffold: place `.well-known/apple-app-site-association` JSON at `travisgilbert.me/public/.well-known/apple-app-site-association`. **This is a NEW file in the web repo. It is the only web-repo change in Phase 0.**

**Verification:** `npx expo start --dev-client` opens the app on iPhone. Bottom nav renders. Tapping a tab swaps placeholder.

**Out of scope for Phase 0:** real screens, API calls, auth, anything in the web repo other than the new `.well-known/` file.

---

### Phase 1 · Auth (2 days)

**Travis decides at start of phase:**
1. Allowlist policy (single-user / list / open).
2. Endpoint location (Next.js Option A vs. Django Option B).

**Read first:**
- `travisgilbert.me/src/lib/auth.ts` (current NextAuth GitHub config)
- `expo-auth-session` GitHub provider docs

**Goal.** Real GitHub OAuth on mobile. Backend issues JWTs via the agreed-upon endpoint location. Web frontend continues to work unchanged. Mobile sends `Authorization: Bearer <access_token>` on every call.

**If Option A (Next.js):**
1. New file `travisgilbert.me/src/app/api/v2/auth/mobile-callback/route.ts`. Takes `{code, redirect_uri}`, exchanges with GitHub, mints a JWT signed with a shared secret. Returns `{access_token, refresh_token, user}`.
2. New file `travisgilbert.me/src/app/api/v2/auth/refresh/route.ts`. Takes `{refresh_token}`, returns `{access_token}`.
3. Django side: new file `index-api/apps/auth/jwt_validator.py` that validates incoming `Authorization: Bearer` tokens against the shared secret and resolves to a Django user. Apply ONLY to new mobile-specific endpoints. Existing endpoints unchanged.

**If Option B (Django):**
1. New file `index-api/apps/auth/api.py` with `mobile-callback/` and `refresh/` endpoints. Uses `pyjwt`.
2. New file `index-api/apps/auth/jwt_auth.py` with `JWTAuth(HttpBearer)`. Apply ONLY to new mobile-specific endpoints. Existing endpoints unchanged.
3. Register the new router in `config/api_v2.py` via `api.add_router('/auth/', auth_router)`. **Do not modify existing router registrations.**
4. Migration: add `mobile_refresh_tokens` table for revocation. Use Django migrations; do not touch existing tables.
5. Pytest cases for happy path, expired tokens, revoked tokens.

**Mobile work (RN only):**
1. `app/(auth)/sign-in.tsx`: brand mark, "Sign in with GitHub" button. Opens `expo-auth-session` with redirect URI `theseus://auth/callback`.
2. `src/auth/AuthProvider.tsx`: React context with `{user, signIn, signOut, isLoading}`. Reads tokens from SecureStore on mount. On 401, attempts refresh once before failing.
3. `src/api/client.ts`: fetch wrapper. Reads access token from token store. On 401, calls refresh, retries once. On second 401, calls `signOut`.
4. `app/_layout.tsx` redirects to `(auth)/sign-in` if not authenticated.

**Verification:**
- Cold start signed out → sign-in screen.
- Tap "Sign in with GitHub" → Safari View Controller → grant → redirects back into app.
- App now shows the bottom tabs. SecureStore has tokens.
- Hard-restart the app → tabs render immediately, no re-login.
- **Web frontend regression check:** sign in to `travisgilbert.me` in a normal browser, navigate to `/theseus`, confirm PanelManager mounts and all panels render exactly as before. No auth path regression.
- Manually expire access token in dev → next API call refreshes silently.
- Tap "Sign out" in settings → token store cleared, back to sign-in.

**Hard problems:**
- *GitHub `client_secret` exposure?* Mobile sends only the OAuth code; the secret stays server-side.
- *Refresh-token theft?* 30-day TTL, server-side revocation table, single-use refresh tokens (each refresh issues a new refresh token, old one is revoked).

---

### Phase 2 · Threads (basic chat, no streaming) (2 days)

**Read first:**
- `index-api/apps/notebook/api/intelligence.py` for `/ask/`, `AskRequest`, `AskResponse`
- `react-native-markdown-display` README

**Goal.** Threads tab works end-to-end with non-streaming chat.

1. **Codegen.** `scripts/codegen-api.ts` runs `openapi-typescript` against `https://travisgilbert.me/api/v2/openapi.json` → writes `src/api/types.ts`. Add `npm run gen:api` to package.json.
2. **Thread list (`app/(tabs)/threads.tsx`).** **Verify** that a `GET /api/v2/theseus/threads/` endpoint exists before scoping the screen. If it does not, ask Travis whether to (a) add it (new file in `index-api/apps/notebook/api/`, additive) or (b) substitute an alternative (e.g., recent ask jobs). Do not invent endpoints.
3. **Welcome state (`Welcome.tsx`).** Display heading + lede + 2x2 suggestion grid. Suggestions hardcoded in v1; pull from `/briefing/` later.
4. **Conversation view (`app/threads/[id].tsx`).** FlatList inverted, scrolls bottom-up.
5. **Message components.**
   - `Message.tsx` branches on role.
   - User: right-aligned, muted bubble, `border-radius: 16`, padding equivalent to `px-4 py-2.5`.
   - Assistant: full-width, no bubble, Vollkorn 15px / 1.6 line-height, citations as inline links with forest-green underline.
6. **Composer.** Bottom dock above keyboard via `KeyboardAvoidingView`. `border-radius: 24`, brass focus ring on focus. 32x32 send button.
7. **Send flow.** POST to `/ask/` (sync endpoint for now). Show local user message immediately, swap with server response on resolve.
8. **Action bar.** Copy / Reload / More. Auto-hides on `not-last`.

**Verification:**
- Tap Threads → list of threads.
- Tap a thread → messages render with user/assistant differentiation.
- Type → focus ring → send → user msg appears immediately, assistant msg renders after API resolves.
- Pull-to-refresh on list works.

---

### Phase 3 · Streaming chat via async ask (1.5 days)

**Read first:**
- `index-api/apps/notebook/api/intelligence.py` for `ask_theseus_async` (POST `/ask/async/`) and `ask_theseus_stream_job` (GET `/ask/stream/<job_id>/`)
- `react-native-sse` README

**Goal.** Replace Phase 2's sync `/ask/` with the async pair. Tokens stream into the assistant message. Reasoning panel shows live during `stage` events.

1. **`useStreamingAsk` hook.** Takes a query, returns `{tokens, stages, isComplete, isError}`. POSTs `/ask/async/` to get `{job_id, stream_url}`. Opens SSE via `react-native-sse`. Routes events: `stage` → progress, `token` → append, `complete` → finalize, `error` → set error.
2. **Reasoning component.** Above the assistant message while `stages` non-empty. Heartbeat pulse during streaming. Collapses on `isComplete`.
3. **Streaming render.** Tokens append in place. Markdown re-renders with 100ms debounce.
4. **Cancel button.** Send button becomes Stop during streaming. Closing the SSE stops updates client-side; the job continues server-side.
5. **Reconnect on app foreground.** If a stream was active when backgrounded, on foreground call `/ask/status/<job_id>/`.

**Verification:**
- Send query → reasoning appears → tokens stream → reasoning collapses on complete.
- Background mid-stream → foreground → message picks up.
- Tap stop → message stops growing.

---

### Phase 4 · Explorer via WebView (2.5 days)

**Read first:**
- `react-native-webview` README sections on `injectedJavaScriptBeforeContentLoaded` and `postMessage`
- `@gorhom/bottom-sheet` README

**Goal.** Explorer tab renders the cosmos.gl Explorer in a full-screen WebView. Tap a node → native bottom sheet opens with the Lens.

**Web work (NEW route only):**

1. New route at `travisgilbert.me/src/app/theseus/_mobile/explorer/page.tsx`. **This is a new file. It does not touch the existing `/theseus` route, the layout, PanelManager, or any existing component.**
2. The new route imports the existing cosmos.gl Explorer component from `src/components/theseus/explorer/` (read-only — does not modify it). Wraps it in a chrome-less container that strips the sidebar / nav. If a chrome-less variant requires component changes, **stop and ask Travis** before editing existing components.
3. The route accepts a JWT in a query param `?token=...`. It uses that for `/api/v2/theseus/graph/...` API calls instead of the NextAuth cookie. The existing `/theseus` route's auth path is unchanged.
4. On node tap, the route calls `window.ReactNativeWebView?.postMessage(JSON.stringify({type: 'tap-node', nodeId}))`. The optional chain means the route still works in a regular browser (no-op).

**If a viewport-clipped graph endpoint is needed for mobile perf:**
- Add a NEW endpoint (e.g., `/api/v2/theseus/graph/viewport/`) in a new file. Do not modify existing graph endpoints.

**Mobile work:**

1. `app/(tabs)/explorer.tsx` renders a full-bleed `<WebView>` pointing at `https://travisgilbert.me/theseus/_mobile/explorer?token=<jwt>`.
2. `onMessage` handler receives `{type: 'tap-node', nodeId}` events.
3. On tap-node, open `@gorhom/bottom-sheet` modal at 50% snap with Lens content.
4. Lens fetches from `/api/v2/theseus/lens/<nodeId>/` (existing endpoint, no changes). "Explain this" button calls `/explain_node/` (existing endpoint) for streaming.
5. Snap points: 50% (default), 90% (full-read), dismiss on swipe down.

**Verification:**
- Tap Explorer → WebView loads in <2s.
- Pinch-zoom feels native.
- Tap a node → sheet slides up with Lens.
- "Explain this" → streaming explanation appears.
- Swipe down → dismissed; graph state preserved.
- **Web regression check:** load `/theseus` (the existing route, not the `_mobile` one) in a desktop browser. PanelManager still works. Existing Explorer panel still works.

**Hard problems:**
- *WebView pauses when occluded?* 50% snap keeps WebView partially visible.
- *Auth in the WebView?* JWT in query param. Web route uses it for API calls.

---

### Phase 5 · Plugins + Code panels (1.5 days)

**Read first:**
- `index-api/apps/plugins/api.py` (verify exists; **do not assume**)
- `index-api/apps/notebook/api/code.py`

**Goal.** Plugins tab renders Connectors / MCP / Skills view. Code tab renders file-graph preview and hot-files list.

1. **Plugins screen (`app/(tabs)/plugins.tsx`).** Three tabs via segmented control. Each fetches its data from existing endpoints. **Verify each endpoint exists before scoping the screen.** If any are missing, ask Travis whether to add (new files only, additive) or skip the screen.
2. **Code screen (`app/(tabs)/code.tsx`).** Header stat row from `GET /api/v2/theseus/code/...` (verify exact path against `code.py`). Mini graph: smaller WebView pointing at a NEW route `travisgilbert.me/src/app/theseus/_mobile/code-graph/page.tsx`. Same scope rules as Phase 4: new file only, wraps existing components without modification.

**Verification:**
- Plugins loads. Toggling a connector reflects optimistically + persists across restart.
- Code loads stats, mini-graph, hot files.
- Tap a hot file → opens detail screen.
- **Web regression check:** existing Plugins panel and Code panel in `/theseus` still work.

---

### Phase 6 · Quick capture share extension (1.5 days)

**Goal.** User in Safari hits Share → Theseus appears in the share sheet → URL POSTs to backend, creates a new thread + starts ingestion + sends a push when ready.

1. **Verify** a quick-capture-style endpoint exists in `index-api`. If not, ask Travis whether to add it (new file in `apps/notebook/api/`, additive).
2. Add `expo-share-extension` to `app.config.ts` plugins.
3. Share extension's RN bundle: minimal UI, calls the API. Reads JWT from shared App Group keychain (configured in Phase 1).
4. On success, dismiss with toast.
5. Main app deep-links to the new thread on next foreground.

**Verification:**
- Open Safari → share an arxiv URL → Theseus in share sheet → tap → "Saved" within 2s.
- Open Theseus app → new thread at top of list.
- Engine processes ingestion → push fires → tap → deep links to thread.

**Hard problems:**
- *App Group setup?* Configure in Phase 0's `app.config.ts`.
- *Token sharing across processes?* App Group keychain.

---

### Phase 7 · Push notifications + deep linking (1 day)

**Goal.** App receives push on engine events. Tap deep links to thread / lens.

1. Backend integration: a Django signal posts to Expo Push API on engine events. **Implement as a NEW signal handler in a NEW file** (e.g., `apps/notifications/signals.py`). Do not modify existing models or signal handlers.
2. `app/_layout.tsx` registers for push on first launch. Stores device token via `POST /api/v2/auth/device-token/` (NEW endpoint in the auth router).
3. Notification content includes a `url` like `theseus://threads/abc123`.
4. `src/lib/deep-link.ts` parses these and calls `router.push(...)`.

**Verification:**
- Trigger manual engine event → push within 5s.
- Tap notification cold → cold-launches into thread.
- Tap notification foregrounded → in-app banner; tap navigates.

---

### Phase 8 · Polish + TestFlight (1 day)

1. App icon (PCB-green emblem at 1024x1024). Splash screen. Status bar config.
2. App Store Connect metadata: name, subtitle, description (minimal real text), keywords, screenshots from iPhone 14 Pro.
3. EAS Build production profile. `eas build -p ios --profile production`.
4. EAS Submit to TestFlight. Add Travis as first internal tester.
5. README: how to add testers, how to push OTA updates via EAS Update.

**Verification:** TestFlight build installable on Travis's iPhone within 24h of submitting.

---

## Cross-cutting concerns

### Sync between web and mobile

**Now:** types via OpenAPI codegen. Tokens duplicated in `tokens/tokens.json`, kept in sync manually.

**Later (post-launch):** convert `travisgilbert.me` to pnpm workspaces, extract `packages/theseus-tokens` and `packages/theseus-api-types`. Don't do this in Phase 0-8; it's a yak-shave.

### Telemetry

Skip in Phase 0-8. Add Sentry post-launch.

### Offline

Phase 2 ships TanStack Query with `query-async-storage-persister`. Reads work offline. Writes queue and sync.

### iOS readiness

Expo SDK 52 supports current iOS. Set deployment target to iOS 17 (covers `expo-share-extension`).

---

## Open questions (Travis decides at start of Phase 0)

1. **Bundle ID and scheme.** Plan uses `com.travisgilbert.theseus` and `theseus://`.
2. **App Store name.** Plan uses "Theseus".
3. **Apple Developer Program ($99/year) confirmed paid?** Required for share extension and TestFlight.
4. **OTA updates on every PR after TestFlight?** Free tier supports it.

## Open questions (Travis decides at start of Phase 1)

1. **Allowlist policy.** Single-user / list / open.
2. **Endpoint location.** Next.js (Option A) vs. Django (Option B).

---

## What this plan deliberately defers

- A native Swift port. RN exists to ship before Swift is feasible.
- Voice/dictation in chat.
- Branch-picker UI.
- Local LLM integration.
- Background sync of the entire graph (118K+ objects; always fetch on-demand).
- Any modifications to the live web app's UI surface.

---

## Definition of done

| # | Criterion | Phase |
|---|---|---|
| 0 | Live `/theseus` web app continues to mount PanelManager unchanged | every phase |
| 1 | Live web auth (NextAuth session cookies) continues to resolve `request.user` | 1 |
| 2 | App boots on iPhone, shows bottom tabs | 0 |
| 3 | Real GitHub OAuth, tokens in Keychain, refresh on expire | 1 |
| 4 | Threads list and conversation view, sync chat | 2 |
| 5 | Streaming chat via async ask + reasoning panel | 3 |
| 6 | Explorer in WebView with native Lens sheet | 4 |
| 7 | Plugins + Code panels | 5 |
| 8 | iOS share extension for quick capture | 6 |
| 9 | Push notifications + deep linking | 7 |
| 10 | TestFlight build live | 8 |

Criterion 0 is the load-bearing one. If at any point during implementation the web app at `/theseus` no longer mounts PanelManager, the implementation was wrong; revert.

Total: 12 to 14 working days of Claude Code time. 4 to 6 weeks of calendar.
