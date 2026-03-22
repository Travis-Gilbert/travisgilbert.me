# Studio Diagnosis and Rebuild Spec

> **For Claude Code.** Read this entire document before touching any files.
> No em dashes anywhere. Use colons, semicolons, commas, or periods instead.
> Run `npm run build` after each batch to verify zero errors before proceeding.

## Part 1: Why Publishing Does Not Work

### Root Cause: Three blocking failures in the HTTP layer

The Studio frontend (Next.js on Vercel) cannot communicate with the Django backend (Railway) for any write operation. The GitHub publishing mechanism itself is solid; the serializers, the commit logic, and the publish functions all work. The request never reaches them.

**Failure 1: No CORS configuration.**

The Studio frontend runs on Vercel (travisgilbert.me). The Django backend runs on Railway (draftroom.travisgilbert.me). These are different origins. The browser enforces the Same-Origin Policy and blocks cross-origin requests unless the server sends `Access-Control-Allow-Origin` headers.

Django has no CORS middleware. `django-cors-headers` is not in requirements. There is no `corsheaders` in `INSTALLED_APPS` or `MIDDLEWARE`. Some individual views may manually set `Access-Control-Allow-*` headers, but this is incomplete: it almost certainly misses the preflight OPTIONS request that browsers send before any cross-origin POST.

Result: every `fetch()` call from the Studio frontend to the Django API is blocked by the browser before it even reaches Django.

**Failure 2: CSRF blocks all POST requests.**

`django.middleware.csrf.CsrfViewMiddleware` is active in the middleware stack. The frontend uses `credentials: 'omit'` (the correct choice for cross-origin API calls). This means no session cookie and no CSRF cookie are sent. Django's CSRF middleware sees a POST with no CSRF token and returns 403 Forbidden.

Even if CORS were fixed, every POST (save, create, publish, delete, set-stage) would still fail with a CSRF error.

**Failure 3: No API authentication.**

The frontend adds a Bearer token header only for `/publish/` paths via `NEXT_PUBLIC_STUDIO_API_TOKEN`. But Django has no middleware, decorator, or view mixin that validates Bearer tokens. The Django views use session-based authentication (`LoginRequiredMixin` or equivalent). Since `credentials: 'omit'` means no session cookie is sent, the Django views see an unauthenticated request.

For non-publish API calls (list, save, create, delete), the frontend sends no authentication at all.

**Potential Failure 4: Environment variables.**

The `publisher/github.py` module reads `GITHUB_TOKEN` and `GITHUB_REPO` from Django settings. If these are not set in Railway's environment, publishing would fail at the GitHub API level even if all HTTP issues were resolved. `GITHUB_REPO` must be `Travis-Gilbert/travisgilbert.me` (case-sensitive).

### How the publish pipeline is supposed to work (when fixed)

```
Studio Frontend (Vercel)
  |
  | POST /editor/api/content/essay/my-slug/publish/
  | Headers: Authorization: Bearer <token>, Content-Type: application/json
  |
  v
Django Backend (Railway)
  |
  | StudioApiContentPublishView receives request
  | Validates Bearer token
  | Looks up Essay by slug
  | Calls publish_essay(essay)
  |   |
  |   | serialize_essay() -> frontmatter + markdown string
  |   | publish_file() -> GitHub Contents API PUT
  |   |   creates/updates src/content/essays/my-slug.md
  |   |   returns commit SHA
  |   | PublishLog.objects.create(...)
  |   | essay.stage = "published", essay.save()
  |   |
  | Returns JSON: {id, title, slug, stage: "published", ...}
  |
  v
GitHub receives commit
  |
  | Vercel git integration detects push
  | Triggers rebuild of Next.js site
  | New essay appears at travisgilbert.me/essays/my-slug
```

---

## Part 2: Fix Plan (Django Backend)

### Batch 0: CORS + Auth + CSRF

**Priority: This must work before anything else in this document.**

#### Step 1: Install django-cors-headers

File: `publishing_api/requirements/base.txt`

Add:
```
django-cors-headers>=4.3
```

File: `publishing_api/config/settings.py`

Add `"corsheaders"` to `INSTALLED_APPS`.

Add to `MIDDLEWARE` (must be before CommonMiddleware):
```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
```

Add CORS settings:
```python
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,https://travisgilbert.me,https://travisishere.vercel.app",
    ).split(",")
    if origin.strip()
]
CORS_ALLOW_HEADERS = [
    "accept", "authorization", "content-type", "origin", "x-requested-with",
]
CORS_ALLOW_METHODS = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
```

#### Step 2: Add Bearer token authentication

File: `publishing_api/apps/editor/auth.py` (NEW)

```python
"""
Simple Bearer token authentication for the Studio JSON API.

The token is set via STUDIO_API_TOKEN env var on Railway.
The Next.js frontend sends it in the Authorization header.
"""

import os
from functools import wraps
from django.http import JsonResponse

STUDIO_API_TOKEN = os.environ.get("STUDIO_API_TOKEN", "").strip()

def require_studio_token(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not STUDIO_API_TOKEN:
            return view_func(request, *args, **kwargs)
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return JsonResponse({"detail": "Authentication required."}, status=401)
        provided_token = auth_header[7:].strip()
        if provided_token != STUDIO_API_TOKEN:
            return JsonResponse({"detail": "Invalid token."}, status=403)
        return view_func(request, *args, **kwargs)
    return wrapper
```

#### Step 3: Create base view class for Studio API views

File: `publishing_api/apps/editor/api_base.py` (NEW)

```python
"""
Base view for all Studio JSON API endpoints.
CSRF exemption (token auth replaces CSRF), Bearer token validation,
standard JSON error responses.
"""

import json
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from apps.editor.auth import require_studio_token

@method_decorator(csrf_exempt, name="dispatch")
@method_decorator(require_studio_token, name="dispatch")
class StudioApiBaseView(View):
    def parse_json_body(self, request):
        if not request.body:
            return {}
        try:
            return json.loads(request.body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    def json_error(self, message, status=400):
        return JsonResponse({"detail": message}, status=status)
```

#### Step 4: Update all Studio API views to use the base class

File: `publishing_api/apps/editor/views.py`

Add import: `from apps.editor.api_base import StudioApiBaseView`

Change every `class StudioApi*View(View):` to inherit from `StudioApiBaseView` instead. Also change `EditorImageUploadView`, `CollageGenerateView`, `CollageCutoutsListView`, `ContentSearchView`, and `EditorMentionBacklinksView`.

Do NOT change HTMX views or Video API views.

#### Step 5: Frontend token fix

File: `src/lib/studio-api.ts`

Change:
```typescript
const publishToken = process.env.NEXT_PUBLIC_STUDIO_API_TOKEN;
if (publishToken && path.includes('/publish/')) {
    headers['Authorization'] = `Bearer ${publishToken}`;
}
```

To:
```typescript
const studioToken = process.env.NEXT_PUBLIC_STUDIO_API_TOKEN;
if (studioToken) {
    headers['Authorization'] = `Bearer ${studioToken}`;
}
```

#### Step 6: Environment variables

**Railway:**
```
STUDIO_API_TOKEN=<random 64-char hex>
GITHUB_TOKEN=<PAT with repo scope>
GITHUB_REPO=Travis-Gilbert/travisgilbert.me
GITHUB_BRANCH=main
CORS_ALLOWED_ORIGINS=https://travisgilbert.me,https://travisishere.vercel.app
```

**Vercel:**
```
NEXT_PUBLIC_STUDIO_API_TOKEN=<same token as Railway>
NEXT_PUBLIC_STUDIO_URL=https://draftroom.travisgilbert.me
```

#### Verification

- [ ] Content list loads (GET, no CORS errors)
- [ ] Create new essay (POST succeeds, no CSRF error)
- [ ] Save edits (POST succeeds)
- [ ] Publish (POST succeeds, response includes commit SHA)
- [ ] .md file appears in GitHub repo
- [ ] Vercel rebuilds, essay appears on public site
- [ ] `npm run build` passes

---

## Part 3: Design Token Unification

### Direction

Unify Studio tokens with the main site's design language. Studio is part of travisgilbert.me, not a separate product.

**What changes:**
- Body font: Cabin -> IBM Plex Sans
- Surfaces: align with main site dark ground range (#13110F to #1A1816)
- Text colors: align with cream/parchment scale
- Accent colors: normalize to exact main site values
- Borders: adopt thin 1px line philosophy

**What stays:**
- JetBrains Mono for metadata and machine-generated text
- Vollkorn for titles
- Writing surface light mode (editor-specific)
- Studio component interaction patterns

**What this does NOT touch:**
- CommonPlace's Dark Chrome Instrument (separate)
- Main site public-facing design (unchanged)

CSS-only change in `src/styles/studio.css`.

---

## Part 4: Edit-in-Place for the Main Site

### Problem

Studio cannot control homepage layout, navigation, static pages, or page compositions. The Django backend has models for all of this (`DesignTokenSet`, `NavItem`, `PageComposition`, `SiteSettings`). And `publish_site_config()` serializes them to `src/config/site.json`. The gap: no way to invoke these from the main site.

### Architecture

When authenticated, the main site pages gain an edit overlay. Not a separate route group. A conditional layer on existing pages.

**Phase 1: Auth gate.** Add `/editor/api/whoami/` endpoint. Main site layout checks on mount, sets `isAuthor` flag.

**Phase 2: Homepage edit mode.** Floating "Edit Layout" button. Sections become draggable. Featured content slots become searchable dropdowns. Save persists to Django, Publish commits to GitHub.

**Phase 3: Navigation editing.** Inline reorder, add/remove. Publishes through `publish_site_config()`.

**Phase 4: Static page editing.** Tiptap overlay on /now, /colophon, /connect. Saves to Django, publishes markdown to GitHub.

### What this means for Studio

Studio keeps: Tiptap editor, content lists, timeline, video production, workbench features (stash, tasks, research, revisions). These are writing tools.

Studio loses: page layout and site structure control. That moves to edit-in-place.

---

## Build Order

```
Batch 0: CORS + Auth + CSRF fix (Django)       <- FIRST
Batch 1: Frontend token fix (studio-api.ts)
Batch 2: Env var setup (Railway + Vercel)       <- Manual
Batch 3: End-to-end publish verification        <- Manual
Batch 4: Design token unification (studio.css)
Batch 5: Edit-in-place auth gate
Batch 6: Homepage edit mode
Batch 7: Navigation editing
Batch 8: Static page editing
```

## Open Questions

1. What is the Railway domain for the Django backend? Is it `draftroom.travisgilbert.me`?
2. Is GITHUB_TOKEN currently set on Railway?
3. Are there existing manually-committed content files in src/content/?
4. Keep or remove the Django HTMX editor UI?
5. Which page should get edit-in-place first: homepage or /now?
