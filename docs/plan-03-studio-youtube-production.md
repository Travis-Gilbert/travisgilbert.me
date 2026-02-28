# Django Studio: YouTube Production Pipeline Integration

> **For Claude Code:** Execute tasks sequentially. Each task has exact file paths, code changes, and verification steps.
> **Branch:** `feature/studio-youtube-production`
> **Depends on:** Existing Django Studio backend (publishing\_api/), existing Studio redesign plan (docs/plans/2026-02-25-studio-redesign-design.md)

---

## Context

Django Studio currently manages 5 of 6 content types (essays, field notes, shelf, projects, now) and publishes `.md` files via GitHub API. The Studio redesign plan expands it into a full site control panel with design tokens, nav editing, and page composition.

This plan adds a **YouTube Production Pipeline** to Studio, bridging two existing systems:

1. **The Orchestra** (orchestra-architecture.md): A multi-MCP orchestration layer that coordinates Ulysses, Descript, DaVinci Resolve, and YouTube through TickTick as the state machine, with Claude as the conductor.

2. **The YouTube Production Skill** (SKILL.md): A Claude Skill that externalizes every production decision into external criteria, eliminates planning overhead, and keeps completed phases locked.

The key insight: Studio already has a visual status pipeline, content editing, structured JSON fields, and a GitHub publish flow. YouTube production needs the same things plus phase-specific tooling, research integration, and the ability to surface the "single next action" that the Session Launcher skill provides. Rather than building a separate production system, we extend Studio to become the unified creative hub where research, writing, and video production share the same data layer.

**What this plan does NOT cover:** Building the individual MCP servers (Ulysses, Descript, Resolve, YouTube). Those are separate sprints per the Orchestra build order. This plan builds the Django data layer, UI, and integration points that those MCPs will connect to.

---

## Data Architecture

### How YouTube Production Relates to Existing Content

The relationship is bidirectional:

```
Essay (existing) <-----> VideoProject (new)
  |                           |
  +-- sources (existing)      +-- phases P0-P7 (new)
  |                           |
  +-- annotations             +-- scenes (new)
  |                           |
  +-- researchNotes           +-- deliverables (new)
  |                           |
  +-- connections             +-- sessions (new)
```

Many videos originate from essays. An essay's research (sources, threads, notes) feeds the video's P0 phase. The video's script (P1) may share content with the essay body. The published video embeds back into the essay page. Studio should make these connections explicit, not force duplicate data entry.

---

## Phase 1: Django Models

### Task 1.1: Create VideoProject model

**File:** `publishing_api/apps/content/models.py`

```python
class VideoProject(models.Model):
    """
    A YouTube video production project. Tracks the full P0-P7 lifecycle.
    Can be linked to one or more essays that share research/content.
    """
    title = models.CharField(max_length=300)
    slug = models.SlugField(unique=True)
    short_title = models.CharField(
        max_length=60,
        help_text="Short title for TickTick tasks and dashboards"
    )

    # Production state
    PHASE_CHOICES = [
        ('p0', 'P0: Topic Research'),
        ('p1', 'P1: Script Lock'),
        ('p2', 'P2: Voiceover Record'),
        ('p3', 'P3: On-Camera Filming'),
        ('p4', 'P4: Assembly Edit'),
        ('p5', 'P5: Graphics and Polish'),
        ('p6', 'P6: Export and Metadata'),
        ('p7', 'P7: Publish'),
        ('published', 'Published'),
    ]
    current_phase = models.CharField(
        max_length=12, choices=PHASE_CHOICES, default='p0'
    )
    phase_locked_through = models.CharField(
        max_length=12, choices=PHASE_CHOICES, blank=True, default='',
        help_text="Highest phase that is permanently locked (completed). "
                  "Cannot be re-opened."
    )

    # Connections to existing content
    linked_essays = models.ManyToManyField(
        'Essay', blank=True, related_name='video_projects',
        help_text="Essays that share research or content with this video"
    )
    linked_field_notes = models.ManyToManyField(
        'FieldNote', blank=True, related_name='video_projects',
        help_text="Field notes connected to this video's research"
    )

    # Research (shared with essay sources when linked)
    thesis = models.TextField(
        blank=True,
        help_text="One-sentence thesis. Often shared with linked essay."
    )
    sources = models.JSONField(
        default=list, blank=True,
        help_text="JSON array of {title, url, type, role} objects. "
                  "Types: book, article, paper, video, podcast, dataset, etc. "
                  "Roles: primary, background, data, counterargument, etc."
    )
    research_notes = models.TextField(
        blank=True,
        help_text="Free-form research notes (Markdown). "
                  "Can be seeded from linked essay annotations."
    )

    # Script
    script_body = models.TextField(
        blank=True,
        help_text="Full script in Markdown. Sections marked with "
                  "[VO], [ON-CAMERA], [B-ROLL], [GRAPHIC] tags."
    )
    script_word_count = models.IntegerField(default=0)
    script_estimated_duration = models.CharField(
        max_length=20, blank=True,
        help_text="Estimated video duration based on ~150 words/min VO pace"
    )

    # YouTube metadata (prepared during P6, used during P7)
    youtube_title = models.CharField(max_length=100, blank=True)
    youtube_description = models.TextField(blank=True)
    youtube_tags = models.JSONField(default=list, blank=True)
    youtube_category = models.CharField(max_length=50, blank=True, default='Education')
    youtube_chapters = models.JSONField(
        default=list, blank=True,
        help_text="JSON array of {timecode, label} objects"
    )
    youtube_thumbnail_path = models.CharField(max_length=500, blank=True)

    # Post-publish
    youtube_id = models.CharField(
        max_length=20, blank=True,
        help_text="YouTube video ID after upload (e.g. 'dQw4w9WgXcQ')"
    )
    youtube_url = models.URLField(blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    # External tool references
    ticktick_task_id = models.CharField(
        max_length=30, blank=True,
        help_text="TickTick task ID for the active phase"
    )
    ulysses_sheet_id = models.CharField(max_length=50, blank=True)
    descript_project_id = models.CharField(max_length=50, blank=True)
    resolve_project_name = models.CharField(max_length=200, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.short_title} ({self.get_current_phase_display()})"

    @property
    def is_active(self):
        return self.current_phase != 'published'

    @property
    def phase_number(self):
        """Returns integer phase number (0-7) or 8 for published."""
        if self.current_phase == 'published':
            return 8
        return int(self.current_phase[1])

    @property
    def locked_phase_number(self):
        if not self.phase_locked_through:
            return -1
        if self.phase_locked_through == 'published':
            return 8
        return int(self.phase_locked_through[1])

    def can_advance(self):
        """Whether the current phase can advance (not already at published)."""
        return self.current_phase != 'published'

    def advance_phase(self):
        """
        Lock current phase and advance to next.
        Returns the new phase string, or None if already published.
        """
        if not self.can_advance():
            return None
        self.phase_locked_through = self.current_phase
        phases = [c[0] for c in self.PHASE_CHOICES]
        current_idx = phases.index(self.current_phase)
        self.current_phase = phases[current_idx + 1]
        self.save()
        return self.current_phase

    def rollback_phase(self):
        """
        Roll back to previous phase. Only allowed if the previous phase
        is not locked. Returns new phase string or None if can't roll back.
        """
        phases = [c[0] for c in self.PHASE_CHOICES]
        current_idx = phases.index(self.current_phase)
        if current_idx <= 0:
            return None
        prev_phase = phases[current_idx - 1]
        # Cannot roll back into a locked phase
        if self.locked_phase_number >= int(prev_phase[1]) if prev_phase != 'published' else True:
            return None
        self.current_phase = prev_phase
        self.save()
        return self.current_phase
```

### Task 1.2: Create VideoScene model

**File:** `publishing_api/apps/content/models.py`

```python
class VideoScene(models.Model):
    """
    A scene within a video script. Tracks type (VO, on-camera, B-roll),
    estimated duration, and completion status per phase.
    """
    video = models.ForeignKey(
        VideoProject, on_delete=models.CASCADE, related_name='scenes'
    )
    order = models.IntegerField(default=0)
    title = models.CharField(max_length=200)

    SCENE_TYPE_CHOICES = [
        ('vo', 'Voiceover'),
        ('on_camera', 'On-Camera'),
        ('broll', 'B-Roll'),
        ('graphic', 'Graphic/Animation'),
        ('mixed', 'Mixed'),
    ]
    scene_type = models.CharField(
        max_length=12, choices=SCENE_TYPE_CHOICES, default='vo'
    )

    script_text = models.TextField(blank=True)
    word_count = models.IntegerField(default=0)
    estimated_seconds = models.IntegerField(
        default=0,
        help_text="Estimated duration in seconds (auto-calculated from word count at ~150 wpm)"
    )

    # Per-phase completion tracking
    script_locked = models.BooleanField(default=False)
    vo_recorded = models.BooleanField(default=False)
    filmed = models.BooleanField(default=False)
    assembled = models.BooleanField(default=False)
    polished = models.BooleanField(default=False)

    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Scene {self.order}: {self.title} ({self.get_scene_type_display()})"

    def save(self, *args, **kwargs):
        # Auto-calculate word count and duration from script text
        if self.script_text:
            self.word_count = len(self.script_text.split())
            self.estimated_seconds = int((self.word_count / 150) * 60)
        super().save(*args, **kwargs)
```

### Task 1.3: Create VideoDeliverable model

**File:** `publishing_api/apps/content/models.py`

```python
class VideoDeliverable(models.Model):
    """
    A concrete artifact produced during a phase. Tracks file paths,
    creation time, and which phase produced it.
    """
    video = models.ForeignKey(
        VideoProject, on_delete=models.CASCADE, related_name='deliverables'
    )
    phase = models.CharField(max_length=12, choices=VideoProject.PHASE_CHOICES)

    DELIVERABLE_TYPE_CHOICES = [
        ('research_notes', 'Research Notes'),
        ('script_pdf', 'Locked Script PDF'),
        ('script_markdown', 'Script Markdown Export'),
        ('vo_audio', 'VO Audio'),
        ('vo_transcript', 'VO Marked-Up Transcript'),
        ('footage', 'Camera Footage'),
        ('rough_cut', 'Rough Cut'),
        ('final_cut', 'Final Cut'),
        ('thumbnail', 'Thumbnail'),
        ('rendered_video', 'Rendered Video'),
        ('youtube_metadata', 'YouTube Metadata'),
    ]
    deliverable_type = models.CharField(max_length=20, choices=DELIVERABLE_TYPE_CHOICES)

    file_path = models.CharField(max_length=500, blank=True)
    file_url = models.URLField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['phase', 'created_at']

    def __str__(self):
        return f"{self.get_deliverable_type_display()} (P{self.phase})"
```

### Task 1.4: Create VideoSession model

**File:** `publishing_api/apps/content/models.py`

```python
class VideoSession(models.Model):
    """
    A work session on a video project. Records what was done, which phase
    it was in, and what the next action is. This data feeds the Session
    Launcher skill and the Process Notes on the site.
    """
    video = models.ForeignKey(
        VideoProject, on_delete=models.CASCADE, related_name='sessions'
    )
    phase = models.CharField(max_length=12, choices=VideoProject.PHASE_CHOICES)
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(default=0)

    # What happened
    summary = models.TextField(
        help_text="Brief description of what was accomplished this session"
    )
    subtasks_completed = models.JSONField(
        default=list, blank=True,
        help_text="JSON array of subtask titles completed"
    )

    # What's next (feeds Session Launcher)
    next_action = models.TextField(
        blank=True,
        help_text="The single next action identified at end of session"
    )
    next_tool = models.CharField(
        max_length=50, blank=True,
        help_text="Which app/tool the next action requires (Ulysses, Descript, etc.)"
    )

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.video.short_title} session ({self.started_at.strftime('%Y-%m-%d')})"
```

### Task 1.5: Run migrations

```bash
cd publishing_api
python manage.py makemigrations content
python manage.py migrate
```

**Verification:** Migrations run cleanly. All four new models appear in the database.

---

## Phase 2: Admin Registration & Forms

### Task 2.1: Register models in admin

**File:** `publishing_api/apps/content/admin.py`

```python
from .models import VideoProject, VideoScene, VideoDeliverable, VideoSession

@admin.register(VideoProject)
class VideoProjectAdmin(admin.ModelAdmin):
    list_display = ['short_title', 'current_phase', 'updated_at']
    list_filter = ['current_phase']
    prepopulated_fields = {'slug': ('title',)}

@admin.register(VideoScene)
class VideoSceneAdmin(admin.ModelAdmin):
    list_display = ['video', 'order', 'title', 'scene_type', 'word_count']
    list_filter = ['video', 'scene_type']

@admin.register(VideoDeliverable)
class VideoDeliverableAdmin(admin.ModelAdmin):
    list_display = ['video', 'phase', 'deliverable_type', 'created_at']
    list_filter = ['video', 'phase']

@admin.register(VideoSession)
class VideoSessionAdmin(admin.ModelAdmin):
    list_display = ['video', 'phase', 'started_at', 'duration_minutes']
    list_filter = ['video', 'phase']
```

### Task 2.2: Create VideoProject form for Studio

**File:** `publishing_api/apps/editor/forms.py`

Create `VideoProjectForm` with the following widget mapping:

| Field                 | Widget                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`               | TextInput (standard)                                                                                                                                    |
| `short_title`         | TextInput (short, 60 chars)                                                                                                                             |
| `thesis`              | Textarea (3 rows)                                                                                                                                       |
| `sources`             | StructuredListWidget with schema: `{title: text, url: text, type: select, role: select}` (uses the new structured widget from the Studio redesign plan) |
| `research_notes`      | Textarea with markdown toolbar (class `field-body`)                                                                                                     |
| `script_body`         | Textarea with markdown toolbar (class `field-body`), full height                                                                                        |
| `youtube_title`       | TextInput with character counter (100 max)                                                                                                              |
| `youtube_description` | Textarea (10 rows) with character counter                                                                                                               |
| `youtube_tags`        | TagsWidget (comma-separated with suggestions)                                                                                                           |
| `youtube_chapters`    | StructuredListWidget: `{timecode: text, label: text}`                                                                                                   |
| `linked_essays`       | Checkbox select multiple (filtered to published + drafting essays)                                                                                      |
| `linked_field_notes`  | Checkbox select multiple                                                                                                                                |

The form should also display read-only computed fields:
- `script_word_count` (auto-updated from `script_body`)
- `script_estimated_duration` (auto-calculated)
- Scene count and completion summary

### Task 2.3: Create VideoScene inline formset

**File:** `publishing_api/apps/editor/forms.py`

Create a Django formset for VideoScene that renders as an inline editor within the VideoProject editor:
- Drag-to-reorder scenes (HTMX + sortable.js)
- Each scene shows: order, title, scene\_type dropdown, script\_text textarea, word\_count (read-only), estimated\_seconds (read-only)
- Per-phase checkboxes: script\_locked, vo\_recorded, filmed, assembled, polished
- Add Scene / Remove Scene buttons

---

## Phase 3: Studio UI (Editor Views)

### Task 3.1: Add Video Production to Studio sidebar

**File:** `publishing_api/templates/editor/base.html`

Add a new section to the three-zone sidebar (after CONTENT, before COMPOSE):

```
PRODUCTION
  Videos (badge: active count)
  Sessions (badge: this week count)
```

Or, integrate under the existing CONTENT section with a visual separator:
```
CONTENT
  Essays
  Field Notes
  Shelf
  Projects
  Toolkit
  Now
  ─────────────
  Videos (badge: active count)
```

The placement under CONTENT makes sense because videos are a content type that share the same data layer (sources, connections, tags).

### Task 3.2: Create Video list view

**New file:** `publishing_api/templates/editor/video_list.html`

Displays all VideoProjects grouped by status:

**Active Production** (current\_phase != 'published'):
- Each video shows: short\_title, current phase as a clickable pipeline bar, last session date, next action preview
- Sorted by most recently updated
- The pipeline bar uses the same `_status_pipeline.html` template include from the Studio redesign, but with the 8 video phases instead of the 4 essay stages

**Published** (current\_phase == 'published'):
- Each video shows: title, published date, YouTube link, view count (if youtube\_id exists)
- Sorted by published\_at descending

**Quick-create button:** "New Video" at the top, creates a VideoProject with P0 as current phase.

### Task 3.3: Create Video editor view

**New file:** `publishing_api/templates/editor/video_edit.html`

The video editor is a single page with phase-aware sections. Unlike essays (which show all fields at once), the video editor shows different panels depending on the current phase. This reduces cognitive load by hiding irrelevant fields.

**Always visible:**
- Status pipeline at top (clickable, advances/rolls back phases via HTMX)
- Title, short\_title, thesis
- Linked essays and field notes (sidebar panel)

**Phase-dependent panels:**

| Phase           | Visible Panels                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0: Research    | Sources editor, Research notes, Linked essay research (read-only, pulled from linked essays' sources), "Research Sufficiency" criteria checklist   |
| P1: Script Lock | Script body (full editor with markdown toolbar), Scene breakdown (inline formset), Word count + duration estimate, Script audit criteria checklist |
| P2: Voiceover   | Scene list with VO recording checkboxes, Locked script (read-only), Deliverables panel (VO audio files)                                            |
| P3: Filming     | Scene list with filming checkboxes, Marked-up script reference (read-only), Deliverables panel (footage files)                                     |
| P4: Assembly    | Scene list with assembly checkboxes, Deliverables panel (rough cut)                                                                                |
| P5: Polish      | Scene list with polish checkboxes, Deliverables panel (graphics, final cut)                                                                        |
| P6: Metadata    | YouTube title, description, tags, chapters, thumbnail, Deliverables panel (rendered video)                                                         |
| P7: Publish     | YouTube metadata review (read-only), Upload status, Published URL                                                                                  |

**Criteria checklists:** Each phase displays its completion criteria from the YouTube Production Skill as checkboxes. These are NOT stored in the database (they're defined in code). They serve as a visual reference that maps to the skill's "does it meet criteria?" pattern.

Phase completion criteria (from the Orchestra architecture):

| Phase | Criteria                                                                                  |
| ----- | ----------------------------------------------------------------------------------------- |
| P0    | Has thesis, has 3+ sources, has evidence for/against, go/no-go decided                    |
| P1    | All scenes have script text, word count within budget, scene types marked, PDF exportable |
| P2    | All VO scenes marked as recorded, audio files uploaded                                    |
| P3    | All on-camera scenes marked as filmed, footage transferred                                |
| P4    | All scenes marked as assembled, rough cut plays start to finish                           |
| P5    | All scenes marked as polished, visuals/sound/color complete                               |
| P6    | Video exported, title set, description set, thumbnail uploaded                            |
| P7    | Video uploaded or scheduled                                                               |

### Task 3.4: Create phase transition endpoint

**File:** `publishing_api/apps/editor/views.py`

HTMX endpoint: `POST /videos/<slug>/set-phase/`

Accepts `phase` parameter. Validates:
1. The requested phase is adjacent to the current phase (can only advance or roll back by 1)
2. If advancing, the target phase is not locked
3. If rolling back, the target phase is not locked through

On successful advance:
- Sets `phase_locked_through` to the current phase
- Sets `current_phase` to the next phase
- Creates a `VideoSession` entry recording the phase transition
- Returns updated pipeline HTML via HTMX partial

On successful rollback (only for unlocked phases):
- Sets `current_phase` to the previous phase
- Returns updated pipeline HTML

**This mirrors the Orchestra's Phase Transition Protocol** (CHECK, EXTRACT, TRANSFORM, LOAD, UPDATE), but the Studio handles only the CHECK and UPDATE steps. EXTRACT/TRANSFORM/LOAD happen through the MCP layer when those tools are built.

### Task 3.5: Create session log view

**New file:** `publishing_api/templates/editor/video_sessions.html`

Displays all VideoSessions for a project in reverse chronological order. Each session shows:
- Date and duration
- Phase at time of session
- Summary of work done
- Next action identified
- Tool needed for next action

This view is also accessible from the video editor page as a collapsible panel.

**Quick-log form:** At the top, a simple form to log a session after the fact:
- Duration (minutes, number input)
- Summary (textarea)
- Next action (text input)
- Next tool (dropdown: Ulysses, Descript, Resolve, YouTube, Other)

---

## Phase 4: Research Integration

### Task 4.1: Seed video research from linked essays

**File:** `publishing_api/apps/editor/views.py`

When a VideoProject is linked to an essay (via the `linked_essays` M2M field), provide a "Pull Research" button that:

1. Reads the linked essay's `sources` JSON field
2. Merges any sources not already in the video's `sources` field (matched by URL)
3. Reads the linked essay's `annotations` and appends them to `research_notes` under a "From [Essay Title]" header
4. Updates the UI via HTMX partial refresh

This is a one-time pull, not a live sync. The video's research diverges from the essay's as production progresses, and that's expected.

### Task 4.2: Surface research in script editor

**File:** `publishing_api/templates/editor/video_edit.html` (P1 panel)

When the script body editor is active (P1), show a collapsible sidebar panel titled "Research" containing:
- All sources, grouped by role (primary, background, data, counterargument)
- Each source shows title + URL as a clickable link
- A "Copy citation" button that inserts a markdown link into the script at cursor position
- Research notes (read-only in this panel, editable in P0 panel)

This is the "drag a source into the script" workflow described in the design conversation. Since we can't literally drag in a browser textarea, the "Copy citation" button achieves the same outcome with one click.

---

## Phase 5: Orchestra Skill Integration Points

### Task 5.1: Create API endpoints for the Conductor

**File:** `publishing_api/apps/editor/views.py` (or new `apps/api/views.py`)

The Orchestra Conductor (Claude Skill) needs to read and update video project state. Create these JSON API endpoints:

```
GET  /api/videos/                    # List all active video projects
GET  /api/videos/<slug>/             # Get project detail with scenes and deliverables
GET  /api/videos/<slug>/sessions/    # Get session history
POST /api/videos/<slug>/log-session/ # Log a work session
POST /api/videos/<slug>/advance/     # Advance to next phase (with criteria check)
POST /api/videos/<slug>/deliverable/ # Register a new deliverable
GET  /api/videos/<slug>/next-action/ # Get the recommended next action
```

**The `/next-action/` endpoint** implements the Session Launcher logic from the YouTube Production Skill:

1. Determine current phase
2. Check which subtasks (scenes) are incomplete for the current phase
3. Return a structured response:

```json
{
  "video": "Chicago Heat Wave",
  "phase": "P2",
  "phase_name": "Voiceover Record",
  "progress": "3/7 scenes recorded",
  "next_action": "Record Scene 4: The Policy Response",
  "next_tool": "Descript",
  "estimated_minutes": 20,
  "done_when": "Scene 4 VO audio exported",
  "context": [
    "Scene 4 is 180 words, estimated 72 seconds of VO",
    "Previous session completed Scenes 1-3"
  ]
}
```

This endpoint can be called by:
- The Claude Session Launcher skill (via MCP or direct API call)
- The Studio dashboard (to show "next action" cards)
- The site frontend (to show production status on the /now page)

### Task 5.2: Create TickTick sync utilities

**File:** `publishing_api/apps/content/ticktick_sync.py`

Utility functions to keep TickTick and Studio in sync. These are called by views, not by the models themselves.

```python
def sync_to_ticktick(video: VideoProject):
    """
    Creates or updates TickTick tasks for the video project.
    One task per phase in the Video Breakdown list.
    Active phase gets priority 5 (HIGH).
    Future phases get priority 3 (MEDIUM).
    Completed phases get priority 1 (LOW).
    """
    pass  # Implementation uses the TickTick MCP tools

def create_phase_task(video: VideoProject, phase: str):
    """
    Creates a TickTick task for a specific phase with subtasks
    derived from the video's scenes.
    Task title format: "🎬 [Short Title] - P[#]: [Phase Name]"
    """
    pass

def sync_from_ticktick(video: VideoProject):
    """
    Reads TickTick task state and updates the VideoProject.
    Called when opening the video editor to catch any changes
    made directly in TickTick.
    """
    pass
```

**Note:** These functions are stubs for now. They'll be implemented when the TickTick MCP is connected to Studio. The important thing is that the data model and sync interface are defined so the MCP integration has a clean target.

### Task 5.3: Create description template generator

**File:** `publishing_api/apps/content/description_generator.py`

Auto-generates YouTube description from project data, matching the Orchestra's template:

```python
def generate_description(video: VideoProject) -> str:
    """
    Generates YouTube description from video project data:
    - Hook from first scene's script text (first sentence)
    - Key points from scene titles
    - Source links from sources JSON
    - Chapter markers from youtube_chapters JSON
    """
    lines = []

    # Hook
    first_scene = video.scenes.first()
    if first_scene and first_scene.script_text:
        hook = first_scene.script_text.split('.')[0] + '.'
        lines.append(hook)
        lines.append('')

    # Key points
    scenes = video.scenes.exclude(scene_type='broll')
    if scenes.exists():
        lines.append('In this video:')
        for scene in scenes:
            lines.append(f'- {scene.title}')
        lines.append('')

    # Sources
    if video.sources:
        lines.append('Sources:')
        for source in video.sources:
            title = source.get('title', 'Untitled')
            url = source.get('url', '')
            if url:
                lines.append(f'- {title}: {url}')
            else:
                lines.append(f'- {title}')
        lines.append('')

    # Chapters
    if video.youtube_chapters:
        lines.append('CHAPTERS:')
        for chapter in video.youtube_chapters:
            tc = chapter.get('timecode', '0:00')
            label = chapter.get('label', '')
            lines.append(f'{tc} - {label}')

    return '\n'.join(lines)
```

### Task 5.4: Add "Generate Description" button to P6 editor panel

**File:** `publishing_api/templates/editor/video_edit.html` (P6 panel)

An HTMX button that calls the description generator and populates the `youtube_description` textarea. The generated description is a starting point that Travis edits, not a final output.

---

## Phase 6: Site Frontend Integration

### Task 6.1: Surface video production on /now page

**File:** `src/app/now/page.tsx`

Add a "Currently Producing" section that reads from the Django API:

```
GET https://research.travisgilbert.me/api/videos/?active=true
```

Renders each active video as a compact card:
- Short title
- Current phase (pipeline indicator, same visual style as ProgressTracker)
- Next action (one line)
- Linked essay title (if any, with link)

If the API is unreachable, this section renders nothing (graceful degradation, same pattern as `ActiveThreads`).

### Task 6.2: Embed published videos in linked essays

**File:** `src/app/essays/[slug]/page.tsx`

If an essay has a `youtubeId` in frontmatter, the video already embeds in the hero. Extend this:

When the Django API is available, check if the essay slug has any linked VideoProjects that are published. If so, render a "Watch the Video" card below the essay body (above ProcessNotes):

- YouTube thumbnail (existing pattern)
- Video title
- Duration
- "Watch on YouTube" link
- Styled as a RoughBox with tint matching the essay section color

### Task 6.3: Include video production in PipelineCounter

**File:** `src/components/PipelineCounter.tsx` (from Plan 01)

Extend the pipeline counter on the homepage to include video production status:

```
2 RESEARCHING · 1 DRAFTING · 1 IN PRODUCTION · 3 PUBLISHED · 1 VIDEO IN P4
```

The video count only appears if there are active video projects. Fetched from the same API endpoint as the /now page integration.

---

## Phase 7: Process Tracking for Process Proof

### Task 7.1: Add video metrics to ProcessNotes

**File:** `src/components/ProcessNotes.tsx` (from Plan 02)

When an essay has a linked video project, include video production metrics:
- "Produced alongside a video documentary"
- Session count: "12 production sessions over 3 months"
- Total production hours (sum of session durations)

### Task 7.2: Add video session count to PublicationGraph

**File:** `src/components/PublicationGraph.tsx` (from Plan 02)

The cumulative publication chart gains a second series: published videos. Same upward-stepping line but in a different color (gold). The combined chart shows all creative output, reinforcing the "I do things" signal.

### Task 7.3: Production dashboard in Studio

**New file:** `publishing_api/templates/editor/production_dashboard.html`

A dashboard page accessible from the Studio sidebar showing:

**Active Projects:** Cards for each active VideoProject with phase pipeline, next action, and session link.

**Production Calendar:** A heatmap (same visual style as ActivityHeatmap in Paper Trail) showing days with logged sessions. Color intensity maps to hours worked. This is the "proof I do things" view for Travis's internal motivation.

**Cumulative Output:** A simple line chart showing total published pieces (essays + field notes + videos) over time. This is the internal version of what PublicationGraph shows on the site.

**Weekly Summary:**
- Sessions this week: count + total hours
- Phases completed this week
- Next actions across all projects

---

## Phase 8: URLs and Navigation

### Task 8.1: Add URL routes

**File:** `publishing_api/apps/editor/urls.py`

```python
# Video production routes
path('videos/', views.VideoListView.as_view(), name='video_list'),
path('videos/create/', views.VideoCreateView.as_view(), name='video_create'),
path('videos/<slug:slug>/', views.VideoEditView.as_view(), name='video_edit'),
path('videos/<slug:slug>/set-phase/', views.VideoSetPhaseView.as_view(), name='video_set_phase'),
path('videos/<slug:slug>/sessions/', views.VideoSessionListView.as_view(), name='video_sessions'),
path('videos/<slug:slug>/pull-research/', views.VideoPullResearchView.as_view(), name='video_pull_research'),
path('videos/<slug:slug>/generate-description/', views.VideoGenerateDescView.as_view(), name='video_generate_desc'),

# API routes (for Conductor skill and frontend)
path('api/videos/', views.VideoAPIListView.as_view(), name='api_video_list'),
path('api/videos/<slug:slug>/', views.VideoAPIDetailView.as_view(), name='api_video_detail'),
path('api/videos/<slug:slug>/sessions/', views.VideoAPISessionsView.as_view(), name='api_video_sessions'),
path('api/videos/<slug:slug>/log-session/', views.VideoAPILogSessionView.as_view(), name='api_video_log_session'),
path('api/videos/<slug:slug>/advance/', views.VideoAPIAdvanceView.as_view(), name='api_video_advance'),
path('api/videos/<slug:slug>/deliverable/', views.VideoAPIDeliverableView.as_view(), name='api_video_deliverable'),
path('api/videos/<slug:slug>/next-action/', views.VideoAPINextActionView.as_view(), name='api_video_next_action'),

# Dashboard
path('production/', views.ProductionDashboardView.as_view(), name='production_dashboard'),
```

---

## Integration with Orchestra Skill

The Orchestra architecture defines a Conductor skill that uses TickTick as the state machine. With Studio, the Conductor gains a richer data layer:

**Before Studio:** Conductor reads phase state from TickTick task names and priorities. Script text lives in Ulysses only. Session history is in conversation context only.

**After Studio:** Conductor can:
1. Call `GET /api/videos/<slug>/` to get full project state including scenes, sources, and deliverables
2. Call `GET /api/videos/<slug>/next-action/` to get a computed next action (same logic as Session Launcher skill, but server-side)
3. Call `POST /api/videos/<slug>/log-session/` to persist session summaries (surviving context window resets)
4. Call `POST /api/videos/<slug>/advance/` to advance phases with criteria validation

The Conductor still uses TickTick for real-time task state (checking off subtasks during a session). Studio is the persistent record and the richer data layer.

**Session Launcher integration:** The skill's "What should I work on?" flow becomes:
1. Skill fires, calls `/api/videos/?active=true` to get active projects
2. For each active project, calls `/api/videos/<slug>/next-action/`
3. Presents the highest-priority next action to Travis
4. After the session, calls `/api/videos/<slug>/log-session/` to record what happened

This means session history persists across Claude conversations. The "where was I?" question is answered by the API, not by conversation memory.

---

## Summary of New/Modified Files

**Django (publishing\_api/):**

New models:
- `apps/content/models.py`: VideoProject, VideoScene, VideoDeliverable, VideoSession

New files:
- `apps/content/ticktick_sync.py` (stubs for MCP integration)
- `apps/content/description_generator.py`
- `templates/editor/video_list.html`
- `templates/editor/video_edit.html`
- `templates/editor/video_sessions.html`
- `templates/editor/production_dashboard.html`

Modified files:
- `apps/content/admin.py` (register new models)
- `apps/editor/forms.py` (VideoProjectForm, VideoSceneFormset)
- `apps/editor/views.py` (all video CRUD, API endpoints, phase transitions)
- `apps/editor/urls.py` (new routes)
- `templates/editor/base.html` (sidebar navigation)

**Next.js (src/):**

Modified files:
- `src/app/now/page.tsx` (Currently Producing section)
- `src/app/essays/[slug]/page.tsx` (linked video embed)
- `src/components/PipelineCounter.tsx` (video count)
- `src/components/ProcessNotes.tsx` (video metrics)
- `src/components/PublicationGraph.tsx` (video series)
