# 002: Publishing API (Django Studio)

## Summary

Django backend that provides a dedicated writing interface for all site content types. Replaces the manual workflow of creating `.md` files and pushing to GitHub with a browser-based editor that serializes content, commits via the GitHub Contents API, and triggers Vercel auto-deploy.

## Motivation

The manual `.md` + git push workflow lacks a completion signal. The user has OCD/ADHD and needs the tactile satisfaction of a "Publish" button to feel that work is done. A dedicated writing interface also provides a better authoring experience than editing raw markdown in a code editor.

## Architecture

### Delivery Pipeline

```
Django Editor → Model → Serializer → GitHub Contents API → Vercel auto-deploy
```

Three-layer publisher pipeline:
1. **Serializers** (`publisher/serializers.py`): Model instances to YAML frontmatter + markdown body. Maps Django snake_case to camelCase YAML keys.
2. **GitHub Client** (`publisher/github.py`): Base64 encodes content, PUTs via GitHub Contents API (creates or updates). Returns commit SHA.
3. **Publish Orchestrators** (`publisher/publish.py`): Ties serialization + commit + audit log together per content type.

### Content Models

6 models in `apps/content/models.py`, mirroring Zod schemas from `src/lib/content.ts`:
- `Essay`: title, slug, date, summary, body, youtube_id, tags (JSONField), sources, stage, annotations
- `FieldNote`: title, slug, date, body, tags, excerpt, status, featured
- `ShelfEntry`: title, slug, creator, type, annotation, url, tags
- `Project`: title, slug, role, description, year, organization, urls (JSONField), tags
- `NowPage`: singleton with researching/reading/building/listening/thinking fields
- `PublishLog`: audit trail with commit SHA, success/failure

All models auto-generate slugs from title on save.

### Editor

Django templates + HTMX. Ulysses-inspired aesthetic: warm neutral palette, minimal chrome, serif body text.

Key views:
- Dashboard: drafts, recent publishes, quick-create buttons
- Content editors: split-pane (metadata sidebar + writing surface)
- Now page: 2x2 card grid for current activities
- Publish: HTMX POST endpoint returns JSON, toast notification

### Auth

Single superuser via Django admin auth. `LoginRequiredMixin` on all editor views. No public-facing endpoints.

### StudioShortcut Integration

`StudioShortcut.tsx` is an invisible Client Component in `layout.tsx` that listens for Ctrl+Shift+E (or Cmd+Shift+E). Maps the current Next.js pathname to the corresponding Django editor URL and opens it in a new tab. Uses `NEXT_PUBLIC_STUDIO_URL` env var.

## File Structure

```
publishing_api/
├── apps/
│   ├── core/          # Custom User model, TimeStampedModel base
│   ├── content/       # All 6 content models + admin config
│   ├── publisher/     # Serializers, GitHub client, publish orchestrators
│   └── editor/        # Views, forms, URL routing
├── config/            # Django settings, root URLs
├── templates/         # base.html, dashboard, edit, content_list, edit_now
├── static/
│   ├── css/studio.css # Ulysses-inspired stylesheet with brand colors
│   └── js/studio.js   # Character counters, Tab-indent, Cmd+S shortcut
├── requirements/      # base, development, production
├── Procfile           # Railway deployment (gunicorn + migrate)
└── .env.example       # GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH
```

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Delivery mechanism | GitHub Contents API commits | Preserves SSG architecture; Vercel auto-deploys on push; no runtime API needed |
| Editor tech | Django templates + HTMX | Avoids second SPA; HTMX gives interactivity without React complexity |
| Auth | Single superuser | Only one author; Django admin auth is sufficient |
| Owner shortcut | Keyboard shortcut (Ctrl+Shift+E) | Invisible to visitors; no UI clutter; Django auth still protects the editor |
| Deployment | Railway | Existing familiarity; good Django support; simple Procfile deploy |
| camelCase YAML | Serializers map snake_case to camelCase | Zod schemas on the Next.js side expect camelCase keys |

## Deployment

Target: Railway with PostgreSQL. Env vars: `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, `DATABASE_URL`, `SECRET_KEY`, `DEBUG`.

## Status

**Scaffolded.** All models, views, templates, and publisher pipeline are written. Django check passes (0 issues). Migrations generated. Not yet deployed or tested end-to-end.

### Next steps to production

1. Set up Railway project and PostgreSQL
2. Create `.env` with real GitHub token
3. `createsuperuser` for login
4. Test publish pipeline with a draft essay
5. Set `NEXT_PUBLIC_STUDIO_URL` in Vercel environment
