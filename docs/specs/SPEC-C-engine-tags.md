# Spec C: Engine Tag System

> **For Claude Code. Read entire spec before writing code.**
> **Can be built in parallel with Spec A (touches different files).**
> **Run `npm run build` after every batch. Do not proceed if the build fails.**

## Architecture Summary

The engine tag system surfaces epistemic state on object cards through three
layers of increasing detail:

1. **Status badge** (always visible): One pill per object. Rollup of claim
   statuses. Dashed border = machine-generated, solid = human-reviewed.
2. **Signal pips** (visible on hover): Small colored dots indicating engine
   findings. Each pip type has a fixed color and a one-line tooltip.
3. **Full provenance** (in ObjectDrawer): Claims, evidence links, tensions,
   and stress test findings rendered in the Connections tab.

### Key design decisions

- No em dashes anywhere in code, comments, or copy.
- Evidence is NOT a toolbox component. It surfaces through this tag system.
- Status badges are derived (computed from claims), not stored on the Object.
- Dashed outlines = machine (EpistemicStatus: captured through extracted).
- Solid outlines = human-confirmed (EpistemicStatus: reviewed through learned_from).
- "Stale" is replaced by "Refuted" (active belief change) and "Dormant"
  (no recent activity, ambiguous cause).

---

## Batch 1: Backend migration (Claim.Status + API extension)

### Read first
- `apps/notebook/models/epistemic.py` (Claim model)
- `apps/notebook/models/_shared.py` (EpistemicStatus)
- `apps/notebook/serializers.py`
- `apps/notebook/views.py` (object list endpoint)

### Migration: Add `refuted` to Claim.Status

```python
class Claim(TimeStampedModel):
    class Status(models.TextChoices):
        PROPOSED = 'proposed', 'Proposed'
        SUPPORTED = 'supported', 'Supported'
        CONTESTED = 'contested', 'Contested'
        REFUTED = 'refuted', 'Refuted'       # NEW
        SUPERSEDED = 'superseded', 'Superseded'
        ARCHIVED = 'archived', 'Archived'
```

Generate and run migration:
```bash
python manage.py makemigrations notebook
python manage.py migrate
```

### API extension: tag_summary on object list

Extend the object list serializer to include computed epistemic signals.

```python
class TagSummary:
    badge: str | None        # proposed | supported | contested | refuted | superseded | None
    badge_confirmed: bool    # True if epistemic_status >= reviewed
    pips: list[dict]         # [{ type: 'evidence', count: 8 }, ...]
    needs_review: bool       # True if queued PromotionItems or EvidenceLinks exist
```

Badge rollup logic:

```python
def compute_status_badge(obj) -> str | None:
    claims = obj.claims.all()
    if not claims.exists():
        return None
    if claims.filter(status='refuted').exists():
        return 'refuted'
    if claims.filter(status='contested').exists():
        return 'contested'
    if claims.filter(status='supported').exists():
        return 'supported'
    return 'proposed'
```

For list views, use queryset annotations to avoid N+1:

```python
from django.db.models import Count, Q, Max
from django.utils import timezone
from datetime import timedelta

objects_qs = Object.objects.annotate(
    claim_count=Count('claims'),
    supported_count=Count('claims', filter=Q(claims__status='supported')),
    contested_count=Count('claims', filter=Q(claims__status='contested')),
    refuted_count=Count('claims', filter=Q(claims__status='refuted')),
    tension_count=Count(
        'tensions',
        filter=Q(tensions__status__in=['open', 'investigating']),
    ),
    latest_evidence_at=Max('claims__evidence_links__created_at'),
)
```

Dormant condition: `latest_evidence_at` is more than 90 days ago AND
no claim has status `refuted`.

### Verification
- [ ] Migration adds 'refuted' to Claim.Status choices
- [ ] Object list endpoint includes `tag_summary` field
- [ ] Badge rollup computes correctly for all statuses
- [ ] Pip signals aggregate correctly
- [ ] Dormant flag triggers after 90 days of inactivity
- [ ] Existing tests pass
- [ ] `python manage.py test apps.notebook` passes

---

## Batch 2: Status badge component (frontend)

### Read first
- `src/components/commonplace/objects/ObjectRenderer.tsx`
- `src/lib/commonplace.ts` (API types)

### New types in `src/lib/commonplace.ts`

```typescript
export interface TagSummaryPip {
  type: 'evidence' | 'tension' | 'refuted' | 'candidate' | 'dormant';
  count: number;
}

export interface TagSummary {
  badge: 'proposed' | 'supported' | 'contested' | 'refuted' | 'superseded' | null;
  badge_confirmed: boolean;
  pips: TagSummaryPip[];
  needs_review: boolean;
}
```

Extend `ObjectListItem`:
```typescript
tag_summary?: TagSummary;
```

### New file: `src/components/commonplace/objects/StatusBadge.tsx`

```typescript
interface StatusBadgeProps {
  status: string;
  confirmed: boolean;
}
```

Visual rules:

| Status | Border color | Text color | Fill |
|--------|-------------|------------|------|
| proposed | #88868E | #88868E | transparent |
| supported | #0F6E56 | #0F6E56 | transparent |
| contested | #A32D2D | #A32D2D | transparent |
| refuted | #A32D2D | #791F1F | #FCEBEB |
| superseded | #88868E | #88868E | transparent |
| needs review | #BA7517 | #854F0B | #FAEEDA |

When `confirmed` is false: `border-style: dashed` (machine-generated).
When `confirmed` is true: `border-style: solid` (human-confirmed).

Badge shape: pill (border-radius: 14px). Height: 18-20px.
Font: mono 10px. Sentence case.

### Integration with object cards

Render `StatusBadge` at the bottom-left of each object card when
`tag_summary?.badge` is present.

### Verification
- [ ] StatusBadge renders for all five statuses plus needs-review
- [ ] Dashed border for unconfirmed, solid for confirmed
- [ ] Badge appears on object cards when epistemic data present
- [ ] Objects with no claims show no badge
- [ ] `npm run build` passes

---

## Batch 3: Signal pips component (frontend)

### Read first
- `src/components/commonplace/objects/StatusBadge.tsx` (from Batch 2)

### New file: `src/components/commonplace/objects/SignalPips.tsx`

Row of 8px colored circles.

```typescript
interface SignalPipsProps {
  pips: TagSummaryPip[];
}
```

Pip rendering:

| Signal | Color | Style | Tooltip template |
|--------|-------|-------|-----------------|
| Evidence | #0F6E56 | filled, 70% opacity | "{count} supporting evidence links" |
| Tension | #BA7517 | filled, 70% opacity | "{count} open tensions" |
| Refuted | #A32D2D | filled, 70% opacity | "Belief revised: claims refuted" |
| Candidate | #534AB7 | filled, 60% opacity | "{count} unlinked candidates" |
| Dormant | #88868E | ring only (1px stroke, no fill), 50% opacity | "No evidence activity in 90+ days" |

Fixed order. 4px gap between pips.
Hidden by default, visible on parent card hover.
Tooltips via `title` attribute or `@floating-ui/react`.

### CSS

```css
.cp-signal-pips {
  display: flex;
  gap: 4px;
  align-items: center;
  opacity: 0;
  transition: opacity 150ms;
}

.cp-object-card:hover .cp-signal-pips,
.cp-object-card:focus-within .cp-signal-pips {
  opacity: 1;
}

.cp-signal-pip {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cp-signal-pip--dormant {
  background: transparent;
  border: 1px solid #88868E;
  opacity: 0.5;
}
```

### Integration

Render `SignalPips` next to `StatusBadge` on each object card.

### Verification
- [ ] Pips render for each active signal
- [ ] Hidden by default, visible on hover
- [ ] Tooltips show correct explanations
- [ ] Dormant is a hollow ring
- [ ] Empty pips array renders nothing
- [ ] `npm run build` passes

---

## Batch 4: Enhanced provenance in ObjectDrawer

### Read first
- `src/components/commonplace/ObjectDrawer.tsx` (Connections tab)
- `src/lib/commonplace-api.ts`

### API integration

Add fetch function:

```typescript
export async function fetchDossierReadModel(
  objectId: number,
): Promise<DossierReadModel> {
  const res = await fetch(
    `${API_BASE}/read-models/dossier/?artifact_id=${objectId}`,
  );
  if (!res.ok) throw new Error('Failed to load dossier');
  return res.json();
}
```

### Enhanced Connections tab

Add three new sections below existing connection items:

**Claims section:**
- Each claim: status badge + claim type label + polarity + confidence + review date
- Claims sorted by claim_index

**Evidence links section:**
- "supports" links: green-tinted card (#E1F5EE bg, #0F6E56 left border)
- "contradicts" links: red-tinted card (#FCEBEB bg, #E24B4A left border)
- Each shows: target assumption, confidence score, engine pass source

**Stress findings section:**
- Each finding: typed mono label (color-coded) + description text
- GAP = red (#E24B4A), STALE = amber (#BA7517), METHOD = purple (#534AB7),
  CONTRADICTION_PRESSURE = red, CONFIDENCE_DRIFT = gray, UNLINKED_CANDIDATE = purple

### Layout

```
[existing connection items]
--- Claims ---
[claim card] [claim card]
--- Evidence ---
[support card] [contradiction card]
--- Stress findings ---
[finding row] [finding row]
```

All sections use existing `SectionHead` component for headers.
Empty sections show "None found" in mono 11px italic.

### Verification
- [ ] Claims section renders with status badges
- [ ] Evidence links show support/contradiction colors
- [ ] Stress findings render with typed labels
- [ ] All sections handle empty data gracefully
- [ ] Data loads from read-model API
- [ ] Existing connection items still work
- [ ] `npm run build` passes

---

## Build Order Summary

```
Batch 1: Backend migration (refuted status, tag_summary endpoint) [Index-API repo]
Batch 2: Status badge component [frontend repo]
Batch 3: Signal pips component [frontend repo]
Batch 4: Enhanced provenance in ObjectDrawer [frontend repo]
```

Batch 1 targets the Index-API repo. Batches 2-4 target the frontend repo.
Run the appropriate test/build command after each batch.