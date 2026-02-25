# travisgilbert.com

Personal creative workbench: a living record of work, interests, and thinking. Studio-journal aesthetic with hand-drawn visual elements. Not a traditional portfolio or resume.

**Live site:** [travisgilbert.com](https://travisgilbert.com)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, static site generation) |
| UI | React 19 |
| Styling | Tailwind CSS v4, CSS custom properties |
| Hand-drawn visuals | rough.js, rough-notation |
| Typography | 7 fonts via `next/font` (Vollkorn, Cabin, IBM Plex Sans, Ysabeau, Courier Prime, Space Mono, Amarna) |
| UI primitives | Radix UI (Accordion, Collapsible, Toggle Group, Tooltip) |
| Icons | Phosphor (functional UI) + custom SketchIcon system (brand identity) |
| Content | Markdown + gray-matter + remark, Zod schema validation |
| Hosting | Vercel (auto-deploy from `main`) |
| Publishing | Django Studio in `publishing_api/` (HTMX, GitHub Contents API pipeline) |

## Getting Started

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at localhost:3000
npm run build      # Production build (static export)
npm run start      # Serve production build locally
npm run lint       # Run Next.js linter
```

## Project Structure

```
src/
  app/              App Router pages and layouts
  components/       React components (Server + Client)
  components/rough/ Client Components for rough.js visuals
  content/          Markdown content (essays, field-notes, shelf, toolkit, projects)
  lib/              Content loading, utilities, Zod schemas
  styles/           Design tokens and global CSS
public/
  fonts/            Self-hosted Amarna variable font
  collage/          Hero fragment images
publishing_api/     Django Studio: writing interface and GitHub publish pipeline
docs/
  records/          Architecture decisions and implementation plans
  notes/            Session notes (gitignored)
```

## Content Workflow

1. Create a `.md` file in the appropriate `src/content/` subdirectory
2. Add frontmatter matching the Zod schema in `src/lib/content.ts`
3. Push to `main` (Vercel auto-deploys)

Content types: `essays`, `field-notes`, `shelf`, `toolkit`, `projects`, `now.md`

## Django Studio

The publishing API lives in `publishing_api/`. It provides a writing interface that publishes content to this repo via the GitHub Contents API.

```bash
cd publishing_api
python manage.py import_content             # Import markdown into Django DB
python manage.py import_content --dry-run   # Parse and report without writing
python manage.py import_content --type essays  # Import one content type
```

Status: scaffolded, not yet deployed. See `docs/records/002-publishing-api.md`.

## Deployment

Vercel with native Next.js builder. Git integration auto-deploys on push to `main`. No `vercel.json` needed.
