# Sourcebox Redesign: Implementation Plan

> **For Claude:** REQUIRED: Use /execute-plan to implement this plan task-by-task.

**Goal:** Replace the flat-list Sourcebox with a three-lane kanban board (Inbox, Review, Decided) featuring unified capture, async OG scraping, enrichment detail panel, file uploads, and drag-and-drop.

**Architecture:** Django views return HTMX partials. Kanban columns are server-rendered; card transitions use `hx-swap="outerHTML"` and `hx-swap-oob`. Sortable.js bridges drag events to HTMX POSTs. Async OG scraping uses `threading.Thread` with HTMX polling. Detail panel slides in from the right via HTMX-loaded partial + CSS transform.

**Tech Stack:** Django 5.x, HTMX 2.0.4, Sortable.js, django-cotton, django-crispy-forms (studio pack), django-tailwind, threading.Thread

**Design doc:** `docs/plans/2026-02-27-sourcebox-redesign-design.md`

---

## Task 1: Model Migration (Add New Fields to RawSource)

**Files:**
- Modify: `publishing_api/apps/intake/models.py`
- Create: migration via `makemigrations`
- Test: `publishing_api/apps/intake/tests/test_models.py`

**Step 1: Write the failing test**

Create `publishing_api/apps/intake/tests/__init__.py` (empty) and `publishing_api/apps/intake/tests/test_models.py`:

```python
from django.test import TestCase
from apps.intake.models import RawSource


class RawSourceFieldsTest(TestCase):
    def test_create_url_source_with_new_fields(self):
        source = RawSource.objects.create(
            url="https://example.com/article",
            input_type="url",
            importance="medium",
            phase="inbox",
            scrape_status="pending",
        )
        self.assertEqual(source.input_type, "url")
        self.assertEqual(source.importance, "medium")
        self.assertEqual(source.phase, "inbox")
        self.assertEqual(source.scrape_status, "pending")
        self.assertEqual(source.connections, [])
        self.assertFalse(source.source_file)

    def test_create_file_source_without_url(self):
        source = RawSource.objects.create(
            input_type="file",
            phase="inbox",
        )
        self.assertEqual(source.url, "")
        self.assertEqual(source.input_type, "file")

    def test_phase_choices(self):
        self.assertEqual(RawSource.Phase.INBOX, "inbox")
        self.assertEqual(RawSource.Phase.REVIEW, "review")
        self.assertEqual(RawSource.Phase.DECIDED, "decided")

    def test_scrape_status_choices(self):
        self.assertEqual(RawSource.ScrapeStatus.PENDING, "pending")
        self.assertEqual(RawSource.ScrapeStatus.COMPLETE, "complete")
        self.assertEqual(RawSource.ScrapeStatus.FAILED, "failed")

    def test_importance_choices(self):
        self.assertEqual(RawSource.Importance.LOW, "low")
        self.assertEqual(RawSource.Importance.MEDIUM, "medium")
        self.assertEqual(RawSource.Importance.HIGH, "high")

    def test_default_values(self):
        source = RawSource.objects.create(url="https://example.com")
        self.assertEqual(source.phase, "inbox")
        self.assertEqual(source.scrape_status, "pending")
        self.assertEqual(source.importance, "medium")
        self.assertEqual(source.input_type, "url")
        self.assertEqual(source.connections, [])
```

**Step 2: Run test to verify it fails**

Run: `cd publishing_api && python manage.py test apps.intake.tests.test_models -v 2`
Expected: FAIL (Phase, ScrapeStatus, Importance not defined; fields don't exist)

**Step 3: Add fields to RawSource model**

In `publishing_api/apps/intake/models.py`, add the new TextChoices classes and fields:

```python
class RawSource(TimeStampedModel):
    """A URL or file submitted to the Sourcebox for research triage."""

    class Decision(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"
        DEFERRED = "deferred", "Deferred"

    class Phase(models.TextChoices):
        INBOX = "inbox", "Inbox"
        REVIEW = "review", "Review"
        DECIDED = "decided", "Decided"

    class ScrapeStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETE = "complete", "Complete"
        FAILED = "failed", "Failed"

    class Importance(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    class InputType(models.TextChoices):
        URL = "url", "URL"
        FILE = "file", "File"

    # Input: URL or file (one required)
    url = models.URLField(max_length=2000, blank=True, default="")
    source_file = models.FileField(upload_to="sourcebox/", blank=True)
    input_type = models.CharField(
        max_length=4,
        choices=InputType.choices,
        default=InputType.URL,
    )

    # OG metadata (populated by scrape service)
    og_title = models.CharField(max_length=500, blank=True, default="")
    og_description = models.TextField(blank=True, default="")
    og_image = models.URLField(max_length=2000, blank=True, default="")
    og_site_name = models.CharField(max_length=300, blank=True, default="")

    # Kanban phase (board position, separate from decision outcome)
    phase = models.CharField(
        max_length=7,
        choices=Phase.choices,
        default=Phase.INBOX,
    )

    # Async OG scrape tracking
    scrape_status = models.CharField(
        max_length=8,
        choices=ScrapeStatus.choices,
        default=ScrapeStatus.PENDING,
    )

    # Enrichment
    importance = models.CharField(
        max_length=6,
        choices=Importance.choices,
        default=Importance.MEDIUM,
    )
    tags = models.JSONField(default=list, blank=True)
    connections = models.JSONField(default=list, blank=True)

    # Triage state
    decision = models.CharField(
        max_length=10,
        choices=Decision.choices,
        default=Decision.PENDING,
    )
    decision_note = models.TextField(blank=True, default="")
    decided_at = models.DateTimeField(null=True, blank=True)

    # If accepted, slug of the promoted Source in research_api
    promoted_source_slug = models.SlugField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        label = self.og_title or self.url[:80] or str(self.source_file) or "Untitled"
        return f"[{self.get_decision_display()}] {label}"

    @property
    def display_title(self):
        """OG title with URL or filename fallback."""
        if self.og_title:
            return self.og_title
        if self.url:
            return self.url
        if self.source_file:
            return self.source_file.name.split("/")[-1]
        return "Untitled source"

    @property
    def is_pending(self):
        return self.decision == self.Decision.PENDING

    @property
    def is_scraped(self):
        return self.scrape_status == self.ScrapeStatus.COMPLETE

    @property
    def is_file(self):
        return self.input_type == self.InputType.FILE
```

Note: The existing `url` field changes from `models.URLField(max_length=2000)` to `models.URLField(max_length=2000, blank=True, default="")` so file sources can omit it.

**Step 4: Generate and apply migration**

Run:
```bash
cd publishing_api
python manage.py makemigrations intake
python manage.py migrate
```

**Step 5: Run test to verify it passes**

Run: `cd publishing_api && python manage.py test apps.intake.tests.test_models -v 2`
Expected: All 6 tests PASS

**Step 6: Commit**

```bash
git add publishing_api/apps/intake/models.py publishing_api/apps/intake/migrations/ publishing_api/apps/intake/tests/
git commit -m "feat(intake): add phase, scrape_status, importance, connections, source_file fields to RawSource"
```

---

## Task 2: Retire SuggestedConnection Model

**Files:**
- Modify: `publishing_api/apps/intake/models.py` (remove class)
- Modify: `publishing_api/apps/intake/admin.py` (remove inline + registration)
- Create: migration via `makemigrations`

**Step 1: Remove SuggestedConnection from models.py**

Delete the entire `SuggestedConnection` class (lines 68-94 of the original file). The `connections` JSONField on RawSource now absorbs its purpose.

**Step 2: Remove from admin.py**

Remove `SuggestedConnection` from import, delete `SuggestedConnectionInline` class, delete `SuggestedConnectionAdmin` class, remove `inlines = [SuggestedConnectionInline]` from `RawSourceAdmin`.

Updated `admin.py`:

```python
from django.contrib import admin

from apps.intake.models import RawSource


@admin.register(RawSource)
class RawSourceAdmin(admin.ModelAdmin):
    list_display = ("display_title", "phase", "decision", "importance", "og_site_name", "created_at")
    list_filter = ("phase", "decision", "importance", "scrape_status")
    search_fields = ("url", "og_title", "og_description")
    readonly_fields = (
        "og_title", "og_description", "og_image", "og_site_name",
        "scrape_status", "created_at", "updated_at",
    )

    fieldsets = (
        (None, {"fields": ("url", "source_file", "input_type", "phase")}),
        ("OG Metadata", {"fields": ("og_title", "og_description", "og_image", "og_site_name", "scrape_status")}),
        ("Enrichment", {"fields": ("importance", "tags", "connections")}),
        ("Triage", {"fields": ("decision", "decision_note", "decided_at", "promoted_source_slug")}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )
```

**Step 3: Generate and apply migration**

Run:
```bash
cd publishing_api
python manage.py makemigrations intake
python manage.py migrate
```

**Step 4: Run all intake tests**

Run: `cd publishing_api && python manage.py test apps.intake -v 2`
Expected: PASS (no references to SuggestedConnection remain)

**Step 5: Commit**

```bash
git add publishing_api/apps/intake/models.py publishing_api/apps/intake/admin.py publishing_api/apps/intake/migrations/
git commit -m "refactor(intake): retire SuggestedConnection model, update admin for new fields"
```

---

## Task 3: File Upload Settings (MEDIA_ROOT / MEDIA_URL)

**Files:**
- Modify: `publishing_api/config/settings.py`
- Modify: `publishing_api/config/urls.py`

**Step 1: Add media settings**

In `publishing_api/config/settings.py`, add after the `STATIC_ROOT` line:

```python
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
```

**Step 2: Serve media files in dev**

In `publishing_api/config/urls.py`, add the dev media serving:

```python
from django.conf import settings
from django.conf.urls.static import static

# ... existing urlpatterns ...

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

**Step 3: Add media/ to .gitignore**

Ensure `publishing_api/media/` is in `.gitignore`. Check if it already is; if not, add `publishing_api/media/` to the project `.gitignore`.

**Step 4: Verify Django check passes**

Run: `cd publishing_api && python manage.py check`
Expected: System check identified no issues.

**Step 5: Commit**

```bash
git add publishing_api/config/settings.py publishing_api/config/urls.py .gitignore
git commit -m "feat(intake): add MEDIA_ROOT/MEDIA_URL for file upload support"
```

---

## Task 4: Async OG Scraping Service

**Files:**
- Modify: `publishing_api/apps/intake/services.py`
- Test: `publishing_api/apps/intake/tests/test_services.py`

**Step 1: Write the failing test**

Create `publishing_api/apps/intake/tests/test_services.py`:

```python
from unittest.mock import patch, MagicMock
from django.test import TestCase
from apps.intake.models import RawSource
from apps.intake.services import scrape_og_async


class ScrapeOgAsyncTest(TestCase):
    @patch("apps.intake.services.scrape_og_metadata")
    def test_scrape_og_async_success(self, mock_scrape):
        mock_scrape.return_value = {
            "title": "Test Article",
            "description": "A test description",
            "image": "https://example.com/img.png",
            "site_name": "Example",
        }
        source = RawSource.objects.create(
            url="https://example.com/article",
            scrape_status="pending",
        )
        scrape_og_async(source.pk)
        source.refresh_from_db()
        self.assertEqual(source.og_title, "Test Article")
        self.assertEqual(source.scrape_status, "complete")

    @patch("apps.intake.services.scrape_og_metadata")
    def test_scrape_og_async_failure(self, mock_scrape):
        mock_scrape.return_value = {
            "title": "",
            "description": "",
            "image": "",
            "site_name": "",
        }
        source = RawSource.objects.create(
            url="https://unreachable.example.com",
            scrape_status="pending",
        )
        scrape_og_async(source.pk)
        source.refresh_from_db()
        # Even with empty results, status should be complete (not failed)
        # Failed is reserved for exceptions
        self.assertEqual(source.scrape_status, "complete")

    @patch("apps.intake.services.scrape_og_metadata")
    def test_scrape_og_async_exception(self, mock_scrape):
        mock_scrape.side_effect = Exception("Network timeout")
        source = RawSource.objects.create(
            url="https://timeout.example.com",
            scrape_status="pending",
        )
        scrape_og_async(source.pk)
        source.refresh_from_db()
        self.assertEqual(source.scrape_status, "failed")
```

**Step 2: Run test to verify it fails**

Run: `cd publishing_api && python manage.py test apps.intake.tests.test_services -v 2`
Expected: FAIL (scrape_og_async not defined)

**Step 3: Add scrape_og_async and start_scrape_thread to services.py**

Append to `publishing_api/apps/intake/services.py`:

```python
import threading


def scrape_og_async(source_pk: int) -> None:
    """
    Scrape OG metadata for a RawSource and update the record.

    Designed to run in a background thread. Updates scrape_status
    to 'complete' on success or 'failed' on exception.
    """
    from apps.intake.models import RawSource

    try:
        source = RawSource.objects.get(pk=source_pk)
    except RawSource.DoesNotExist:
        logger.warning("scrape_og_async: RawSource %s not found", source_pk)
        return

    try:
        og = scrape_og_metadata(source.url)
        source.og_title = og["title"][:500]
        source.og_description = og["description"]
        source.og_image = og["image"][:2000]
        source.og_site_name = og["site_name"][:300]
        source.scrape_status = RawSource.ScrapeStatus.COMPLETE
        source.save(update_fields=[
            "og_title", "og_description", "og_image", "og_site_name", "scrape_status",
        ])
    except Exception as exc:
        logger.error("scrape_og_async failed for RawSource %s: %s", source_pk, exc)
        RawSource.objects.filter(pk=source_pk).update(
            scrape_status=RawSource.ScrapeStatus.FAILED
        )


def start_scrape_thread(source_pk: int) -> None:
    """Fire-and-forget OG scraping in a background thread."""
    thread = threading.Thread(
        target=scrape_og_async,
        args=(source_pk,),
        daemon=True,
    )
    thread.start()
```

**Step 4: Run test to verify it passes**

Run: `cd publishing_api && python manage.py test apps.intake.tests.test_services -v 2`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add publishing_api/apps/intake/services.py publishing_api/apps/intake/tests/test_services.py
git commit -m "feat(intake): add async OG scraping with background thread"
```

---

## Task 5: New Forms (CaptureForm, EnrichmentForm, MoveForm)

**Files:**
- Modify: `publishing_api/apps/intake/forms.py`
- Test: `publishing_api/apps/intake/tests/test_forms.py`

**Step 1: Write the failing test**

Create `publishing_api/apps/intake/tests/test_forms.py`:

```python
from django.test import TestCase
from apps.intake.forms import CaptureForm, EnrichmentForm, MoveForm


class CaptureFormTest(TestCase):
    def test_single_url_valid(self):
        form = CaptureForm(data={"urls": "https://example.com"})
        self.assertTrue(form.is_valid())
        self.assertEqual(form.cleaned_data["url_list"], ["https://example.com"])

    def test_batch_urls_valid(self):
        urls = "https://a.com\nhttps://b.com\nhttps://c.com"
        form = CaptureForm(data={"urls": urls})
        self.assertTrue(form.is_valid())
        self.assertEqual(len(form.cleaned_data["url_list"]), 3)

    def test_blank_lines_filtered(self):
        urls = "https://a.com\n\n\nhttps://b.com\n"
        form = CaptureForm(data={"urls": urls})
        self.assertTrue(form.is_valid())
        self.assertEqual(len(form.cleaned_data["url_list"]), 2)

    def test_invalid_url_rejected(self):
        form = CaptureForm(data={"urls": "not-a-url"})
        self.assertFalse(form.is_valid())

    def test_empty_rejected(self):
        form = CaptureForm(data={"urls": ""})
        self.assertFalse(form.is_valid())


class EnrichmentFormTest(TestCase):
    def test_all_fields_optional_except_defaults(self):
        form = EnrichmentForm(data={
            "importance": "high",
            "source_type": "article",
        })
        self.assertTrue(form.is_valid())

    def test_tags_parsed_from_comma_string(self):
        form = EnrichmentForm(data={
            "importance": "medium",
            "source_type": "article",
            "tags_raw": "design, urbanism, history",
        })
        self.assertTrue(form.is_valid())
        self.assertEqual(form.cleaned_data["tag_list"], ["design", "urbanism", "history"])


class MoveFormTest(TestCase):
    def test_valid_move(self):
        form = MoveForm(data={"source_id": "1", "phase": "review"})
        self.assertTrue(form.is_valid())

    def test_invalid_phase(self):
        form = MoveForm(data={"source_id": "1", "phase": "invalid"})
        self.assertFalse(form.is_valid())
```

**Step 2: Run test to verify it fails**

Run: `cd publishing_api && python manage.py test apps.intake.tests.test_forms -v 2`
Expected: FAIL (CaptureForm, EnrichmentForm, MoveForm not defined)

**Step 3: Write the forms**

Replace `publishing_api/apps/intake/forms.py`:

```python
from django import forms
from django.core.validators import URLValidator

from apps.intake.models import RawSource

# Shared input styling for light-theme forms
INPUT_CLASS = (
    "w-full bg-cream border border-border rounded-brand"
    " px-4 py-[10px] text-ink text-[15px]"
    " font-body"
    " placeholder:text-ink-muted placeholder:font-body"
    " shadow-warm-sm"
    " outline-none transition-all duration-200"
    " focus:border-terracotta focus:shadow-[0_0_0_3px_rgba(180,90,45,0.12)]"
)

SMALL_INPUT_CLASS = (
    "w-full bg-cream border border-border rounded-brand"
    " px-3 py-2 text-ink text-sm"
    " font-body"
    " placeholder:text-ink-muted placeholder:font-body"
    " shadow-warm-sm"
    " outline-none transition-all duration-200"
    " focus:border-terracotta focus:shadow-[0_0_0_3px_rgba(180,90,45,0.12)]"
)

SOURCE_TYPE_CHOICES = [
    ("article", "Article"),
    ("video", "Video"),
    ("paper", "Paper"),
    ("podcast", "Podcast"),
    ("book", "Book"),
    ("tool", "Tool"),
    ("dataset", "Dataset"),
    ("repository", "Repository"),
    ("document", "Document"),
    ("other", "Other"),
]


class CaptureForm(forms.Form):
    """
    Unified capture: paste one or many URLs (newline-separated).
    File uploads are handled separately via multipart POST.
    """

    urls = forms.CharField(
        widget=forms.Textarea(attrs={
            "placeholder": "Paste URLs, drop files, or click to upload...",
            "class": INPUT_CLASS,
            "rows": 1,
            "style": "resize: none; overflow: hidden;",
        }),
    )

    def clean_urls(self):
        raw = self.cleaned_data["urls"]
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        if not lines:
            raise forms.ValidationError("Enter at least one URL.")

        validator = URLValidator()
        valid_urls = []
        for line in lines:
            try:
                validator(line)
                valid_urls.append(line)
            except forms.ValidationError:
                raise forms.ValidationError(f"Invalid URL: {line}")

        return raw  # Keep raw value; cleaned list in url_list

    @property
    def cleaned_url_list(self):
        """Access the parsed URL list after validation."""
        raw = self.cleaned_data.get("urls", "")
        return [line.strip() for line in raw.splitlines() if line.strip()]

    def clean(self):
        cleaned = super().clean()
        if "urls" in cleaned:
            raw = cleaned["urls"]
            cleaned["url_list"] = [
                line.strip() for line in raw.splitlines() if line.strip()
            ]
        return cleaned


class EnrichmentForm(forms.Form):
    """Enrichment fields for the detail panel: importance, type, tags, notes."""

    importance = forms.ChoiceField(
        choices=RawSource.Importance.choices,
        initial=RawSource.Importance.MEDIUM,
        widget=forms.RadioSelect(attrs={"class": "hidden peer"}),
    )
    source_type = forms.ChoiceField(
        choices=SOURCE_TYPE_CHOICES,
        initial="article",
        widget=forms.Select(attrs={"class": SMALL_INPUT_CLASS}),
    )
    tags_raw = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            "placeholder": "Add tags (comma separated)...",
            "class": SMALL_INPUT_CLASS,
        }),
    )
    decision_note = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            "rows": 3,
            "placeholder": "Why does this source matter? What caught your attention?",
            "class": SMALL_INPUT_CLASS,
        }),
    )

    def clean(self):
        cleaned = super().clean()
        raw_tags = cleaned.get("tags_raw", "")
        cleaned["tag_list"] = [
            t.strip() for t in raw_tags.split(",") if t.strip()
        ]
        return cleaned


class TriageForm(forms.Form):
    """Accept/reject/defer a RawSource with an optional note."""

    decision = forms.ChoiceField(choices=RawSource.Decision.choices)
    decision_note = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            "rows": 2,
            "placeholder": "Optional note...",
            "class": SMALL_INPUT_CLASS,
        }),
    )


class MoveForm(forms.Form):
    """Move a card between kanban columns."""

    source_id = forms.IntegerField()
    phase = forms.ChoiceField(choices=RawSource.Phase.choices)
```

**Step 4: Run test to verify it passes**

Run: `cd publishing_api && python manage.py test apps.intake.tests.test_forms -v 2`
Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add publishing_api/apps/intake/forms.py publishing_api/apps/intake/tests/test_forms.py
git commit -m "feat(intake): add CaptureForm, EnrichmentForm, MoveForm for kanban workflow"
```

---

## Task 6: Expand URL Routes

**Files:**
- Modify: `publishing_api/apps/intake/urls.py`

**Step 1: Write expanded URL configuration**

Replace `publishing_api/apps/intake/urls.py`:

```python
from django.urls import path

from apps.intake import views

app_name = "intake"

urlpatterns = [
    path("sourcebox/", views.SourceboxBoardView.as_view(), name="sourcebox"),
    path("sourcebox/add/", views.SourceboxCaptureView.as_view(), name="sourcebox-add"),
    path("sourcebox/card/<int:pk>/", views.SourceboxCardView.as_view(), name="sourcebox-card"),
    path("sourcebox/detail/<int:pk>/", views.SourceboxDetailView.as_view(), name="sourcebox-detail"),
    path("sourcebox/move/", views.SourceboxMoveView.as_view(), name="sourcebox-move"),
    path("sourcebox/triage/<int:pk>/", views.SourceboxTriageView.as_view(), name="sourcebox-triage"),
]
```

Note: Don't run the server yet; views don't exist. We commit this with the views in the next task.

---

## Task 7: Rewrite Views

**Files:**
- Modify: `publishing_api/apps/intake/views.py`
- Test: `publishing_api/apps/intake/tests/test_views.py`

**Step 1: Write the failing test**

Create `publishing_api/apps/intake/tests/test_views.py`:

```python
from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.urls import reverse

from apps.intake.models import RawSource

User = get_user_model()


class SourceboxBoardViewTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="test", password="test")
        self.client = Client()
        self.client.login(username="test", password="test")

    def test_board_loads(self):
        response = self.client.get(reverse("intake:sourcebox"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Sourcebox")

    def test_board_has_three_columns(self):
        response = self.client.get(reverse("intake:sourcebox"))
        self.assertContains(response, "Inbox")
        self.assertContains(response, "Review")
        self.assertContains(response, "Decided")


class SourceboxCaptureViewTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="test", password="test")
        self.client = Client()
        self.client.login(username="test", password="test")

    def test_add_single_url(self):
        response = self.client.post(
            reverse("intake:sourcebox-add"),
            {"urls": "https://example.com/test"},
            HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(RawSource.objects.count(), 1)
        source = RawSource.objects.first()
        self.assertEqual(source.phase, "inbox")
        self.assertEqual(source.scrape_status, "pending")

    def test_add_duplicate_url_returns_existing(self):
        RawSource.objects.create(url="https://example.com/dup")
        response = self.client.post(
            reverse("intake:sourcebox-add"),
            {"urls": "https://example.com/dup"},
            HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(RawSource.objects.count(), 1)  # No new record


class SourceboxCardViewTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="test", password="test")
        self.client = Client()
        self.client.login(username="test", password="test")

    def test_card_polling_returns_card(self):
        source = RawSource.objects.create(url="https://example.com", scrape_status="pending")
        response = self.client.get(
            reverse("intake:sourcebox-card", kwargs={"pk": source.pk}),
            HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response.status_code, 200)

    def test_card_complete_sends_stop_polling(self):
        source = RawSource.objects.create(
            url="https://example.com",
            scrape_status="complete",
            og_title="Test",
        )
        response = self.client.get(
            reverse("intake:sourcebox-card", kwargs={"pk": source.pk}),
            HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response["HX-StopPolling"], "true")


class SourceboxMoveViewTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="test", password="test")
        self.client = Client()
        self.client.login(username="test", password="test")

    def test_move_inbox_to_review(self):
        source = RawSource.objects.create(url="https://example.com", phase="inbox")
        response = self.client.post(
            reverse("intake:sourcebox-move"),
            {"source_id": source.pk, "phase": "review"},
            HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response.status_code, 200)
        source.refresh_from_db()
        self.assertEqual(source.phase, "review")


class SourceboxTriageViewTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="test", password="test")
        self.client = Client()
        self.client.login(username="test", password="test")

    def test_accept_moves_to_decided(self):
        source = RawSource.objects.create(url="https://example.com", phase="review")
        response = self.client.post(
            reverse("intake:sourcebox-triage", kwargs={"pk": source.pk}),
            {"decision": "accepted"},
            HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response.status_code, 200)
        source.refresh_from_db()
        self.assertEqual(source.decision, "accepted")
        self.assertEqual(source.phase, "decided")
```

**Step 2: Run test to verify it fails**

Run: `cd publishing_api && python manage.py test apps.intake.tests.test_views -v 2`
Expected: FAIL (views don't exist yet)

**Step 3: Write all six views**

Replace `publishing_api/apps/intake/views.py`:

```python
"""
Sourcebox views: kanban board, capture, card polling, detail panel, move, triage.

All views are login-protected. The board shows three columns (Inbox, Review, Decided).
Capture creates cards in Inbox with async OG scraping. Detail panel loads enrichment
form. Triage moves cards to Decided with accept/reject/defer.
"""

from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.response import TemplateResponse
from django.utils import timezone
from django.views import View

from apps.intake.forms import CaptureForm, EnrichmentForm, MoveForm, TriageForm
from apps.intake.models import RawSource
from apps.intake.services import promote_to_research, start_scrape_thread


class SourceboxBoardView(LoginRequiredMixin, View):
    """Main kanban board: three columns with cards grouped by phase."""

    def get(self, request):
        inbox = RawSource.objects.filter(phase=RawSource.Phase.INBOX)
        review = RawSource.objects.filter(phase=RawSource.Phase.REVIEW)
        decided = RawSource.objects.filter(phase=RawSource.Phase.DECIDED)[:50]

        return TemplateResponse(request, "intake/sourcebox.html", {
            "inbox_sources": inbox,
            "review_sources": review,
            "decided_sources": decided,
            "capture_form": CaptureForm(),
            "nav_section": "sourcebox",
        })


class SourceboxCaptureView(LoginRequiredMixin, View):
    """POST: add URLs (single or batch) or files. Returns card partials for Inbox."""

    def post(self, request):
        # Handle file upload
        if request.FILES.get("source_file"):
            uploaded = request.FILES["source_file"]
            source = RawSource.objects.create(
                source_file=uploaded,
                input_type=RawSource.InputType.FILE,
                phase=RawSource.Phase.INBOX,
                scrape_status=RawSource.ScrapeStatus.COMPLETE,
                og_title=uploaded.name,
            )
            return TemplateResponse(
                request,
                "intake/partials/inbox_card.html",
                {"source": source},
            )

        # Handle URL(s)
        form = CaptureForm(request.POST)
        if not form.is_valid():
            return HttpResponse(
                '<div class="text-error text-sm px-3 py-2">Invalid URL(s)</div>',
                status=422,
            )

        url_list = form.cleaned_data["url_list"]
        cards_html = []

        for url in url_list:
            existing = RawSource.objects.filter(url=url).first()
            if existing:
                cards_html.append(TemplateResponse(
                    request,
                    "intake/partials/inbox_card.html",
                    {"source": existing, "duplicate": True},
                ))
                continue

            source = RawSource.objects.create(
                url=url,
                input_type=RawSource.InputType.URL,
                phase=RawSource.Phase.INBOX,
                scrape_status=RawSource.ScrapeStatus.PENDING,
            )
            start_scrape_thread(source.pk)
            cards_html.append(TemplateResponse(
                request,
                "intake/partials/inbox_card.html",
                {"source": source},
            ))

        # Combine all card fragments into one response
        combined = "".join(card.render().content.decode() for card in cards_html)
        return HttpResponse(combined)


class SourceboxCardView(LoginRequiredMixin, View):
    """GET: returns a single card partial. Used by HTMX polling for scrape status."""

    def get(self, request, pk):
        source = get_object_or_404(RawSource, pk=pk)
        template = {
            RawSource.Phase.INBOX: "intake/partials/inbox_card.html",
            RawSource.Phase.REVIEW: "intake/partials/review_card.html",
            RawSource.Phase.DECIDED: "intake/partials/decided_card.html",
        }.get(source.phase, "intake/partials/inbox_card.html")

        response = TemplateResponse(request, template, {"source": source})

        # Stop polling once scrape is done
        if source.scrape_status != RawSource.ScrapeStatus.PENDING:
            response["HX-StopPolling"] = "true"

        return response


class SourceboxDetailView(LoginRequiredMixin, View):
    """GET: detail panel content. POST: save enrichment data."""

    def get(self, request, pk):
        source = get_object_or_404(RawSource, pk=pk)
        form = EnrichmentForm(initial={
            "importance": source.importance,
            "source_type": source.tags[0] if source.tags else "article",
            "tags_raw": ", ".join(source.tags) if source.tags else "",
            "decision_note": source.decision_note,
        })
        return TemplateResponse(request, "intake/partials/detail_panel.html", {
            "source": source,
            "enrichment_form": form,
        })

    def post(self, request, pk):
        source = get_object_or_404(RawSource, pk=pk)
        form = EnrichmentForm(request.POST)

        if form.is_valid():
            source.importance = form.cleaned_data["importance"]
            source.tags = form.cleaned_data["tag_list"]
            source.decision_note = form.cleaned_data.get("decision_note", "")
            source.save(update_fields=["importance", "tags", "decision_note"])

        # Return updated card for OOB swap + confirmation in panel
        card_template = {
            RawSource.Phase.INBOX: "intake/partials/inbox_card.html",
            RawSource.Phase.REVIEW: "intake/partials/review_card.html",
            RawSource.Phase.DECIDED: "intake/partials/decided_card.html",
        }.get(source.phase, "intake/partials/review_card.html")

        return TemplateResponse(request, "intake/partials/detail_panel.html", {
            "source": source,
            "enrichment_form": form,
            "saved": True,
        })


class SourceboxMoveView(LoginRequiredMixin, View):
    """POST: move a card to a new phase (drag-and-drop or button)."""

    def post(self, request):
        form = MoveForm(request.POST)
        if not form.is_valid():
            return HttpResponse("Invalid move", status=422)

        source = get_object_or_404(RawSource, pk=form.cleaned_data["source_id"])
        new_phase = form.cleaned_data["phase"]
        source.phase = new_phase
        source.save(update_fields=["phase"])

        template = {
            RawSource.Phase.INBOX: "intake/partials/inbox_card.html",
            RawSource.Phase.REVIEW: "intake/partials/review_card.html",
            RawSource.Phase.DECIDED: "intake/partials/decided_card.html",
        }.get(new_phase, "intake/partials/inbox_card.html")

        return TemplateResponse(request, template, {"source": source})


class SourceboxTriageView(LoginRequiredMixin, View):
    """POST: accept/reject/defer a RawSource. Moves to Decided phase."""

    def post(self, request, pk):
        source = get_object_or_404(RawSource, pk=pk)
        form = TriageForm(request.POST)

        if not form.is_valid():
            return HttpResponse("Invalid form", status=422)

        source.decision = form.cleaned_data["decision"]
        source.decision_note = form.cleaned_data.get("decision_note", "")
        source.decided_at = timezone.now()
        source.phase = RawSource.Phase.DECIDED
        source.save()

        # On accept: promote to research_api
        promote_result = None
        if source.decision == RawSource.Decision.ACCEPTED:
            promote_result = promote_to_research(source)
            if slug := promote_result.get("slug"):
                source.promoted_source_slug = slug
                source.save(update_fields=["promoted_source_slug"])

        return TemplateResponse(
            request,
            "intake/partials/decided_card.html",
            {"source": source, "promote_result": promote_result},
        )
```

**Step 4: Run tests**

Run: `cd publishing_api && python manage.py test apps.intake.tests.test_views -v 2`
Expected: Some tests may fail because templates don't exist yet. That's expected; the view logic is correct. Tests that only check status codes and model state should pass.

**Step 5: Commit views + urls together**

```bash
git add publishing_api/apps/intake/views.py publishing_api/apps/intake/urls.py publishing_api/apps/intake/tests/test_views.py
git commit -m "feat(intake): rewrite views for kanban board with 6 endpoints"
```

---

## Task 8: Kanban Board Template (sourcebox.html)

**Files:**
- Modify: `publishing_api/templates/intake/sourcebox.html`

**Step 1: Rewrite the main board template**

Replace `publishing_api/templates/intake/sourcebox.html`:

```htmldjango
{% extends "base.html" %}

{% block title %}Sourcebox{% endblock %}

{% block head %}
<style>
  /* Shimmer animation for loading cards */
  @keyframes shimmer {
    0% { background-position: -200px 0; }
    100% { background-position: 200px 0; }
  }
  .shimmer {
    background: linear-gradient(90deg, transparent 25%, rgba(180,90,45,0.06) 50%, transparent 75%);
    background-size: 400px 100%;
    animation: shimmer 1.8s infinite;
  }
  /* Detail panel slide-in */
  #detail-backdrop { transition: opacity 300ms ease; }
  #detail-panel {
    transition: transform 300ms ease;
    transform: translateX(100%);
  }
  #detail-panel.open { transform: translateX(0); }

  /* Sortable ghost styling */
  .sortable-ghost { opacity: 0.4; }
  .sortable-drag { box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
</style>
{% endblock %}

{% block content %}

{# ------------------------------------------------------------------ #}
{# Unified Capture Bar                                                 #}
{# ------------------------------------------------------------------ #}
<section class="mb-8">
  <c-section_label color="terracotta">Sourcebox</c-section_label>
  <p class="font-mono text-[12px] tracking-wide text-ink-muted mt-1 mb-4">
    Paste URLs, drop files, or click to upload. Sources flow through Inbox, Review, and Decided.
  </p>

  <form
    id="capture-form"
    hx-post="{% url 'intake:sourcebox-add' %}"
    hx-target="#inbox-column"
    hx-swap="afterbegin"
    hx-on::after-request="if(event.detail.successful) this.reset()"
    hx-encoding="multipart/form-data"
  >
    {% csrf_token %}
    <div class="relative">
      {{ capture_form.urls }}

      {# Hidden file input for drag-and-drop and click-to-browse #}
      <input
        type="file"
        name="source_file"
        id="file-input"
        class="hidden"
        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif"
      >

      {# Upload button (right edge) #}
      <button
        type="button"
        onclick="document.getElementById('file-input').click()"
        class="absolute right-3 top-1/2 -translate-y-1/2
               p-1.5 rounded-brand text-ink-muted hover:text-terracotta
               transition-colors duration-150"
        title="Upload a file"
      >
        <c-icon name="plus" size="18" color="currentColor" />
      </button>
    </div>

    {# Drop zone overlay (shown on dragenter) #}
    <div
      id="drop-zone"
      class="hidden mt-2 border-2 border-dashed border-terracotta/30 rounded-brand
             p-6 text-center font-mono text-[12px] text-terracotta/60"
    >
      Drop files here
    </div>
  </form>
</section>

{# ------------------------------------------------------------------ #}
{# Kanban Board: three columns                                        #}
{# ------------------------------------------------------------------ #}
<div class="grid grid-cols-3 gap-4 items-start">

  {# INBOX column #}
  <div>
    <div class="flex items-center justify-between mb-3">
      <c-section_label color="ink">Inbox</c-section_label>
      <span class="font-mono text-[10px] text-ink-muted">{{ inbox_sources|length }}</span>
    </div>
    <div
      id="inbox-column"
      class="space-y-3 min-h-[200px] p-2 rounded-brand bg-parchment-alt/30"
      data-phase="inbox"
    >
      {% for source in inbox_sources %}
        {% include "intake/partials/inbox_card.html" with source=source %}
      {% empty %}
        <p class="text-center font-mono text-[11px] text-ink-muted py-8">
          No sources in inbox
        </p>
      {% endfor %}
    </div>
  </div>

  {# REVIEW column #}
  <div>
    <div class="flex items-center justify-between mb-3">
      <c-section_label color="terracotta">Review</c-section_label>
      <span class="font-mono text-[10px] text-ink-muted">{{ review_sources|length }}</span>
    </div>
    <div
      id="review-column"
      class="space-y-3 min-h-[200px] p-2 rounded-brand bg-terracotta/[0.03]"
      data-phase="review"
    >
      {% for source in review_sources %}
        {% include "intake/partials/review_card.html" with source=source %}
      {% empty %}
        <p class="text-center font-mono text-[11px] text-ink-muted py-8">
          Drag cards here to review
        </p>
      {% endfor %}
    </div>
  </div>

  {# DECIDED column #}
  <div>
    <div class="flex items-center justify-between mb-3">
      <c-section_label color="ink">Decided</c-section_label>
      <span class="font-mono text-[10px] text-ink-muted">{{ decided_sources|length }}</span>
    </div>
    <div
      id="decided-column"
      class="space-y-3 min-h-[200px] p-2 rounded-brand bg-parchment-alt/20"
      data-phase="decided"
    >
      {% for source in decided_sources %}
        {% include "intake/partials/decided_card.html" with source=source %}
      {% empty %}
        <p class="text-center font-mono text-[11px] text-ink-muted py-8">
          No decisions yet
        </p>
      {% endfor %}
    </div>
  </div>
</div>

{# ------------------------------------------------------------------ #}
{# Detail Panel (right slide-out, populated via HTMX)                 #}
{# ------------------------------------------------------------------ #}
<div
  id="detail-backdrop"
  class="fixed inset-0 bg-ink/20 z-40 opacity-0 pointer-events-none"
  onclick="closeDetailPanel()"
></div>
<div
  id="detail-panel"
  class="fixed top-0 right-0 bottom-0 w-[40vw] min-w-[380px] max-w-[600px]
         bg-cream border-l border-border shadow-warm z-50 overflow-y-auto"
>
  <div id="detail-content" class="p-6">
    {# Loaded via HTMX from SourceboxDetailView #}
  </div>
</div>

{% endblock %}

{% block scripts %}
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js"></script>
<script>
(function() {
  // ---- Detail panel open/close ----
  window.openDetailPanel = function(pk) {
    var panel = document.getElementById('detail-panel');
    var backdrop = document.getElementById('detail-backdrop');
    var content = document.getElementById('detail-content');

    // Load content via HTMX
    htmx.ajax('GET', '/sourcebox/detail/' + pk + '/', {target: '#detail-content', swap: 'innerHTML'});

    panel.classList.add('open');
    backdrop.style.opacity = '1';
    backdrop.style.pointerEvents = 'auto';
  };

  window.closeDetailPanel = function() {
    var panel = document.getElementById('detail-panel');
    var backdrop = document.getElementById('detail-backdrop');
    panel.classList.remove('open');
    backdrop.style.opacity = '0';
    backdrop.style.pointerEvents = 'none';
  };

  // Close on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeDetailPanel();
  });

  // ---- Drag and drop file handling ----
  var captureForm = document.getElementById('capture-form');
  var dropZone = document.getElementById('drop-zone');
  var fileInput = document.getElementById('file-input');

  if (captureForm) {
    captureForm.addEventListener('dragenter', function(e) {
      e.preventDefault();
      dropZone.classList.remove('hidden');
    });
    captureForm.addEventListener('dragleave', function(e) {
      if (!captureForm.contains(e.relatedTarget)) {
        dropZone.classList.add('hidden');
      }
    });
    captureForm.addEventListener('dragover', function(e) {
      e.preventDefault();
    });
    captureForm.addEventListener('drop', function(e) {
      e.preventDefault();
      dropZone.classList.add('hidden');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        htmx.trigger(captureForm, 'submit');
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', function() {
      if (fileInput.files.length) {
        htmx.trigger(captureForm, 'submit');
      }
    });
  }

  // ---- Sortable.js for kanban columns ----
  var columns = ['inbox-column', 'review-column', 'decided-column'];
  columns.forEach(function(colId) {
    var el = document.getElementById(colId);
    if (!el) return;
    new Sortable(el, {
      group: 'sourcebox',
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      onEnd: function(evt) {
        var cardEl = evt.item;
        var targetPhase = evt.to.dataset.phase;
        var sourceId = cardEl.id.replace('source-', '');

        // POST the move to server
        htmx.ajax('POST', '/sourcebox/move/', {
          values: {
            source_id: sourceId,
            phase: targetPhase,
          },
          target: cardEl,
          swap: 'outerHTML',
        });
      },
    });
  });
})();
</script>
{% endblock %}
```

**Step 2: Verify template syntax**

Run: `cd publishing_api && python manage.py check --deploy 2>&1 | head -5`
Expected: No template syntax errors (template errors only surface at render time, but Django check catches settings issues)

**Step 3: Commit**

```bash
git add publishing_api/templates/intake/sourcebox.html
git commit -m "feat(intake): rewrite sourcebox.html as three-column kanban board"
```

---

## Task 9: Inbox Card Partial

**Files:**
- Create: `publishing_api/templates/intake/partials/inbox_card.html`

**Step 1: Write the inbox card template**

Create `publishing_api/templates/intake/partials/inbox_card.html`:

```htmldjango
{# Inbox card: minimal display with shimmer while OG scrape is pending. #}
<div
  id="source-{{ source.pk }}"
  class="rounded-brand border border-border bg-cream shadow-warm-sm p-3 cursor-pointer
         hover:shadow-warm hover:-translate-y-px transition-all duration-200
         {% if source.scrape_status == 'pending' %}shimmer{% endif %}"
  onclick="openDetailPanel({{ source.pk }})"
  {% if source.scrape_status == 'pending' %}
    hx-get="{% url 'intake:sourcebox-card' pk=source.pk %}"
    hx-trigger="every 2s"
    hx-swap="outerHTML"
  {% endif %}
>
  <div class="flex items-start gap-3">
    {# Thumbnail or file icon #}
    {% if source.og_image %}
    <div class="w-12 h-12 rounded overflow-hidden bg-parchment-alt flex-shrink-0">
      <img
        src="{{ source.og_image }}"
        alt=""
        class="w-full h-full object-cover"
        loading="lazy"
      >
    </div>
    {% elif source.is_file %}
    <div class="w-12 h-12 rounded bg-parchment-alt flex items-center justify-center flex-shrink-0">
      <c-icon name="file-text" size="20" color="#B45A2D" />
    </div>
    {% endif %}

    {# Title and site name #}
    <div class="flex-1 min-w-0">
      <p class="font-body text-[14px] text-ink line-clamp-2 m-0 leading-snug">
        {% if source.scrape_status == 'pending' %}
          <span class="text-ink-muted">{{ source.url|truncatechars:60 }}</span>
        {% else %}
          {{ source.display_title|truncatechars:80 }}
        {% endif %}
      </p>
      {% if source.og_site_name %}
      <span class="font-mono text-[9px] tracking-wide text-ink-muted uppercase">
        {{ source.og_site_name }}
      </span>
      {% endif %}
    </div>
  </div>

  {# Duplicate badge #}
  {% if duplicate %}
  <div class="mt-2">
    <c-badge color="gold" outline>Duplicate</c-badge>
  </div>
  {% endif %}

  {# Scrape failed state #}
  {% if source.scrape_status == 'failed' %}
  <div class="mt-2 flex items-center gap-2">
    <span class="font-mono text-[10px] text-error">Scrape failed</span>
    <button
      hx-post="{% url 'intake:sourcebox-add' %}"
      hx-vals='{"urls": "{{ source.url }}"}'
      hx-target="#source-{{ source.pk }}"
      hx-swap="outerHTML"
      type="button"
      class="font-mono text-[10px] text-terracotta underline cursor-pointer"
    >
      Retry
    </button>
  </div>
  {% endif %}
</div>
```

**Step 2: Commit**

```bash
git add publishing_api/templates/intake/partials/inbox_card.html
git commit -m "feat(intake): add inbox card partial with shimmer loading and polling"
```

---

## Task 10: Review Card Partial

**Files:**
- Create: `publishing_api/templates/intake/partials/review_card.html`

**Step 1: Write the review card template**

Create `publishing_api/templates/intake/partials/review_card.html`:

```htmldjango
{# Review card: richer display with tags, importance, and connection count. #}
<div
  id="source-{{ source.pk }}"
  class="rounded-brand border border-border bg-cream shadow-warm-sm p-3 cursor-pointer
         hover:shadow-warm hover:-translate-y-px transition-all duration-200"
  onclick="openDetailPanel({{ source.pk }})"
>
  <div class="flex items-start gap-3">
    {# Thumbnail or file icon #}
    {% if source.og_image %}
    <div class="w-12 h-12 rounded overflow-hidden bg-parchment-alt flex-shrink-0">
      <img
        src="{{ source.og_image }}"
        alt=""
        class="w-full h-full object-cover"
        loading="lazy"
      >
    </div>
    {% elif source.is_file %}
    <div class="w-12 h-12 rounded bg-parchment-alt flex items-center justify-center flex-shrink-0">
      <c-icon name="file-text" size="20" color="#B45A2D" />
    </div>
    {% endif %}

    {# Title and metadata #}
    <div class="flex-1 min-w-0">
      <p class="font-body text-[14px] text-ink line-clamp-2 m-0 leading-snug font-semibold">
        {{ source.display_title|truncatechars:80 }}
      </p>
      {% if source.og_site_name %}
      <span class="font-mono text-[9px] tracking-wide text-ink-muted uppercase">
        {{ source.og_site_name }}
      </span>
      {% endif %}
    </div>

    {# Importance dot #}
    <div
      class="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
      style="background: {% if source.importance == 'high' %}#B45A2D{% elif source.importance == 'low' %}#A09890{% else %}#C49A4A{% endif %};"
      title="{{ source.get_importance_display }} importance"
    ></div>
  </div>

  {# Tags + connection count #}
  {% if source.tags or source.connections %}
  <div class="flex items-center gap-2 mt-2 flex-wrap">
    {% for tag in source.tags %}
    <span class="font-mono text-[9px] tracking-wide text-ink-muted
                 px-1.5 py-[2px] bg-parchment-alt rounded border border-border">
      {{ tag }}
    </span>
    {% endfor %}
    {% if source.connections %}
    <span class="font-mono text-[9px] tracking-wide text-teal ml-auto">
      {{ source.connections|length }} link{{ source.connections|pluralize }}
    </span>
    {% endif %}
  </div>
  {% endif %}
</div>
```

**Step 2: Commit**

```bash
git add publishing_api/templates/intake/partials/review_card.html
git commit -m "feat(intake): add review card partial with importance dot and tag pills"
```

---

## Task 11: Decided Card Partial

**Files:**
- Modify: `publishing_api/templates/intake/partials/decision_result.html` (rename or replace)
- Create: `publishing_api/templates/intake/partials/decided_card.html`

**Step 1: Write the decided card template**

Create `publishing_api/templates/intake/partials/decided_card.html`:

```htmldjango
{# Decided card: muted styling with decision badge and promotion status. #}
<div
  id="source-{{ source.pk }}"
  class="rounded-brand border border-border bg-cream shadow-warm-sm p-3 opacity-75"
>
  <div class="flex items-center gap-2 mb-2">
    {# Decision badge #}
    <c-badge
      color="{% if source.decision == 'accepted' %}success{% elif source.decision == 'rejected' %}error{% else %}ink{% endif %}"
    >
      {{ source.get_decision_display }}
    </c-badge>
    {% if source.og_site_name %}
    <span class="font-mono text-[9px] tracking-wide text-ink-muted uppercase truncate">
      {{ source.og_site_name }}
    </span>
    {% endif %}
  </div>

  {# Title #}
  {% if source.url %}
  <a
    href="{{ source.url }}"
    target="_blank"
    rel="noopener noreferrer"
    class="font-body text-[13px] text-ink-secondary hover:text-ink
           no-underline transition-colors duration-150 line-clamp-2 block"
  >
    {{ source.display_title|truncatechars:60 }}
  </a>
  {% else %}
  <p class="font-body text-[13px] text-ink-secondary line-clamp-2 m-0">
    {{ source.display_title|truncatechars:60 }}
  </p>
  {% endif %}

  {# Decision note #}
  {% if source.decision_note %}
  <p class="font-body text-[11px] text-ink-muted italic leading-relaxed m-0 mt-1">
    "{{ source.decision_note|truncatechars:100 }}"
  </p>
  {% endif %}

  {# Promotion status #}
  {% if source.promoted_source_slug %}
  <div class="flex items-center gap-1.5 text-success mt-2">
    <c-icon name="magnifying-glass" size="12" color="currentColor" />
    <span class="font-mono text-[9px] tracking-wide">Promoted to Paper Trail</span>
  </div>
  {% elif promote_result.error %}
  <div class="flex items-center gap-1.5 text-error mt-2">
    <span class="font-mono text-[9px] tracking-wide">Promotion failed: {{ promote_result.error }}</span>
  </div>
  {% endif %}

  {# Timestamp #}
  {% if source.decided_at %}
  <time
    datetime="{{ source.decided_at|date:'c' }}"
    class="block font-mono text-[9px] tracking-wide text-ink-muted/50 mt-2"
  >
    {{ source.decided_at|date:"M j, g:i A" }}
  </time>
  {% endif %}
</div>
```

**Step 2: Commit**

```bash
git add publishing_api/templates/intake/partials/decided_card.html
git commit -m "feat(intake): add decided card partial with muted styling and promotion status"
```

---

## Task 12: Detail Panel Partial

**Files:**
- Create: `publishing_api/templates/intake/partials/detail_panel.html`

**Step 1: Write the detail panel template**

Create `publishing_api/templates/intake/partials/detail_panel.html`:

```htmldjango
{# Slide-out detail panel: source preview + enrichment form + decision bar. #}

{# Close button #}
<div class="flex items-center justify-between mb-6">
  <span class="font-mono text-[10px] tracking-wide text-ink-muted uppercase">Source Detail</span>
  <button
    type="button"
    onclick="closeDetailPanel()"
    class="p-1 rounded text-ink-muted hover:text-ink transition-colors cursor-pointer"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
  </button>
</div>

{# ---- Source Preview (read-only) ---- #}
<div class="flex items-start gap-4 mb-6 pb-6 border-b border-border">
  {% if source.og_image %}
  <div class="w-[120px] h-[80px] rounded overflow-hidden bg-parchment-alt flex-shrink-0">
    <img
      src="{{ source.og_image }}"
      alt=""
      class="w-full h-full object-cover"
      loading="lazy"
    >
  </div>
  {% elif source.is_file %}
  <div class="w-[120px] h-[80px] rounded bg-parchment-alt flex items-center justify-center flex-shrink-0">
    <c-icon name="file-text" size="32" color="#B45A2D" />
  </div>
  {% endif %}

  <div class="flex-1 min-w-0">
    <h3 class="font-body text-[16px] font-semibold text-ink m-0 leading-snug">
      {{ source.display_title }}
    </h3>
    {% if source.url %}
    <a
      href="{{ source.url }}"
      target="_blank"
      rel="noopener noreferrer"
      class="font-mono text-[10px] text-terracotta no-underline hover:underline break-all mt-1 block"
    >
      {{ source.url|truncatechars:80 }}
    </a>
    {% endif %}
    {% if source.og_site_name %}
    <span class="font-mono text-[10px] tracking-wide text-ink-muted uppercase mt-1 block">
      {{ source.og_site_name }}
    </span>
    {% endif %}
    {% if source.og_description %}
    <p class="font-body text-[13px] text-ink-secondary leading-relaxed mt-2 m-0">
      {{ source.og_description|truncatewords:40 }}
    </p>
    {% endif %}
    <time class="font-mono text-[9px] tracking-wide text-ink-muted/50 mt-2 block">
      Captured {{ source.created_at|date:"M j, Y g:i A" }}
    </time>
  </div>
</div>

{# Saved confirmation #}
{% if saved %}
<div class="mb-4 px-3 py-2 rounded-brand bg-success/10 border border-success/20 text-success font-mono text-[11px]">
  Enrichment saved.
</div>
{% endif %}

{# ---- Enrichment Form ---- #}
<form
  hx-post="{% url 'intake:sourcebox-detail' pk=source.pk %}"
  hx-target="#detail-content"
  hx-swap="innerHTML"
  class="space-y-5"
>
  {% csrf_token %}

  {# Importance: three toggle buttons #}
  <div>
    <label class="font-mono text-[10px] tracking-wide text-ink-muted uppercase block mb-2">
      Importance
    </label>
    <div class="flex gap-2">
      {% for value, label in enrichment_form.importance.field.choices %}
      <label
        class="
          flex-1 text-center cursor-pointer
          px-3 py-2 rounded-brand font-mono text-[11px] tracking-wide font-bold uppercase
          border transition-all duration-150
          {% if enrichment_form.importance.value == value %}
            {% if value == 'high' %}bg-terracotta/15 border-terracotta text-terracotta{% endif %}
            {% if value == 'medium' %}bg-gold/15 border-gold text-gold{% endif %}
            {% if value == 'low' %}bg-ink-muted/10 border-ink-muted/30 text-ink-muted{% endif %}
          {% else %}
            bg-transparent border-border text-ink-muted/60 hover:border-ink-muted
          {% endif %}
        "
      >
        <input type="radio" name="importance" value="{{ value }}" class="hidden"
               {% if enrichment_form.importance.value == value %}checked{% endif %}>
        {{ label }}
      </label>
      {% endfor %}
    </div>
  </div>

  {# Source Type #}
  <div>
    <label class="font-mono text-[10px] tracking-wide text-ink-muted uppercase block mb-2">
      Source Type
    </label>
    {{ enrichment_form.source_type }}
  </div>

  {# Tags #}
  <div>
    <label class="font-mono text-[10px] tracking-wide text-ink-muted uppercase block mb-2">
      Tags
    </label>
    {{ enrichment_form.tags_raw }}
    {% if source.tags %}
    <div class="flex flex-wrap gap-1 mt-2">
      {% for tag in source.tags %}
      <span class="font-mono text-[9px] tracking-wide text-ink-muted
                   px-1.5 py-[2px] bg-parchment-alt rounded border border-border">
        {{ tag }}
      </span>
      {% endfor %}
    </div>
    {% endif %}
  </div>

  {# Notes #}
  <div>
    <label class="font-mono text-[10px] tracking-wide text-ink-muted uppercase block mb-2">
      Notes
    </label>
    {{ enrichment_form.decision_note }}
  </div>

  {# Save enrichment button #}
  <c-btn variant="ghost" type="submit">
    Save Enrichment
  </c-btn>
</form>

{# ---- Decision Bar (sticky bottom) ---- #}
{% if source.decision == 'pending' %}
<div class="sticky bottom-0 bg-cream border-t border-border pt-4 mt-8 -mx-6 px-6 pb-6">
  <label class="font-mono text-[10px] tracking-wide text-ink-muted uppercase block mb-3">
    Decision
  </label>
  <div class="flex gap-2">
    <button
      hx-post="{% url 'intake:sourcebox-triage' pk=source.pk %}"
      hx-vals='{"decision": "accepted"}'
      hx-target="#source-{{ source.pk }}"
      hx-swap="outerHTML"
      hx-on::after-request="closeDetailPanel()"
      type="button"
      class="flex-1 px-3 py-2 rounded-brand font-mono text-[10px] tracking-wide font-bold uppercase
             bg-success/10 text-success border border-success/20
             hover:bg-success/20 cursor-pointer transition-colors duration-150"
    >
      Accept
    </button>
    <button
      hx-post="{% url 'intake:sourcebox-triage' pk=source.pk %}"
      hx-vals='{"decision": "rejected"}'
      hx-target="#source-{{ source.pk }}"
      hx-swap="outerHTML"
      hx-on::after-request="closeDetailPanel()"
      type="button"
      class="flex-1 px-3 py-2 rounded-brand font-mono text-[10px] tracking-wide font-bold uppercase
             bg-error/10 text-error border border-error/20
             hover:bg-error/20 cursor-pointer transition-colors duration-150"
    >
      Reject
    </button>
    <button
      hx-post="{% url 'intake:sourcebox-triage' pk=source.pk %}"
      hx-vals='{"decision": "deferred"}'
      hx-target="#source-{{ source.pk }}"
      hx-swap="outerHTML"
      hx-on::after-request="closeDetailPanel()"
      type="button"
      class="flex-1 px-3 py-2 rounded-brand font-mono text-[10px] tracking-wide font-bold uppercase
             bg-parchment-alt text-ink-muted border border-border
             hover:bg-parchment cursor-pointer transition-colors duration-150"
    >
      Defer
    </button>
  </div>
</div>
{% else %}
<div class="mt-8 pt-4 border-t border-border">
  <c-badge
    color="{% if source.decision == 'accepted' %}success{% elif source.decision == 'rejected' %}error{% else %}ink{% endif %}"
  >
    {{ source.get_decision_display }}
  </c-badge>
  {% if source.decided_at %}
  <time class="font-mono text-[9px] tracking-wide text-ink-muted/50 ml-2">
    {{ source.decided_at|date:"M j, g:i A" }}
  </time>
  {% endif %}
</div>
{% endif %}
```

**Step 2: Commit**

```bash
git add publishing_api/templates/intake/partials/detail_panel.html
git commit -m "feat(intake): add detail panel partial with enrichment form and decision bar"
```

---

## Task 13: Data Migration for Existing Records

**Files:**
- Create: data migration via `makemigrations --empty`

Existing RawSource records need sensible defaults for the new `phase` field. Already-triaged sources (decision != pending) get `phase='decided'`. Pending sources get `phase='inbox'`. All existing sources are URL-based.

**Step 1: Create the data migration**

Run: `cd publishing_api && python manage.py makemigrations intake --empty -n backfill_phase_fields`

Then edit the generated migration:

```python
from django.db import migrations


def backfill_phase(apps, schema_editor):
    RawSource = apps.get_model("intake", "RawSource")
    # Already-decided sources
    RawSource.objects.exclude(decision="pending").update(
        phase="decided",
        scrape_status="complete",
        input_type="url",
    )
    # Pending sources
    RawSource.objects.filter(decision="pending").update(
        phase="inbox",
        scrape_status="complete",  # Already scraped synchronously
        input_type="url",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("intake", "XXXX_previous_migration"),  # Replace with actual name
    ]

    operations = [
        migrations.RunPython(backfill_phase, migrations.RunPython.noop),
    ]
```

**Step 2: Apply migration**

Run: `cd publishing_api && python manage.py migrate`

**Step 3: Verify in Django shell**

Run:
```bash
cd publishing_api && python manage.py shell -c "
from apps.intake.models import RawSource
print('inbox:', RawSource.objects.filter(phase='inbox').count())
print('decided:', RawSource.objects.filter(phase='decided').count())
print('review:', RawSource.objects.filter(phase='review').count())
"
```

**Step 4: Commit**

```bash
git add publishing_api/apps/intake/migrations/
git commit -m "feat(intake): backfill phase field for existing RawSource records"
```

---

## Task 14: Remove Old Templates and Clean Up

**Files:**
- Delete: `publishing_api/templates/intake/partials/source_card.html` (replaced by inbox/review/decided cards)
- Keep: `publishing_api/templates/intake/partials/decision_result.html` (can be removed once decided_card is confirmed working)

**Step 1: Remove the old source_card.html**

Delete `publishing_api/templates/intake/partials/source_card.html`.

**Step 2: Search for any remaining references**

Search all templates and views for `source_card.html` to ensure no references remain. The views were already rewritten in Task 7 to use the new partials.

**Step 3: Run full test suite**

Run: `cd publishing_api && python manage.py test apps.intake -v 2`
Expected: All tests PASS

**Step 4: Run Django check**

Run: `cd publishing_api && python manage.py check`
Expected: System check identified no issues.

**Step 5: Commit**

```bash
git rm publishing_api/templates/intake/partials/source_card.html
git add -A publishing_api/
git commit -m "refactor(intake): remove old source_card partial, clean up imports"
```

---

## Task 15: Manual Smoke Test

**No files to modify.** This task verifies the full workflow end-to-end.

**Step 1: Start the dev server**

Run (two terminals):
```bash
cd publishing_api && python manage.py runserver
cd publishing_api && python manage.py tailwind start
```

**Step 2: Test capture flow**

1. Go to `http://localhost:8000/sourcebox/`
2. Verify three columns render (Inbox, Review, Decided)
3. Paste a URL in the capture bar and submit
4. Verify a shimmer card appears in Inbox
5. Wait ~3 seconds; verify shimmer resolves to OG metadata
6. Verify the card shows a 48px thumbnail (not a full-width banner)

**Step 3: Test enrichment flow**

1. Click a card in Inbox to open the detail panel
2. Verify the panel slides in from the right
3. Set importance to High, add tags, write a note
4. Click "Save Enrichment"
5. Verify the saved confirmation appears

**Step 4: Test drag-and-drop**

1. Drag a card from Inbox to Review
2. Verify the card moves to the Review column
3. Verify the card now shows an importance dot and tags

**Step 5: Test triage flow**

1. Click a Review card to open the detail panel
2. Click "Accept"
3. Verify the panel closes and the card moves to Decided
4. Verify the Decided card shows the green "Accepted" badge
5. Check server logs for promotion attempt (will fail locally unless research_api is running)

**Step 6: Test edge cases**

1. Paste 3 URLs at once; verify all 3 cards appear in Inbox
2. Paste a duplicate URL; verify "Duplicate" badge appears
3. Press Escape; verify detail panel closes
4. Click backdrop; verify detail panel closes

**Step 7: Final commit (if any fixes needed)**

```bash
git add -A publishing_api/
git commit -m "fix(intake): smoke test fixes for sourcebox kanban board"
```
