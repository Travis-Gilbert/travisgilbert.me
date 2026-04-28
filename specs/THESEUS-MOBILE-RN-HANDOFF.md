# THESEUS-MOBILE-RN-HANDOFF · v1

> **What this is.** A planning doc Claude Code consumes via `plan-pro` to scope, scaffold, and ship `theseus-mobile`: an Expo / React Native iOS app that talks to the Django backend at `/api/v2/theseus/` and reaches TestFlight in 4 to 6 weeks.
>
> **Audience.** Claude Code with the `plan-pro` plugin. Travis as the human-in-the-loop reviewing each phase.
>
> **Scope edge.** Multi-user authentication is a launch blocker, not a "later" item. The plan ships real auth in Phase 1.

---

## Context

**The product.** Theseus is a self-organizing epistemic knowledge graph engine. The web app at `travisgilbert.me/theseus` is its primary surface. This RN app is the mobile companion — the surface a researcher uses on the train, capturing arxiv links from the iOS share sheet, getting a push when an overnight engine run produces a new tension.

**The constraint.** Solo founder. Launch is imminent. Swift native iOS is the long-term plan; RN is the bridge to ship in weeks instead of months without burning credibility on a janky PWA.

**Two repos, no monorepo (yet).**
- `Travis-Gilbert/travisgilbert.me` — Next.js 16 frontend + NextAuth
- `Travis-Gilbert/index-api` — Django + Ninja v2 backend
- `Travis-Gilbert/theseus-mobile` (new) — Expo RN app

**Tokens, types, and contracts get shared via the network.** The Django Ninja backend exposes OpenAPI at `/api/v2/openapi.json`; both web and mobile generate types from that. Style Dictionary turns one `tokens.json` into web CSS, RN theme, and (later) Swift theme.

---

## Stack decisions, decided

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **Expo SDK 52 + dev client** | EAS Build, OTA updates, no Xcode in the loop |
| Navigation | **Expo Router** | File-based, mirrors Next.js mental model |
| State | **Zustand** | Same primitives as web; minimal API |
| Server cache | **TanStack Query** + `query-async-storage-persister` | Offline reads via SQLite |
| Local DB | **expo-sqlite** | Required for offline thread cache |
| Streaming | **react-native-sse** | Standard SSE polyfill; consumes `/ask/stream/<job_id>/` directly |
| Markdown | **react-native-markdown-display** | Theming hooks; works with custom fonts |
| Styling | **NativeWind v4** | Tailwind-on-RN; lets Claude Code copy class strings from web v2 spec |
| Icons | **lucide-react-native** | Same icon set as web |
| Bottom sheets | **@gorhom/bottom-sheet** | The Lens UI; gesture-driven, reduce-motion aware |
| Auth storage | **expo-secure-store** | iOS Keychain |
| OAuth | **expo-auth-session** | GitHub OAuth flow native; redirects back to app |
| Push | **expo-notifications** | Engine-completion alerts |
| Share extension | **expo-share-extension** community plugin | Quick capture from Safari |
| WebView | **react-native-webview** | Hosts the cosmos.gl Explorer |
| Build/distrib | **EAS Build + EAS Submit** | One command to TestFlight |
| Codegen | **openapi-typescript** | `/api/v2/openapi.json` → `src/api/types.ts` |
| Tokens | **style-dictionary** | One source builds RN, web, future Swift |

**Hard "no" list (don't propose alternatives):**
- React Native CLI (bare workflow). Use Expo.
- Redux. Zustand exists already; don't introduce a second store paradigm.
- Realm or WatermelonDB. SQLite via TanStack persister is enough.
- Custom WebGL graph renderer in RN. Phase 4 wraps the existing cosmos.gl in a WebView. Native Metal port is the Swift app's job, not RN's.

---

## Auth: the honest version

Travis is single-user **today** (NextAuth GitHub OAuth restricted to `Travis-Gilbert`) but is days-to-weeks away from opening the app to other users. The mobile auth model has to be the launch auth model, not a stopgap.

**The chosen pattern: GitHub OAuth on mobile via expo-auth-session, backend issues session JWT.**

Flow:
1. RN opens the GitHub OAuth flow via `expo-auth-session` with scope `read:user`.
2. RN gets the OAuth code back at the `theseus://auth/callback` deep link.
3. RN POSTs the code to `/api/v2/auth/mobile-callback/` (new Django Ninja endpoint).
4. Backend exchanges the code with GitHub, validates the GitHub user, mints a signed JWT scoped to that user, sets a refresh token in the response body (not a cookie, since RN can't read those).
5. RN stores both tokens in SecureStore. Refresh token used to mint new access tokens when needed.
6. Every API call: `Authorization: Bearer <access_token>`.

**Backend side, two pieces of work:**
- Move auth from `request.user.is_authenticated` (NextAuth session cookie) to a Ninja `auth=` decorator that accepts JWT bearer tokens. The web frontend's NextAuth flow stays; it just exchanges its session for a JWT on first API call (or the API supports both auth methods, with cookies as the web-frontend's primary). This is a pre-existing concern; the mobile app forces it to surface.
- Add `/api/v2/auth/mobile-callback/` endpoint that takes a GitHub OAuth code, returns `{access_token, refresh_token, user}`.

**Why not API key for MVP?** Because Travis is launching, and "launch with a stopgap auth model and rewrite it in 3 weeks" is exactly the kind of lever-arm you don't want. JWT auth is one engineering Phase, not three.

**Why not pure expo-auth-session with GitHub directly?** Because the GitHub OAuth `client_secret` can't live in the RN app (decompilable). Backend exchanges the code so the secret stays server-side.

---

## Repo structure

```
theseus-mobile/
├── app/                              # Expo Router file-based routing
│   ├── _layout.tsx                   # Root: theme, query client, auth provider
│   ├── index.tsx                     # Splash → redirect on auth state
│   ├── (auth)/
│   │   ├── _layout.tsx               # Stack
│   │   └── sign-in.tsx               # GitHub button + flow
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Bottom tabs: Threads / Explorer / Plugins / Code
│   │   ├── threads.tsx               # Thread list
│   │   ├── explorer.tsx              # Hosts ExplorerWebView
│   │   ├── plugins.tsx
│   │   └── code.tsx
│   ├── threads/[id].tsx              # Conversation view
│   ├── lens/[nodeId].tsx             # Modal-presented Lens
│   └── settings.tsx
├── src/
│   ├── api/
│   │   ├── client.ts                 # fetch wrapper, token injection, refresh
│   │   ├── threads.ts
│   │   ├── graph.ts
│   │   ├── lens.ts
│   │   ├── plugins.ts
│   │   ├── code.ts
│   │   ├── auth.ts                   # mobile-callback + refresh
│   │   └── types.ts                  # generated from OpenAPI
│   ├── auth/
│   │   ├── AuthProvider.tsx
│   │   ├── useAuth.ts
│   │   └── token-store.ts            # SecureStore wrapper
│   ├── components/
│   │   ├── chat/
│   │   │   ├── Thread.tsx
│   │   │   ├── Message.tsx           # User and Assistant variants
│   │   │   ├── Composer.tsx          # rounded-3xl, brass focus ring
│   │   │   ├── Reasoning.tsx         # collapsible, heartbeat pulse
│   │   │   ├── Citations.tsx
│   │   │   ├── Welcome.tsx           # 4-card 2x2 stagger
│   │   │   └── ActionBar.tsx         # copy/reload/more
│   │   ├── explorer/
│   │   │   ├── ExplorerWebView.tsx   # hosts /theseus/_mobile/explorer
│   │   │   └── LensSheet.tsx         # @gorhom/bottom-sheet
│   │   ├── plugins/
│   │   │   ├── ConnectorsTab.tsx
│   │   │   ├── McpTab.tsx
│   │   │   └── SkillsTab.tsx
│   │   ├── code/
│   │   │   ├── CodeStats.tsx
│   │   │   ├── CodeGraphPreview.tsx  # smaller WebView
│   │   │   └── HotFiles.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── IconButton.tsx
│   │       └── Sheet.tsx
│   ├── theme/
│   │   ├── tokens.ts                 # generated from style-dictionary
│   │   ├── ThemeProvider.tsx
│   │   └── fonts.ts                  # Vollkorn + IBM Plex via expo-font
│   ├── stores/
│   │   ├── threadStore.ts
│   │   ├── engineStore.ts            # warm/cold state
│   │   └── connectionStore.ts
│   ├── lib/
│   │   ├── sse.ts                    # react-native-sse wrapper
│   │   ├── push.ts                   # expo-notifications
│   │   ├── share-target.ts           # quick-capture handler
│   │   └── deep-link.ts
│   └── hooks/
│       ├── useStreamingAsk.ts
│       └── useThread.ts
├── tokens/
│   └── tokens.json                   # mirrored from travisgilbert.me eventually
├── ios/                              # Expo prebuild output (gitignored)
├── share-extension/                  # iOS share extension target
├── scripts/
│   ├── codegen-api.ts                # OpenAPI → TS types
│   └── build-tokens.ts               # style-dictionary
├── app.config.ts                     # Expo config, plugins, scheme
├── eas.json                          # Build profiles
├── metro.config.js
└── package.json
```

---

## Phase plan

Each phase is a Claude Code session. Phases are ordered so each one ships something demoable and the auth foundation lands first.

### Phase 0 · Bootstrap (4 hours)

**Read first:**
- The web app's `src/styles/theseus.css` lines 11-77 (token block — to mirror in `tokens.json`)
- The v2 mobile shell spec at `specs/SPEC-THESEUS-MOBILE-SHELL-2_0.md` in `travisgilbert.me`
- The web app's `src/components/theseus/atlas/AtlasEmblem.tsx`

**Goal.** New repo, Expo SDK 52 dev client, file-based routing, theme provider, four placeholder tabs.

**Deliverable:**
1. `Travis-Gilbert/theseus-mobile` initialized with `npx create-expo-app theseus-mobile -t expo-template-blank-typescript`. Upgrade to dev client.
2. `app.config.ts` with bundle ID `com.travisgilbert.theseus`, scheme `theseus`, associated domains `travisgilbert.me`.
3. NativeWind v4 wired with `tailwind.config.js` referencing `tokens/tokens.json` colors.
4. Vollkorn + IBM Plex Sans + Mono loaded via `expo-font` from Google Fonts URLs.
5. Bottom tab navigator with four routes (`threads`, `explorer`, `plugins`, `code`). Each renders a placeholder card with the route name.
6. Tab bar uses `lucide-react-native` icons matching the v2 mockup (Chat, Graph, Plugins-grid, Code-chevrons).
7. `tokens/tokens.json` initial cut — palette ported from cool-slate v2.
8. README explaining how to run dev client, how to push to EAS Build.
9. Place `.well-known/apple-app-site-association` JSON at `travisgilbert.me/public/.well-known/apple-app-site-association` so universal links are ready when push lands.

**Verification:** `npx expo start --dev-client` opens the app on iPhone via Expo Go (or the dev client build). Bottom nav renders. Tapping a tab swaps the placeholder. Cool slate background, brass active-tab indicator.

**Out of scope:** real screens, API calls, auth.

---

### Phase 1 · Auth (real, not a stub) (2 days)

**Read first:**
- `index-api/config/api_v2.py`
- `index-api/apps/notebook/api/intelligence.py` for current auth pattern (`request.user`)
- `travisgilbert.me/src/lib/auth.ts` (NextAuth GitHub config)
- `expo-auth-session` GitHub provider docs

**Goal.** Real GitHub OAuth on mobile. Backend issues JWTs. Web frontend keeps working unchanged. Mobile sends `Authorization: Bearer <access_token>` on every call.

**Backend work (Django, in `index-api`):**

1. New file `apps/auth/api.py` with two endpoints:
   - `POST /api/v2/auth/mobile-callback/`: takes `{code: str, redirect_uri: str}`, exchanges with GitHub, validates the user against the existing allowlist (open this up to all users now or keep allowlist depending on launch state), mints `{access_token, refresh_token, user: {id, login, ...}}`. Access token TTL 1 hour, refresh TTL 30 days.
   - `POST /api/v2/auth/refresh/`: takes `{refresh_token}`, returns `{access_token}`.
2. Use `pyjwt` for JWT (likely already a transitive dep; verify). Sign with `SECRET_KEY` from settings.
3. New Ninja auth class `apps/auth/jwt_auth.py` with a `JWTAuth(HttpBearer)` that validates the bearer token and sets `request.user`. Apply via `auth=JWTAuth()` on routes, or globally in `api_v2.py` with a fallback to session-cookie auth so the web frontend keeps working.
4. Migration: `User` model already exists (Django default). Add `mobile_refresh_tokens` table for revocation.
5. Tests: Pytest cases for happy path + expired tokens + revoked tokens.

**Mobile work (RN):**

1. `app/(auth)/sign-in.tsx`: a single screen with the brand mark, "Sign in with GitHub" button. On tap, opens `expo-auth-session` with GitHub as the provider, redirect URI `theseus://auth/callback`.
2. `src/auth/AuthProvider.tsx`: React context exposing `{user, signIn, signOut, isLoading}`. On mount, reads tokens from SecureStore. On 401, attempts refresh once before failing.
3. `src/api/client.ts`: fetch wrapper. Reads access token from token store. On 401, calls refresh, retries once. On second 401, calls `signOut`.
4. `app/_layout.tsx` redirects to `(auth)/sign-in` if not authenticated.

**Verification:**
- Cold start the app while signed out → sign-in screen.
- Tap "Sign in with GitHub" → Safari View Controller opens GitHub OAuth → grant → redirects back into the app.
- App now shows the bottom tabs. SecureStore has tokens.
- Hard-restart the app → tabs render immediately, no re-login.
- Manually expire the access token (decrement exp claim in dev) → next API call refreshes silently.
- Tap "Sign out" in settings → token store cleared, back to sign-in.

**Hard problems addressed:**
- *GitHub `client_secret` exposure?* Mobile sends only the OAuth `code`; the secret stays in Django.
- *Web frontend regressions?* The new JWT auth runs alongside session cookies. NextAuth session calls hit a wrapper that mints a JWT internally so `request.user` resolves identically.
- *Refresh-token theft?* 30-day TTL, server-side revocation table, single-use refresh tokens (each refresh issues a new refresh token, old one is revoked).

---

### Phase 2 · Threads list and basic chat (2 days)

**Read first:**
- `index-api/apps/notebook/api/intelligence.py` (`/ask/`, schema `AskRequest`/`AskResponse`)
- The v2 mobile shell spec for chat patterns (welcome, user/assistant messages, composer, follow-ups)
- `react-native-markdown-display` README

**Goal.** Threads tab works end-to-end with non-streaming chat. Full token swap from web v2 spec is mirrored in RN.

1. **Codegen.** `scripts/codegen-api.ts` runs `openapi-typescript` against `https://travisgilbert.me/api/v2/openapi.json` (or the staging domain) → writes `src/api/types.ts`. Add `npm run gen:api` to package.json.
2. **Thread list (`app/(tabs)/threads.tsx`).** GET `/api/v2/theseus/threads/` (likely needs adding on backend if not present; verify before scoping). FlatList of thread cards with title, last-message preview, timestamp.
3. **Welcome state (`Welcome.tsx`).** Display heading + lede + 2x2 suggestion grid. Suggestions hardcoded in v1; pull from briefing endpoint in v2.
4. **Conversation view (`app/threads/[id].tsx`).** FlatList inverted, scrolls bottom-up. Pull thread messages from API.
5. **Message components.**
   - `Message.tsx` branches on role.
   - User: right-aligned, `bg-paper-2`, `rounded-2xl`, padding `px-4 py-2.5`.
   - Assistant: full-width, no bubble, Vollkorn 15px / 1.6, citations as inline links with forest-green underline.
6. **Composer.** Bottom-sheet style stuck above the keyboard via `KeyboardAvoidingView`. Rounded-3xl, brass focus ring on `:focus`. 32x32 send button (paper-ink circle, ArrowUp icon).
7. **Send flow.** POST to `/ask/` (sync endpoint for now). Show local message immediately, swap with server response on resolve. No streaming yet.
8. **Action bar.** Copy / Reload / More. Auto-hides on `not-last`.

**Verification:**
- Tap Threads tab → see a list of recent threads.
- Tap a thread → see messages with proper user/assistant differentiation.
- Type a message in the composer → focus ring appears in brass → tap send → user message appears immediately, assistant message streams in after the API call completes.
- Pull-to-refresh on thread list works.
- Action bar appears on the most recent assistant message only.

---

### Phase 3 · Streaming chat via async ask (1.5 days)

**Read first:**
- `index-api/apps/notebook/api/intelligence.py` lines for `ask_theseus_async` and `ask_theseus_stream_job` (the Redis pub/sub flow)
- `react-native-sse` README

**Goal.** Replace Phase 2's sync `/ask/` with the async pair `POST /ask/async/` + `GET /ask/stream/<job_id>/`. Tokens stream into the assistant message. Reasoning panel shows live during the `stage` events.

1. **`useStreamingAsk` hook.** Takes a query, returns `{tokens, stages, isComplete, isError}`. Internally:
   - POSTs to `/ask/async/` to get `{job_id, stream_url}`.
   - Opens an SSE connection via `react-native-sse` to `stream_url`.
   - Routes events: `stage` → updates progress, `token` → appends to message, `complete` → finalizes, `error` → sets error.
2. **Reasoning component.** Above the assistant message while `stages` is non-empty. Heartbeat pulse animation while streaming. Collapses when `isComplete`.
3. **Streaming render.** Tokens append to the assistant message in place. Markdown re-renders incrementally (debounce to 100ms to avoid layout thrash).
4. **Cancel button.** During streaming, the send button becomes a Stop button (square icon). On tap, closes the SSE connection. The job continues server-side; the user just stops receiving updates.
5. **Reconnect on app foreground.** If a stream was active when the app backgrounded, on foreground call `/ask/status/<job_id>/` to fetch the final result.

**Verification:**
- Send a query → reasoning panel appears with stage updates → tokens stream into the message → reasoning collapses on completion.
- Background the app mid-stream → foreground → message picks up where it left off.
- Tap stop mid-stream → message stops growing; can resend.

---

### Phase 4 · Explorer via WebView (2.5 days)

**Read first:**
- `travisgilbert.me/src/components/theseus/explorer/` — find the cosmos.gl wrapper component
- `react-native-webview` README sections on `injectedJavaScript` and `postMessage`
- `@gorhom/bottom-sheet` README

**Goal.** Explorer tab renders the existing cosmos.gl Explorer in a full-screen WebView. Tap a node → native bottom sheet opens with the Lens.

**Web work (in `travisgilbert.me`):**

1. New route `app/theseus/_mobile/explorer/page.tsx` that renders only the cosmos.gl canvas + zoom controls + cos-sim readout. No top bar, no nav, no sidebar.
2. The route accepts a JWT in a query param `?token=...` OR via `postMessage` after mount. It uses that token for `/api/v2/theseus/graph/` API calls instead of the NextAuth cookie.
3. On node tap, the route does `window.ReactNativeWebView?.postMessage(JSON.stringify({type: 'tap-node', nodeId}))`. The optional chain means the route still works in a regular browser.
4. New Ninja endpoint `/api/v2/theseus/graph/?bbox=...&zoom=...` returns viewport-clipped graph data so the WebView doesn't ship 100K nodes to a phone.

**Mobile work:**

1. `app/(tabs)/explorer.tsx` renders a full-bleed `<WebView>` pointing at `https://travisgilbert.me/theseus/_mobile/explorer`.
2. On WebView mount, inject the JWT via `injectedJavaScriptBeforeContentLoaded`: `window.__THESEUS_TOKEN = "..."`. The route reads that.
3. `onMessage` handler on the WebView receives `{type: 'tap-node', nodeId}` events.
4. On tap-node, open a `@gorhom/bottom-sheet` modal at 50% snap point with the Lens content.
5. Lens content fetches from `/api/v2/theseus/lens/<nodeId>/` (existing endpoint per `lens.py`). Renders title, summary, evidence, related nodes, and a "Explain this" button that calls `/explain_node/` for streaming.
6. Snap points: 50% (default), 90% (full-read), dismiss on swipe down.

**Verification:**
- Tap Explorer tab → WebView loads the cosmos.gl canvas in <2s.
- Pinch-zoom feels native (touch-action handled in the web route).
- Tap a node → bottom sheet slides up with the Lens.
- Tap "Explain this" inside Lens → streaming explanation appears.
- Swipe down on the sheet → dismissed, graph still in same position.
- Background-then-foreground the app → graph state persists.

**Hard problems addressed:**
- *WebView pauses when occluded?* The bottom sheet uses 50% snap so the WebView stays partially visible and rendering. At 90% snap the WebView is fully covered but that's brief.
- *Auth in the WebView?* JWT injection at mount time. The web route uses it for API calls and ignores cookies.
- *Performance on 10K+ nodes?* The `/graph/` viewport endpoint returns only what's visible. cosmos.gl handles 5K nodes at 60fps on iPhone 12+.

---

### Phase 5 · Plugins + Code panels (1.5 days)

**Read first:**
- The v2 mockup screen D (Plugins) and E (Code) for visual reference
- `index-api/apps/plugins/api.py` (verify exists; likely needs minor additions)
- `index-api/apps/notebook/api/code.py`

**Goal.** Plugins tab renders the merged Connectors / MCP / Skills view. Code tab renders the file-graph preview and hot-files list.

1. **Plugins screen (`app/(tabs)/plugins.tsx`).** Three tabs via segmented control. Each tab fetches its data:
   - Connectors: `GET /api/v2/plugins/connectors/`
   - MCP: `GET /api/v2/plugins/mcp/`
   - Skills: `GET /api/v2/plugins/skills/`
2. Card pattern: 36x36 monogram + name + detail line + status dot + on/off toggle. Toggle calls `POST /api/v2/plugins/{kind}/{id}/toggle/`.
3. **Code screen (`app/(tabs)/code.tsx`).**
   - Header stat row: `GET /api/v2/theseus/code/stats/` returns `{files, symbols, drift_count}`.
   - Mini graph: smaller WebView pointing at `https://travisgilbert.me/theseus/_mobile/code-graph`.
   - Hot files: `GET /api/v2/theseus/code/hot-files/?since=24h` returns ranked list. FlatList with file path (mono), kind dot, churn count.
   - Tap a file → push to a detail screen showing the file's subgraph in a WebView.

**Verification:**
- Plugins tab loads in <1s. Toggling a connector reflects optimistically + persists across restart.
- Code tab loads stats, mini-graph, hot files all simultaneously.
- Tap a hot file → opens detail screen with subgraph.

---

### Phase 6 · Quick capture share extension (1.5 days)

**Read first:**
- `expo-share-extension` plugin docs
- iOS Share Extension Apple docs (for the manual config plugin path if needed)

**Goal.** User in Safari hits Share → Theseus appears in the share sheet → tapping it sends the URL to the backend, which creates a new thread + starts ingestion + sends a push when ready.

1. New backend endpoint `POST /api/v2/theseus/quick-capture/` takes `{url, kind, user_token}`, creates a new thread with the URL as the first message, enqueues an ingestion job, returns `{thread_id, status: 'queued'}`.
2. Add `expo-share-extension` to `app.config.ts` plugins. Configure the share extension target to accept URLs and plain text.
3. The share extension's RN bundle is minimal: just enough UI to show "Saving to Theseus..." and call the API. Reads the JWT from the shared App Group keychain (configured during Phase 1).
4. On success, the extension dismisses with a success toast.
5. The main app deep-links to the new thread on next foreground.

**Verification:**
- Open Safari → share an arxiv URL → Theseus in share sheet → tap → "Saved" within 2s.
- Open Theseus app → new thread is at the top of the threads list.
- Engine processes ingestion → push notification fires → tap notification → deep links to the thread.

**Hard problems addressed:**
- *App Group setup?* Must configure during Phase 0's `app.config.ts`. Add to the checklist.
- *Token sharing across processes?* App Group keychain. SecureStore needs to be configured with the App Group identifier.

---

### Phase 7 · Push notifications + deep linking (1 day)

**Read first:**
- `expo-notifications` setup guide
- Apple's `apple-app-site-association` schema

**Goal.** App receives push on engine events (ingestion complete, new tension, hypothesis ready). Tap deep links to the relevant thread / lens.

1. Backend integration: a Django signal on `Object.objects.post_save` for objects in `(Tension, Hypothesis, IngestionJob.complete)` posts to Expo Push API with the user's device token.
2. `app/_layout.tsx` registers for push on first launch. Stores the device token in the user's profile via `POST /api/v2/auth/device-token/`.
3. Notification content includes a `url` field like `theseus://threads/abc123` or `theseus://lens/node-456`.
4. `src/lib/deep-link.ts` parses these and calls `router.push(...)` from Expo Router.

**Verification:**
- Trigger a manual engine event → push arrives within 5s.
- Tap notification with app closed → cold-launches into the relevant thread.
- Tap notification with app foregrounded → in-app banner; tap navigates.

---

### Phase 8 · Polish + TestFlight (1 day)

1. App icon (PCB-green emblem at 1024x1024). Splash screen matching the welcome state. Status bar config.
2. App Store Connect metadata: name, subtitle, description (don't ship marketing copy yet — minimal real text), keywords, screenshots from the actual app on iPhone 14 Pro.
3. EAS Build production profile. Run `eas build -p ios --profile production`.
4. EAS Submit to TestFlight. Add Travis as the first internal tester.
5. README in the repo: how to add testers, how to push OTA updates via EAS Update.

**Verification:** TestFlight build installable on Travis's iPhone within 24h of submitting (Apple review for first build can take a day; subsequent builds bypass review).

---

## Cross-cutting concerns

### Sync between web and mobile

**Now:** types and tokens duplicated, kept in sync via `npm run gen:api` (codegen) and a manual copy of `tokens.json`.

**Next (post-launch):** convert `travisgilbert.me` to pnpm workspaces, extract `packages/theseus-tokens` and `packages/theseus-api-types`. Both web and mobile import directly. No copy.

**Don't do this in Phase 0-8.** Adding pnpm workspace conversion to the critical path is a yak-shave. Wait until both apps are live.

### Telemetry

Skip in Phase 0-8. After launch, add Sentry (`@sentry/react-native`) and PostHog. Don't gate launch on instrumentation.

### Offline

Phase 2 ships TanStack Query with `query-async-storage-persister` so reads work offline by default. Writes queue and sync on reconnect (Phase 6 quick-capture extends this pattern). No additional offline work needed in initial scope.

### iOS 26 readiness

Apple released iOS 26 in late 2025; current production iOS is 26.x. Expo SDK 52 supports iOS 26. The `expo-share-extension` plugin is on iOS 17+. Travis's TestFlight users are likely on iOS 26 or 25. Set deployment target to iOS 17.

---

## Open questions for Travis

1. **Multi-user rollout.** Are you opening to all GitHub users at launch, or maintaining the allowlist + adding a small set of beta users by username? This determines whether the mobile-callback endpoint validates against an allowlist or allows-all-authenticated.
2. **Bundle ID / scheme.** Plan uses `com.travisgilbert.theseus` and `theseus://`. Push back if you want different.
3. **App Store name.** Plan uses "Theseus". Some founders use suffixes like "Theseus." or "Theseus Engine" for App Store SEO. Your call.
4. **OTA update strategy.** EAS Update is free for hobby tier. Plan to ship every PR as an OTA update once on TestFlight. Yes/no?
5. **Apple Developer Program.** $99/year, required for share extensions and TestFlight. Confirmed already paid?

---

## What this plan deliberately defers

- A native Swift port. The whole point of RN is to ship before Swift is feasible. Swift is its own roadmap.
- Voice/dictation in chat (assistant-ui has a `voice` primitive; RN equivalent is `expo-speech` + `expo-speech-recognition`). Defer to post-launch.
- Branch-picker UI for message threads. Theseus doesn't have message branching today.
- Local LLM integration for offline reasoning. The Theseus model swarm runs server-side; mobile is a client.
- Background sync of the entire graph. The user is on cellular sometimes; the graph is 118K+ objects. Always fetch on-demand.

---

## Definition of done (the whole project)

| Criterion | Lands in phase |
|---|---|
| App boots on iPhone, shows bottom tabs | 0 |
| Real GitHub OAuth, tokens in Keychain, refresh on expire | 1 |
| Threads list and conversation view, sync chat | 2 |
| Streaming chat via async ask + reasoning panel | 3 |
| Explorer in WebView with native Lens sheet | 4 |
| Plugins (3 sub-tabs) + Code (stats + mini-graph + hot files) | 5 |
| iOS share extension for quick capture | 6 |
| Push notifications + deep linking | 7 |
| TestFlight build live | 8 |

Total: 12 to 14 working days of Claude Code time. 4 to 6 weeks of calendar.

---

## What plan-pro should produce from this

Eight handoff documents — one per phase — each:
- Numbered batches with concrete file paths
- "Read first" file lists at the top of each batch
- Per-batch verification steps
- `npm run build` (mobile uses `npx expo start` to verify no build errors) and `npm run typecheck` gates between batches
- Concrete code snippets where the choice is unambiguous (e.g. the AuthProvider shape, the SSE hook signature)
- Permissive intent for everything else; let Claude Code make the call

Phase 0 and Phase 1 should be written first; the rest can wait for the first phase to ship and reveal what assumptions need correcting.
