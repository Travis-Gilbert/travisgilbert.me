"""
Editor views: the writing interface and site management panel.

All views require login (enforced via LoginRequiredMixin). The URL structure:

  /                                 Dashboard (landing page)
  /essays/                          Essay list
  /essays/new/                      Create essay
  /essays/<slug>/                   Edit essay
  /essays/<slug>/publish/           Publish essay (POST only)
  ... (same pattern for field-notes, shelf, projects, toolkit)

  /compose/                         Page composition list
  /compose/new/                     Create page composition
  /compose/<page_key>/              Edit page composition

  /settings/tokens/                 Design tokens (singleton)
  /settings/nav/                    Navigation editor (formset)
  /settings/site/                   Site settings (singleton)
  /settings/publish-log/            Publish log (history)

  /delete/<content_type>/<slug>/    Delete content (POST only)
  /set-stage/<content_type>/<slug>/ Set stage (POST only, HTMX)
  /publish-config/                  Publish site config (POST only)
  /auto-save/                       Auto-save (HTMX endpoint)
"""

import json
import logging
import traceback
from collections import defaultdict
from datetime import timedelta

from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import Http404, JsonResponse
from django.db.models import Count, Max, Sum
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.urls import reverse
from django.views import View
from django.views.generic import CreateView, ListView, TemplateView, UpdateView

logger = logging.getLogger(__name__)

from apps.content.models import (
    DesignTokenSet,
    Essay,
    FieldNote,
    NavItem,
    NowPage,
    PageComposition,
    Project,
    PublishLog,
    ShelfEntry,
    SiteSettings,
    ToolkitEntry,
    VideoProject,
    VideoScene,
    VideoDeliverable,
    VideoSession,
)
from apps.editor.forms import (
    DesignTokenSetForm,
    EssayForm,
    FieldNoteForm,
    NavItemFormSet,
    NowPageForm,
    PageCompositionForm,
    ProjectForm,
    ShelfEntryForm,
    SiteSettingsForm,
    ToolkitEntryForm,
    VideoProjectForm,
    VideoSceneForm,
    VideoDeliverableForm,
)
from apps.publisher.github import publish_binary_file
from apps.publisher.publish import (
    delete_content,
    publish_essay,
    publish_field_note,
    publish_now_page,
    publish_project,
    publish_shelf_entry,
    publish_site_config,
    publish_toolkit_entry,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _publish_response(request, log, redirect_url):
    """Standard publish result: HTMX JSON or redirect."""
    if request.headers.get("HX-Request"):
        return JsonResponse({
            "success": log.success,
            "commit_sha": log.commit_sha,
            "commit_url": log.commit_url,
            "error": log.error_message,
        })
    return redirect(redirect_url)


def _publish_error(request, redirect_url, exc):
    """Publish exception result: HTMX JSON or redirect."""
    if request.headers.get("HX-Request"):
        return JsonResponse({
            "success": False,
            "commit_sha": "",
            "commit_url": "",
            "error": traceback.format_exc().splitlines()[-1],
        })
    return redirect(redirect_url)


# Maps URL content type slugs to model and stage field name.
# Used by DeleteContentView and SetStageView.
CONTENT_REGISTRY = {
    "essay": {"model": Essay, "stage_field": "stage"},
    "field-note": {"model": FieldNote, "stage_field": "status"},
    "shelf": {"model": ShelfEntry, "stage_field": "stage"},
    "project": {"model": Project, "stage_field": "stage"},
    "toolkit": {"model": ToolkitEntry, "stage_field": "stage"},
    "video": {"model": VideoProject, "stage_field": "phase"},
}

# Icon name + brand color for each content type. Used in list/edit headers
# and dashboard cards. Colors match the section color language from the
# Next.js frontend (terracotta=essays, teal=notes, gold=shelf/projects).
CONTENT_META = {
    "essay": {"icon": "file-text", "color": "#B45A2D"},
    "field_note": {"icon": "note-pencil", "color": "#2D5F6B"},
    "shelf": {"icon": "book-open", "color": "#C49A4A"},
    "project": {"icon": "briefcase", "color": "#C49A4A"},
    "toolkit": {"icon": "wrench", "color": "#B45A2D"},
    "now": {"icon": "clock", "color": "#2D5F6B"},
    "video": {"icon": "video-camera", "color": "#5A7A4A"},
}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = "editor/dashboard.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        # Defer large text fields not displayed on the dashboard.
        # Each model has different text fields: ShelfEntry uses
        # "annotation" instead of "body"; Essay has "annotations" (plural).
        _body_models = ("body", "composition")
        ctx["essays"] = Essay.objects.defer(*_body_models).all()[:20]
        ctx["field_notes"] = FieldNote.objects.defer(*_body_models).all()[:20]
        ctx["shelf_entries"] = ShelfEntry.objects.defer("annotation", "composition").all()[:20]
        ctx["projects"] = Project.objects.defer(*_body_models).all()[:20]
        ctx["toolkit_entries"] = ToolkitEntry.objects.defer(*_body_models).all()[:20]
        ctx["video_projects"] = VideoProject.objects.defer(
            "script_body", "research_notes", "composition",
        ).all()[:20]
        ctx["now_page"] = NowPage.objects.first()
        ctx["recent_publishes"] = PublishLog.objects.all()[:10]
        ctx["draft_counts"] = {
            "essays": Essay.objects.filter(draft=True).count(),
            "field_notes": FieldNote.objects.filter(draft=True).count(),
            "projects": Project.objects.filter(draft=True).count(),
            "videos": VideoProject.objects.filter(draft=True).count(),
        }
        ctx["has_drafts"] = (
            ctx["draft_counts"]["essays"]
            or ctx["draft_counts"]["field_notes"]
            or ctx["draft_counts"]["projects"]
            or ctx["draft_counts"]["videos"]
        )
        return ctx


# ---------------------------------------------------------------------------
# Essay CRUD
# ---------------------------------------------------------------------------


class EssayListView(LoginRequiredMixin, ListView):
    model = Essay
    template_name = "editor/content_list.html"
    context_object_name = "items"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "essay"
        ctx["content_type_plural"] = "Essays"
        ctx["content_type_display"] = "Essay"
        ctx["new_url"] = reverse("editor:essay-create")
        ctx["content_icon"] = CONTENT_META["essay"]["icon"]
        ctx["content_color"] = CONTENT_META["essay"]["color"]
        return ctx


class EssayCreateView(LoginRequiredMixin, CreateView):
    model = Essay
    form_class = EssayForm
    template_name = "editor/edit.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "essay"
        ctx["is_new"] = True
        return ctx

    def get_success_url(self):
        return reverse("editor:essay-edit", kwargs={"slug": self.object.slug})


class EssayEditView(LoginRequiredMixin, UpdateView):
    model = Essay
    form_class = EssayForm
    template_name = "editor/edit.html"
    slug_field = "slug"
    slug_url_kwarg = "slug"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "essay"
        ctx["is_new"] = False
        ctx["publish_url"] = reverse(
            "editor:essay-publish", kwargs={"slug": self.object.slug}
        )
        ctx["delete_url"] = reverse(
            "editor:delete-content",
            kwargs={"content_type": "essay", "slug": self.object.slug},
        )
        ctx["set_stage_url"] = reverse(
            "editor:set-stage",
            kwargs={"content_type": "essay", "slug": self.object.slug},
        )
        ctx["stage_choices"] = json.dumps(self.object.stage_list)
        ctx["current_stage"] = self.object.stage
        ctx["recent_publishes"] = PublishLog.objects.filter(
            content_type="essay", content_slug=self.object.slug
        )[:5]
        return ctx

    def get_success_url(self):
        return reverse("editor:essay-edit", kwargs={"slug": self.object.slug})


class EssayPublishView(LoginRequiredMixin, View):
    """POST-only view that publishes an essay to GitHub."""

    def post(self, request, slug):
        essay = get_object_or_404(Essay, slug=slug)
        redirect_url = reverse("editor:essay-edit", kwargs={"slug": slug})
        try:
            log = publish_essay(essay)
        except Exception:
            logger.exception("Publish failed for essay '%s'", slug)
            return _publish_error(request, redirect_url, None)
        return _publish_response(request, log, redirect_url)


# ---------------------------------------------------------------------------
# Field Note CRUD
# ---------------------------------------------------------------------------


class FieldNoteListView(LoginRequiredMixin, ListView):
    model = FieldNote
    template_name = "editor/content_list.html"
    context_object_name = "items"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "field_note"
        ctx["content_type_plural"] = "Field Notes"
        ctx["content_type_display"] = "Field Note"
        ctx["new_url"] = reverse("editor:field-note-create")
        ctx["content_icon"] = CONTENT_META["field_note"]["icon"]
        ctx["content_color"] = CONTENT_META["field_note"]["color"]
        return ctx


class FieldNoteCreateView(LoginRequiredMixin, CreateView):
    model = FieldNote
    form_class = FieldNoteForm
    template_name = "editor/edit.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "field_note"
        ctx["is_new"] = True
        return ctx

    def get_success_url(self):
        return reverse("editor:field-note-edit", kwargs={"slug": self.object.slug})


class FieldNoteEditView(LoginRequiredMixin, UpdateView):
    model = FieldNote
    form_class = FieldNoteForm
    template_name = "editor/edit.html"
    slug_field = "slug"
    slug_url_kwarg = "slug"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "field_note"
        ctx["is_new"] = False
        ctx["publish_url"] = reverse(
            "editor:field-note-publish", kwargs={"slug": self.object.slug}
        )
        ctx["delete_url"] = reverse(
            "editor:delete-content",
            kwargs={"content_type": "field-note", "slug": self.object.slug},
        )
        ctx["set_stage_url"] = reverse(
            "editor:set-stage",
            kwargs={"content_type": "field-note", "slug": self.object.slug},
        )
        ctx["stage_choices"] = json.dumps(self.object.stage_list)
        ctx["current_stage"] = self.object.status
        ctx["recent_publishes"] = PublishLog.objects.filter(
            content_type="field_note", content_slug=self.object.slug
        )[:5]
        return ctx

    def get_success_url(self):
        return reverse("editor:field-note-edit", kwargs={"slug": self.object.slug})


class FieldNotePublishView(LoginRequiredMixin, View):
    def post(self, request, slug):
        note = get_object_or_404(FieldNote, slug=slug)
        redirect_url = reverse("editor:field-note-edit", kwargs={"slug": slug})
        try:
            log = publish_field_note(note)
        except Exception:
            logger.exception("Publish failed for field note '%s'", slug)
            return _publish_error(request, redirect_url, None)
        return _publish_response(request, log, redirect_url)


# ---------------------------------------------------------------------------
# Shelf CRUD
# ---------------------------------------------------------------------------


class ShelfListView(LoginRequiredMixin, ListView):
    model = ShelfEntry
    template_name = "editor/content_list.html"
    context_object_name = "items"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "shelf"
        ctx["content_type_plural"] = "Shelf"
        ctx["content_type_display"] = "Shelf Entry"
        ctx["new_url"] = reverse("editor:shelf-create")
        ctx["content_icon"] = CONTENT_META["shelf"]["icon"]
        ctx["content_color"] = CONTENT_META["shelf"]["color"]
        return ctx


class ShelfCreateView(LoginRequiredMixin, CreateView):
    model = ShelfEntry
    form_class = ShelfEntryForm
    template_name = "editor/edit.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "shelf"
        ctx["is_new"] = True
        return ctx

    def get_success_url(self):
        return reverse("editor:shelf-edit", kwargs={"slug": self.object.slug})


class ShelfEditView(LoginRequiredMixin, UpdateView):
    model = ShelfEntry
    form_class = ShelfEntryForm
    template_name = "editor/edit.html"
    slug_field = "slug"
    slug_url_kwarg = "slug"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "shelf"
        ctx["is_new"] = False
        ctx["publish_url"] = reverse(
            "editor:shelf-publish", kwargs={"slug": self.object.slug}
        )
        ctx["delete_url"] = reverse(
            "editor:delete-content",
            kwargs={"content_type": "shelf", "slug": self.object.slug},
        )
        ctx["set_stage_url"] = reverse(
            "editor:set-stage",
            kwargs={"content_type": "shelf", "slug": self.object.slug},
        )
        ctx["stage_choices"] = json.dumps(self.object.stage_list)
        ctx["current_stage"] = self.object.stage
        ctx["recent_publishes"] = PublishLog.objects.filter(
            content_type="shelf", content_slug=self.object.slug
        )[:5]
        return ctx

    def get_success_url(self):
        return reverse("editor:shelf-edit", kwargs={"slug": self.object.slug})


class ShelfPublishView(LoginRequiredMixin, View):
    def post(self, request, slug):
        entry = get_object_or_404(ShelfEntry, slug=slug)
        redirect_url = reverse("editor:shelf-edit", kwargs={"slug": slug})
        try:
            log = publish_shelf_entry(entry)
        except Exception:
            logger.exception("Publish failed for shelf entry '%s'", slug)
            return _publish_error(request, redirect_url, None)
        return _publish_response(request, log, redirect_url)


# ---------------------------------------------------------------------------
# Project CRUD
# ---------------------------------------------------------------------------


class ProjectListView(LoginRequiredMixin, ListView):
    model = Project
    template_name = "editor/content_list.html"
    context_object_name = "items"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "project"
        ctx["content_type_plural"] = "Projects"
        ctx["content_type_display"] = "Project"
        ctx["new_url"] = reverse("editor:project-create")
        ctx["content_icon"] = CONTENT_META["project"]["icon"]
        ctx["content_color"] = CONTENT_META["project"]["color"]
        return ctx


class ProjectCreateView(LoginRequiredMixin, CreateView):
    model = Project
    form_class = ProjectForm
    template_name = "editor/edit.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "project"
        ctx["is_new"] = True
        return ctx

    def get_success_url(self):
        return reverse("editor:project-edit", kwargs={"slug": self.object.slug})


class ProjectEditView(LoginRequiredMixin, UpdateView):
    model = Project
    form_class = ProjectForm
    template_name = "editor/edit.html"
    slug_field = "slug"
    slug_url_kwarg = "slug"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "project"
        ctx["is_new"] = False
        ctx["publish_url"] = reverse(
            "editor:project-publish", kwargs={"slug": self.object.slug}
        )
        ctx["delete_url"] = reverse(
            "editor:delete-content",
            kwargs={"content_type": "project", "slug": self.object.slug},
        )
        ctx["set_stage_url"] = reverse(
            "editor:set-stage",
            kwargs={"content_type": "project", "slug": self.object.slug},
        )
        ctx["stage_choices"] = json.dumps(self.object.stage_list)
        ctx["current_stage"] = self.object.stage
        ctx["recent_publishes"] = PublishLog.objects.filter(
            content_type="project", content_slug=self.object.slug
        )[:5]
        return ctx

    def get_success_url(self):
        return reverse("editor:project-edit", kwargs={"slug": self.object.slug})


class ProjectPublishView(LoginRequiredMixin, View):
    def post(self, request, slug):
        project = get_object_or_404(Project, slug=slug)
        redirect_url = reverse("editor:project-edit", kwargs={"slug": slug})
        try:
            log = publish_project(project)
        except Exception:
            logger.exception("Publish failed for project '%s'", slug)
            return _publish_error(request, redirect_url, None)
        return _publish_response(request, log, redirect_url)


# ---------------------------------------------------------------------------
# Toolkit CRUD (new)
# ---------------------------------------------------------------------------


class ToolkitListView(LoginRequiredMixin, ListView):
    model = ToolkitEntry
    template_name = "editor/content_list.html"
    context_object_name = "items"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "toolkit"
        ctx["content_type_plural"] = "Toolkit"
        ctx["content_type_display"] = "Toolkit Entry"
        ctx["new_url"] = reverse("editor:toolkit-create")
        ctx["content_icon"] = CONTENT_META["toolkit"]["icon"]
        ctx["content_color"] = CONTENT_META["toolkit"]["color"]
        return ctx


class ToolkitCreateView(LoginRequiredMixin, CreateView):
    model = ToolkitEntry
    form_class = ToolkitEntryForm
    template_name = "editor/edit.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "toolkit"
        ctx["is_new"] = True
        return ctx

    def get_success_url(self):
        return reverse("editor:toolkit-edit", kwargs={"slug": self.object.slug})


class ToolkitEditView(LoginRequiredMixin, UpdateView):
    model = ToolkitEntry
    form_class = ToolkitEntryForm
    template_name = "editor/edit.html"
    slug_field = "slug"
    slug_url_kwarg = "slug"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "toolkit"
        ctx["is_new"] = False
        ctx["publish_url"] = reverse(
            "editor:toolkit-publish", kwargs={"slug": self.object.slug}
        )
        ctx["delete_url"] = reverse(
            "editor:delete-content",
            kwargs={"content_type": "toolkit", "slug": self.object.slug},
        )
        ctx["set_stage_url"] = reverse(
            "editor:set-stage",
            kwargs={"content_type": "toolkit", "slug": self.object.slug},
        )
        ctx["stage_choices"] = json.dumps(self.object.stage_list)
        ctx["current_stage"] = self.object.stage
        ctx["recent_publishes"] = PublishLog.objects.filter(
            content_type="toolkit", content_slug=self.object.slug
        )[:5]
        return ctx

    def get_success_url(self):
        return reverse("editor:toolkit-edit", kwargs={"slug": self.object.slug})


class ToolkitPublishView(LoginRequiredMixin, View):
    def post(self, request, slug):
        entry = get_object_or_404(ToolkitEntry, slug=slug)
        redirect_url = reverse("editor:toolkit-edit", kwargs={"slug": slug})
        try:
            log = publish_toolkit_entry(entry)
        except Exception:
            logger.exception("Publish failed for toolkit entry '%s'", slug)
            return _publish_error(request, redirect_url, None)
        return _publish_response(request, log, redirect_url)


# ---------------------------------------------------------------------------
# Video Project CRUD
# ---------------------------------------------------------------------------


class VideoListView(LoginRequiredMixin, ListView):
    model = VideoProject
    template_name = "editor/content_list.html"
    context_object_name = "items"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "video"
        ctx["content_type_plural"] = "Video Projects"
        ctx["content_type_display"] = "Video Project"
        ctx["new_url"] = reverse("editor:video-create")
        ctx["content_icon"] = CONTENT_META["video"]["icon"]
        ctx["content_color"] = CONTENT_META["video"]["color"]
        return ctx


class VideoCreateView(LoginRequiredMixin, CreateView):
    model = VideoProject
    form_class = VideoProjectForm
    template_name = "editor/edit.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "video"
        ctx["is_new"] = True
        return ctx

    def get_success_url(self):
        return reverse("editor:video-edit", kwargs={"slug": self.object.slug})


class VideoEditView(LoginRequiredMixin, UpdateView):
    model = VideoProject
    form_class = VideoProjectForm
    template_name = "editor/video_edit.html"
    slug_field = "slug"
    slug_url_kwarg = "slug"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "video"
        ctx["is_new"] = False
        ctx["publish_url"] = reverse(
            "editor:video-publish", kwargs={"slug": self.object.slug}
        )
        ctx["delete_url"] = reverse(
            "editor:delete-content",
            kwargs={"content_type": "video", "slug": self.object.slug},
        )
        # Video uses dedicated set-phase endpoint (lock semantics)
        ctx["set_stage_url"] = reverse(
            "editor:video-set-phase",
            kwargs={"slug": self.object.slug},
        )
        ctx["stage_choices"] = json.dumps(self.object.stage_list)
        ctx["current_stage"] = self.object.phase
        ctx["recent_publishes"] = PublishLog.objects.filter(
            content_type="video", content_slug=self.object.slug
        )[:5]
        # Phase bar context: choices tuples + numeric indices for template
        ctx["phases"] = VideoProject.Phase.choices
        ctx["phase_number"] = self.object.phase_number
        ctx["locked_phase_number"] = self.object.locked_phase_number

        # Video-specific context: scenes, deliverables, sessions
        ctx["scenes"] = self.object.scenes.all()
        ctx["deliverables"] = self.object.deliverables.all()
        ctx["sessions"] = self.object.sessions.all()[:10]
        return ctx

    def get_success_url(self):
        return reverse("editor:video-edit", kwargs={"slug": self.object.slug})


class VideoPublishView(LoginRequiredMixin, View):
    """POST-only: publish a video project to GitHub (deferred; stub for now)."""

    def post(self, request, slug):
        video = get_object_or_404(VideoProject, slug=slug)
        redirect_url = reverse("editor:video-edit", kwargs={"slug": slug})
        # Publish function will be created in Batch 5; for now return a
        # placeholder response so the route is wired and testable.
        if request.headers.get("HX-Request"):
            return JsonResponse({
                "success": False,
                "commit_sha": "",
                "commit_url": "",
                "error": "Video publishing not yet implemented.",
            })
        return redirect(redirect_url)


class VideoSetPhaseView(LoginRequiredMixin, View):
    """
    POST-only endpoint: advance or roll back a video project's phase.

    Unlike the generic SetStageView, this enforces sequential advancement
    and lock semantics via VideoProject.advance_phase() / rollback_phase().

    POST body (JSON): {"phase": "scripting"}
    Returns JSON with the updated phase and locked boundary.
    """

    def post(self, request, slug):
        video = get_object_or_404(VideoProject, slug=slug)

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        new_phase = data.get("phase", "")

        # Validate against the Phase choices
        valid_phases = [c[0] for c in VideoProject.Phase.choices]
        if new_phase not in valid_phases:
            return JsonResponse(
                {"error": f"Invalid phase: {new_phase}"}, status=400
            )

        current_number = video.phase_number
        target_number = list(dict(VideoProject.Phase.choices).keys()).index(
            new_phase
        )

        if target_number > current_number:
            # Advancing: use advance_phase() which handles locks
            if not video.can_advance:
                return JsonResponse(
                    {"error": "Cannot advance: video is published."},
                    status=400,
                )
            # Advance one step at a time to respect sequential lock semantics
            while video.phase_number < target_number:
                video.advance_phase()
        elif target_number < current_number:
            # Roll back one step at a time, respecting phase locks
            while video.phase_number > target_number:
                result = video.rollback_phase()
                if result is None:
                    return JsonResponse(
                        {"error": f"Cannot roll back past locked phase: {video.phase}"},
                        status=400,
                    )
        # else: same phase, no-op

        return JsonResponse({
            "phase": video.phase,
            "phase_locked_through": video.phase_locked_through,
            "success": True,
        })


# ---------------------------------------------------------------------------
# Video HTMX Inline Endpoints (scenes, deliverables, sessions)
# ---------------------------------------------------------------------------


def _render_scenes_panel(request, video):
    """Re-render the scenes partial for an HTMX swap."""
    return render(request, "editor/partials/video_scenes.html", {
        "scenes": video.scenes.all(),
        "object": video,
        "current_stage": video.phase,
    })


def _render_deliverables_panel(request, video):
    """Re-render the deliverables partial for an HTMX swap."""
    return render(request, "editor/partials/video_deliverables.html", {
        "deliverables": video.deliverables.all(),
        "object": video,
    })


def _render_sessions_panel(request, video):
    """Re-render the sessions partial for an HTMX swap."""
    return render(request, "editor/partials/video_sessions.html", {
        "sessions": video.sessions.all()[:10],
        "object": video,
    })


class VideoSceneAddView(LoginRequiredMixin, View):
    """POST: create a new blank scene, return refreshed scenes panel."""

    def post(self, request, slug):
        video = get_object_or_404(VideoProject, slug=slug)
        max_order = video.scenes.aggregate(Max("order"))["order__max"] or 0
        VideoScene.objects.create(
            video=video,
            order=max_order + 1,
            title=f"Scene {max_order + 1}",
        )
        return _render_scenes_panel(request, video)


class VideoSceneUpdateView(LoginRequiredMixin, View):
    """POST: update a scene via form data, return refreshed scenes panel."""

    def post(self, request, slug, pk):
        video = get_object_or_404(VideoProject, slug=slug)
        scene = get_object_or_404(VideoScene, pk=pk, video=video)
        form = VideoSceneForm(request.POST, instance=scene)
        if form.is_valid():
            form.save()
        return _render_scenes_panel(request, video)


class VideoSceneDeleteView(LoginRequiredMixin, View):
    """POST: delete a scene, return refreshed scenes panel."""

    def post(self, request, slug, pk):
        video = get_object_or_404(VideoProject, slug=slug)
        scene = get_object_or_404(VideoScene, pk=pk, video=video)
        scene.delete()
        return _render_scenes_panel(request, video)


class VideoSceneToggleView(LoginRequiredMixin, View):
    """POST: toggle a boolean completion field on a scene."""

    def post(self, request, slug, pk):
        video = get_object_or_404(VideoProject, slug=slug)
        scene = get_object_or_404(VideoScene, pk=pk, video=video)
        field = request.POST.get("field", "")
        toggleable = {
            "script_locked", "vo_recorded", "filmed", "assembled", "polished",
        }
        if field in toggleable:
            setattr(scene, field, not getattr(scene, field))
            scene.save()
        return _render_scenes_panel(request, video)


class VideoDeliverableAddView(LoginRequiredMixin, View):
    """POST: create a new deliverable at the current phase."""

    def post(self, request, slug):
        video = get_object_or_404(VideoProject, slug=slug)
        VideoDeliverable.objects.create(
            video=video,
            phase=video.phase,
            deliverable_type=VideoDeliverable.DeliverableType.RESEARCH_NOTES,
        )
        return _render_deliverables_panel(request, video)


class VideoDeliverableUpdateView(LoginRequiredMixin, View):
    """POST: update a deliverable via form data."""

    def post(self, request, slug, pk):
        video = get_object_or_404(VideoProject, slug=slug)
        deliverable = get_object_or_404(VideoDeliverable, pk=pk, video=video)
        form = VideoDeliverableForm(request.POST, instance=deliverable)
        if form.is_valid():
            form.save()
        return _render_deliverables_panel(request, video)


class VideoDeliverableDeleteView(LoginRequiredMixin, View):
    """POST: delete a deliverable."""

    def post(self, request, slug, pk):
        video = get_object_or_404(VideoProject, slug=slug)
        deliverable = get_object_or_404(VideoDeliverable, pk=pk, video=video)
        deliverable.delete()
        return _render_deliverables_panel(request, video)


class VideoSessionStartView(LoginRequiredMixin, View):
    """POST: start a new work session at the current phase."""

    def post(self, request, slug):
        video = get_object_or_404(VideoProject, slug=slug)
        VideoSession.objects.create(
            video=video,
            phase=video.phase,
            started_at=timezone.now(),
        )
        return _render_sessions_panel(request, video)


class VideoSessionStopView(LoginRequiredMixin, View):
    """POST: stop an active session, compute duration."""

    def post(self, request, slug, pk):
        video = get_object_or_404(VideoProject, slug=slug)
        session = get_object_or_404(VideoSession, pk=pk, video=video)
        if not session.ended_at:
            session.ended_at = timezone.now()
            session.duration_minutes = int(
                (session.ended_at - session.started_at).total_seconds() / 60
            )
            session.save()
        return _render_sessions_panel(request, video)


# ---------------------------------------------------------------------------
# Now Page
# ---------------------------------------------------------------------------


class NowPageEditView(LoginRequiredMixin, UpdateView):
    model = NowPage
    form_class = NowPageForm
    template_name = "editor/edit_now.html"

    def get_object(self, queryset=None):
        obj, _ = NowPage.objects.get_or_create(
            pk=1,
            defaults={"updated": "2026-01-01"},
        )
        return obj

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "now"
        ctx["publish_url"] = reverse("editor:now-publish")
        ctx["recent_publishes"] = PublishLog.objects.filter(
            content_type="now"
        )[:5]
        return ctx

    def get_success_url(self):
        return reverse("editor:now-edit")


class NowPagePublishView(LoginRequiredMixin, View):
    def post(self, request):
        now = get_object_or_404(NowPage, pk=1)
        redirect_url = reverse("editor:now-edit")
        try:
            log = publish_now_page(now)
        except Exception:
            logger.exception("Publish failed for Now page")
            return _publish_error(request, redirect_url, None)
        return _publish_response(request, log, redirect_url)


# ---------------------------------------------------------------------------
# Generic content actions (delete, set-stage)
# ---------------------------------------------------------------------------


class DeleteContentView(LoginRequiredMixin, View):
    """
    POST-only: delete content from GitHub and DB.

    Requires confirm_slug in POST data to match the actual slug.
    Returns HTMX JSON or redirects to the content type list.
    """

    # Maps URL content_type to list URL name
    LIST_URLS = {
        "essay": "editor:essay-list",
        "field-note": "editor:field-note-list",
        "shelf": "editor:shelf-list",
        "project": "editor:project-list",
        "toolkit": "editor:toolkit-list",
        "video": "editor:video-list",
    }

    def post(self, request, content_type, slug):
        if content_type not in CONTENT_REGISTRY:
            raise Http404

        model = CONTENT_REGISTRY[content_type]["model"]
        instance = get_object_or_404(model, slug=slug)
        list_url = reverse(self.LIST_URLS[content_type])

        # Safety: require the user to type the slug to confirm
        confirm = request.POST.get("confirm_slug", "")
        if confirm != slug:
            if request.headers.get("HX-Request"):
                return JsonResponse(
                    {"error": "Slug confirmation does not match."}, status=400
                )
            return redirect(list_url)

        try:
            log = delete_content(instance)
        except Exception:
            logger.exception("Delete failed for %s '%s'", content_type, slug)
            return _publish_error(request, list_url, None)

        return _publish_response(request, log, list_url)


class SetStageView(LoginRequiredMixin, View):
    """
    POST-only HTMX endpoint: advance or set a content item's stage.

    POST body (JSON): {"stage": "drafting"}
    Returns JSON with the new stage value.
    """

    def post(self, request, content_type, slug):
        if content_type not in CONTENT_REGISTRY:
            raise Http404

        reg = CONTENT_REGISTRY[content_type]
        model = reg["model"]
        field_name = reg["stage_field"]
        instance = get_object_or_404(model, slug=slug)

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        new_stage = data.get("stage", "")

        # Validate against the model's field choices
        field = model._meta.get_field(field_name)
        valid_values = [c[0] for c in field.choices]
        if new_stage not in valid_values:
            return JsonResponse(
                {"error": f"Invalid stage: {new_stage}"}, status=400
            )

        setattr(instance, field_name, new_stage)
        update_fields = [field_name]
        if hasattr(instance, "updated_at"):
            update_fields.append("updated_at")
        instance.save(update_fields=update_fields)

        return JsonResponse({"stage": new_stage, "success": True})


# ---------------------------------------------------------------------------
# Page Composition (Compose section)
# ---------------------------------------------------------------------------


class PageCompositionListView(LoginRequiredMixin, ListView):
    model = PageComposition
    template_name = "editor/compose_list.html"
    context_object_name = "compositions"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["nav_section"] = "compose"
        return ctx


class PageCompositionCreateView(LoginRequiredMixin, CreateView):
    model = PageComposition
    form_class = PageCompositionForm
    template_name = "editor/compose_edit.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["nav_section"] = "compose"
        return ctx

    def get_success_url(self):
        return reverse(
            "editor:compose-edit", kwargs={"page_key": self.object.page_key}
        )


class PageCompositionEditView(LoginRequiredMixin, UpdateView):
    model = PageComposition
    form_class = PageCompositionForm
    template_name = "editor/compose_edit.html"
    slug_field = "page_key"
    slug_url_kwarg = "page_key"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["nav_section"] = "compose"
        return ctx

    def get_success_url(self):
        return reverse(
            "editor:compose-edit", kwargs={"page_key": self.object.page_key}
        )


# ---------------------------------------------------------------------------
# Settings: Design Tokens (singleton)
# ---------------------------------------------------------------------------


class DesignTokensEditView(LoginRequiredMixin, UpdateView):
    model = DesignTokenSet
    form_class = DesignTokenSetForm
    template_name = "editor/tokens.html"

    def get_object(self, queryset=None):
        return DesignTokenSet.load()

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["nav_section"] = "tokens"
        return ctx

    def get_success_url(self):
        return reverse("editor:tokens-edit")


# ---------------------------------------------------------------------------
# Settings: Navigation (formset)
# ---------------------------------------------------------------------------


class NavEditorView(LoginRequiredMixin, TemplateView):
    template_name = "editor/nav_editor.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["nav_section"] = "nav"
        if "formset" not in ctx:
            ctx["formset"] = NavItemFormSet(
                queryset=NavItem.objects.order_by("order")
            )
        return ctx

    def post(self, request, *args, **kwargs):
        formset = NavItemFormSet(
            request.POST, queryset=NavItem.objects.order_by("order")
        )
        if formset.is_valid():
            formset.save()
            return redirect(reverse("editor:nav-editor"))
        ctx = self.get_context_data(formset=formset)
        return self.render_to_response(ctx)


# ---------------------------------------------------------------------------
# Settings: Site Settings (singleton)
# ---------------------------------------------------------------------------


class SiteSettingsEditView(LoginRequiredMixin, UpdateView):
    model = SiteSettings
    form_class = SiteSettingsForm
    template_name = "editor/settings.html"

    def get_object(self, queryset=None):
        return SiteSettings.load()

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["nav_section"] = "site_settings"
        return ctx

    def get_success_url(self):
        return reverse("editor:site-settings")


# ---------------------------------------------------------------------------
# Settings: Publish Log
# ---------------------------------------------------------------------------


class PublishLogListView(LoginRequiredMixin, ListView):
    model = PublishLog
    template_name = "editor/publish_log.html"
    context_object_name = "logs"
    paginate_by = 50
    ordering = ["-created_at"]

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["nav_section"] = "publish_log"
        return ctx


# ---------------------------------------------------------------------------
# Publish site configuration (POST only)
# ---------------------------------------------------------------------------


class PublishSiteConfigView(LoginRequiredMixin, View):
    """Publish site.json to GitHub (design tokens, nav, SEO, pages)."""

    def post(self, request):
        redirect_url = reverse("editor:site-settings")
        try:
            log = publish_site_config()
        except Exception:
            logger.exception("Publish failed for site configuration")
            return _publish_error(request, redirect_url, None)
        return _publish_response(request, log, redirect_url)


# ---------------------------------------------------------------------------
# Auto-save (HTMX endpoint)
# ---------------------------------------------------------------------------


class AutoSaveView(LoginRequiredMixin, View):
    """
    HTMX POST endpoint for auto-saving drafts.

    Accepts JSON with content_type, slug (or id for now page), and fields.
    Returns a JSON response with saved status.
    """

    MODEL_MAP = {
        "essay": (Essay, EssayForm),
        "field_note": (FieldNote, FieldNoteForm),
        "shelf": (ShelfEntry, ShelfEntryForm),
        "project": (Project, ProjectForm),
        "toolkit": (ToolkitEntry, ToolkitEntryForm),
        "video": (VideoProject, VideoProjectForm),
    }

    def post(self, request):
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        content_type = data.get("content_type")
        slug = data.get("slug")

        if content_type == "now":
            obj = NowPage.objects.first()
            if obj:
                form = NowPageForm(data.get("fields", {}), instance=obj)
                if form.is_valid():
                    form.save()
                    return JsonResponse({"saved": True})
                return JsonResponse({"saved": False, "errors": form.errors}, status=400)

        if content_type not in self.MODEL_MAP:
            return JsonResponse({"error": "Unknown content type"}, status=400)

        model_cls, form_cls = self.MODEL_MAP[content_type]
        obj = get_object_or_404(model_cls, slug=slug)
        form = form_cls(data.get("fields", {}), instance=obj)
        if form.is_valid():
            form.save()
            return JsonResponse({"saved": True})
        return JsonResponse({"saved": False, "errors": form.errors}, status=400)


# ---------------------------------------------------------------------------
# Collage image upload
# ---------------------------------------------------------------------------

# 500 KB limit for collage fragment PNGs
MAX_COLLAGE_UPLOAD_BYTES = 500 * 1024

ALLOWED_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}


class UploadCollageImageView(LoginRequiredMixin, View):
    """
    POST-only: upload a collage fragment image to public/collage/ via GitHub.

    Accepts multipart form data with a single file field named "image".
    Validates file type (PNG, JPEG, WebP) and size (max 500KB).
    Commits the file to public/collage/{sanitized_name} in the repo.
    Returns JSON with the path for the composition form to reference.
    """

    def post(self, request):
        import re

        uploaded = request.FILES.get("image")
        if not uploaded:
            return JsonResponse({"error": "No image file provided."}, status=400)

        # Validate content type
        content_type = uploaded.content_type
        if content_type not in ALLOWED_IMAGE_TYPES:
            allowed = ", ".join(ALLOWED_IMAGE_TYPES.keys())
            return JsonResponse(
                {"error": f"Invalid file type: {content_type}. Allowed: {allowed}"},
                status=400,
            )

        # Validate size
        if uploaded.size > MAX_COLLAGE_UPLOAD_BYTES:
            limit_kb = MAX_COLLAGE_UPLOAD_BYTES // 1024
            return JsonResponse(
                {"error": f"File too large ({uploaded.size} bytes). Max: {limit_kb}KB."},
                status=400,
            )

        # Sanitize filename: lowercase, alphanumeric + hyphens only, force correct extension
        base_name = uploaded.name.rsplit(".", 1)[0] if "." in uploaded.name else uploaded.name
        safe_name = re.sub(r"[^a-z0-9]+", "-", base_name.lower()).strip("-")
        if not safe_name:
            safe_name = "fragment"
        ext = ALLOWED_IMAGE_TYPES[content_type]
        filename = f"{safe_name}{ext}"

        # Read all bytes
        raw_bytes = uploaded.read()

        # Commit to repo
        repo_path = f"public/collage/{filename}"
        result = publish_binary_file(
            file_path=repo_path,
            content_bytes=raw_bytes,
            commit_message=f"feat(collage): upload {filename}",
        )

        if result["success"]:
            return JsonResponse({
                "success": True,
                "path": f"/collage/{filename}",
                "repo_path": repo_path,
                "commit_sha": result["commit_sha"],
            })

        return JsonResponse(
            {"success": False, "error": result.get("error", "Upload failed.")},
            status=500,
        )


# ---------------------------------------------------------------------------
# Video API endpoints (for Orchestra Conductor + frontend)
# ---------------------------------------------------------------------------


def _serialize_scene(scene):
    """Compact JSON dict for a VideoScene."""
    return {
        "id": scene.pk,
        "order": scene.order,
        "title": scene.title,
        "scene_type": scene.scene_type,
        "word_count": scene.word_count,
        "estimated_seconds": scene.estimated_seconds,
        "script_locked": scene.script_locked,
        "vo_recorded": scene.vo_recorded,
        "filmed": scene.filmed,
        "assembled": scene.assembled,
        "polished": scene.polished,
    }


def _serialize_deliverable(d):
    """Compact JSON dict for a VideoDeliverable."""
    return {
        "id": d.pk,
        "phase": d.phase,
        "type": d.deliverable_type,
        "file_path": d.file_path,
        "file_url": d.file_url,
        "approved": d.approved,
        "created_at": d.created_at.isoformat(),
    }


def _serialize_session(s):
    """Compact JSON dict for a VideoSession."""
    return {
        "id": s.pk,
        "phase": s.phase,
        "started_at": s.started_at.isoformat(),
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
        "duration_minutes": s.duration_minutes,
        "summary": s.summary,
        "subtasks_completed": s.subtasks_completed,
        "next_action": s.next_action,
        "next_tool": s.next_tool,
    }


def _serialize_video(video, detail=False):
    """
    Serialize a VideoProject to a JSON-safe dict.
    detail=True includes scenes, deliverables, and richer metadata.
    """
    data = {
        "slug": video.slug,
        "title": video.title,
        "short_title": video.short_title,
        "phase": video.phase,
        "phase_display": video.get_phase_display(),
        "phase_number": video.phase_number,
        "draft": video.draft,
        "updated_at": video.updated_at.isoformat(),
        "youtube_id": video.youtube_id,
        "linked_essay_slugs": [e.slug for e in video.linked_essays.all()],
        "published_at": video.published_at.isoformat() if video.published_at else None,
    }

    if detail:
        data.update({
            "thesis": video.thesis,
            "sources": video.sources,
            "script_word_count": video.script_word_count,
            "script_estimated_duration": video.script_estimated_duration,
            "youtube_id": video.youtube_id,
            "youtube_url": video.youtube_url,
            "youtube_title": video.youtube_title,
            "linked_essays": [
                {"slug": e.slug, "title": e.title}
                for e in video.linked_essays.all()
            ],
            "linked_field_notes": [
                {"slug": n.slug, "title": n.title}
                for n in video.linked_field_notes.all()
            ],
            "scenes": [_serialize_scene(s) for s in video.scenes.all()],
            "deliverables": [
                _serialize_deliverable(d) for d in video.deliverables.all()
            ],
        })

    return data


# Phase to scene boolean field mapping (which boolean tracks completion for each phase)
_PHASE_SCENE_FIELD = {
    "scripting": "script_locked",
    "voiceover": "vo_recorded",
    "filming": "filmed",
    "assembly": "assembled",
    "polish": "polished",
}

# Phase to suggested tool
_PHASE_TOOL = {
    "research": "Browser / Zotero",
    "scripting": "Ulysses",
    "voiceover": "Descript",
    "filming": "Camera",
    "assembly": "DaVinci Resolve",
    "polish": "DaVinci Resolve",
    "metadata": "Studio",
    "publish": "YouTube Studio",
}


class VideoAPIListView(View):
    """GET /api/videos/ : list active (non-published) video projects."""

    def get(self, request):
        qs = VideoProject.objects.prefetch_related("linked_essays").all()
        if request.GET.get("active") == "true":
            qs = qs.exclude(phase="published")
        return JsonResponse(
            {"videos": [_serialize_video(v) for v in qs]},
        )


class VideoAPIDetailView(View):
    """GET /api/videos/<slug>/ : full project detail with scenes and deliverables."""

    def get(self, request, slug):
        video = get_object_or_404(VideoProject, slug=slug)
        return JsonResponse(_serialize_video(video, detail=True))


class VideoAPISessionsView(View):
    """GET /api/videos/<slug>/sessions/ : session history for a project."""

    def get(self, request, slug):
        video = get_object_or_404(VideoProject, slug=slug)
        sessions = video.sessions.all()
        return JsonResponse({
            "video": video.slug,
            "sessions": [_serialize_session(s) for s in sessions],
        })


class VideoAPILogSessionView(View):
    """
    POST /api/videos/<slug>/log-session/
    Log a completed work session. Body (JSON):
    {
        "phase": "voiceover",
        "started_at": "2026-02-28T14:00:00Z",
        "ended_at": "2026-02-28T15:30:00Z",
        "summary": "Recorded scenes 1-3",
        "subtasks_completed": ["Scene 1", "Scene 2", "Scene 3"],
        "next_action": "Record Scene 4",
        "next_tool": "Descript"
    }
    """

    def post(self, request, slug):
        video = get_object_or_404(VideoProject, slug=slug)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        phase = data.get("phase", video.phase)
        started_at = data.get("started_at")
        ended_at = data.get("ended_at")

        if not started_at:
            return JsonResponse(
                {"error": "started_at is required"}, status=400
            )

        from django.utils.dateparse import parse_datetime

        started_dt = parse_datetime(started_at)
        ended_dt = parse_datetime(ended_at) if ended_at else None

        if not started_dt:
            return JsonResponse(
                {"error": "Invalid started_at format"}, status=400
            )

        duration = 0
        if started_dt and ended_dt:
            duration = int((ended_dt - started_dt).total_seconds() / 60)

        session = VideoSession.objects.create(
            video=video,
            phase=phase,
            started_at=started_dt,
            ended_at=ended_dt,
            duration_minutes=duration,
            summary=data.get("summary", ""),
            subtasks_completed=data.get("subtasks_completed", []),
            next_action=data.get("next_action", ""),
            next_tool=data.get("next_tool", ""),
        )

        return JsonResponse({
            "success": True,
            "session": _serialize_session(session),
        }, status=201)


class VideoAPIAdvanceView(View):
    """
    POST /api/videos/<slug>/advance/
    Advance video to the next phase. Validates that phase criteria are met.
    """

    def post(self, request, slug):
        video = get_object_or_404(VideoProject, slug=slug)

        if not video.can_advance():
            return JsonResponse(
                {"error": "Video is already published"}, status=400
            )

        # Check phase-specific criteria
        current = video.phase
        issues = []

        if current == "scripting":
            unlocked = video.scenes.filter(script_locked=False)
            if unlocked.exists():
                titles = [s.title for s in unlocked]
                issues.append(
                    f"Scenes not script-locked: {', '.join(titles)}"
                )

        elif current == "voiceover":
            vo_scenes = video.scenes.filter(
                scene_type__in=["vo", "mixed"]
            )
            unrecorded = vo_scenes.filter(vo_recorded=False)
            if unrecorded.exists():
                titles = [s.title for s in unrecorded]
                issues.append(
                    f"VO not recorded: {', '.join(titles)}"
                )

        elif current == "filming":
            cam_scenes = video.scenes.filter(
                scene_type__in=["on_camera", "mixed"]
            )
            unfilmed = cam_scenes.filter(filmed=False)
            if unfilmed.exists():
                titles = [s.title for s in unfilmed]
                issues.append(
                    f"Scenes not filmed: {', '.join(titles)}"
                )

        elif current == "assembly":
            unassembled = video.scenes.filter(assembled=False)
            if unassembled.exists():
                titles = [s.title for s in unassembled]
                issues.append(
                    f"Scenes not assembled: {', '.join(titles)}"
                )

        elif current == "polish":
            unpolished = video.scenes.filter(polished=False)
            if unpolished.exists():
                titles = [s.title for s in unpolished]
                issues.append(
                    f"Scenes not polished: {', '.join(titles)}"
                )

        elif current == "metadata":
            if not video.youtube_title:
                issues.append("YouTube title not set")
            if not video.youtube_description:
                issues.append("YouTube description not set")

        # Allow force advance even with issues
        force = False
        try:
            body = json.loads(request.body) if request.body else {}
            force = body.get("force", False)
        except json.JSONDecodeError:
            pass

        if issues and not force:
            return JsonResponse({
                "error": "Phase criteria not met",
                "issues": issues,
                "hint": "Send {\"force\": true} to advance anyway",
            }, status=409)

        new_phase = video.advance_phase()
        return JsonResponse({
            "success": True,
            "previous_phase": current,
            "new_phase": new_phase,
            "new_phase_display": video.get_phase_display(),
        })


class VideoAPIDeliverableView(View):
    """
    POST /api/videos/<slug>/deliverable/
    Register a new deliverable. Body (JSON):
    {
        "phase": "voiceover",
        "type": "vo_audio",
        "file_path": "/path/to/audio.wav",
        "file_url": "",
        "notes": "Clean recording, no retakes needed"
    }
    """

    def post(self, request, slug):
        video = get_object_or_404(VideoProject, slug=slug)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        d_type = data.get("type", "")
        valid_types = [c[0] for c in VideoDeliverable.DeliverableType.choices]
        if d_type not in valid_types:
            return JsonResponse(
                {"error": f"Invalid deliverable type: {d_type}"}, status=400
            )

        deliverable = VideoDeliverable.objects.create(
            video=video,
            phase=data.get("phase", video.phase),
            deliverable_type=d_type,
            file_path=data.get("file_path", ""),
            file_url=data.get("file_url", ""),
            notes=data.get("notes", ""),
        )

        return JsonResponse({
            "success": True,
            "deliverable": _serialize_deliverable(deliverable),
        }, status=201)


class VideoAPINextActionView(View):
    """
    GET /api/videos/<slug>/next-action/
    Session Launcher logic: determines the recommended next action
    based on current phase and scene completion status.
    """

    def get(self, request, slug):
        video = get_object_or_404(VideoProject, slug=slug)
        scenes = list(video.scenes.all())
        current = video.phase

        if current == "published":
            return JsonResponse({
                "video": video.short_title or video.title,
                "phase": "Published",
                "phase_name": "Published",
                "progress": "Complete",
                "next_action": "No action needed",
                "next_tool": None,
                "estimated_minutes": 0,
                "done_when": None,
                "context": [],
            })

        # Determine progress and next action based on phase
        scene_field = _PHASE_SCENE_FIELD.get(current)
        tool = _PHASE_TOOL.get(current, "Studio")

        phase_label = video.get_phase_display()
        phase_code = f"P{video.phase_number}"

        # Default next action for phases without per-scene tracking
        if not scene_field:
            # Research, metadata, publish phases
            next_action, done_when, est_min, context = (
                _phase_action_no_scenes(video, current, scenes)
            )
            return JsonResponse({
                "video": video.short_title or video.title,
                "phase": phase_code,
                "phase_name": phase_label,
                "progress": "In progress",
                "next_action": next_action,
                "next_tool": tool,
                "estimated_minutes": est_min,
                "done_when": done_when,
                "context": context,
            })

        # Phases with per-scene completion (scripting through polish)
        total = len(scenes)
        done = sum(1 for s in scenes if getattr(s, scene_field))
        incomplete = [s for s in scenes if not getattr(s, scene_field)]

        if not incomplete:
            return JsonResponse({
                "video": video.short_title or video.title,
                "phase": phase_code,
                "phase_name": phase_label,
                "progress": f"{done}/{total} complete",
                "next_action": f"All scenes complete for {phase_label}. Ready to advance.",
                "next_tool": "Studio",
                "estimated_minutes": 2,
                "done_when": f"Phase advanced from {phase_label}",
                "context": [f"Use POST /api/videos/{video.slug}/advance/ to proceed"],
            })

        next_scene = incomplete[0]
        est_seconds = next_scene.estimated_seconds or 120
        est_minutes = max(5, est_seconds // 60 * 2)  # Rough 2x multiplier for production overhead

        field_label = scene_field.replace("_", " ").title()
        action = f"{field_label}: Scene {next_scene.order}: {next_scene.title}"

        context_lines = []
        if next_scene.word_count:
            context_lines.append(
                f"Scene {next_scene.order} is {next_scene.word_count} words, "
                f"estimated {next_scene.estimated_seconds}s"
            )

        last_session = video.sessions.first()
        if last_session and last_session.summary:
            context_lines.append(
                f"Previous session: {last_session.summary}"
            )

        return JsonResponse({
            "video": video.short_title or video.title,
            "phase": phase_code,
            "phase_name": phase_label,
            "progress": f"{done}/{total} scenes complete",
            "next_action": action,
            "next_tool": tool,
            "estimated_minutes": est_minutes,
            "done_when": f"Scene {next_scene.order} {field_label.lower()} exported",
            "context": context_lines,
        })


def _phase_action_no_scenes(video, phase, scenes):
    """
    Return (next_action, done_when, estimated_minutes, context_lines)
    for phases that don't track per-scene booleans.
    """
    if phase == "research":
        has_thesis = bool(video.thesis)
        has_sources = bool(video.sources)
        if not has_thesis and not has_sources:
            return (
                "Define thesis and gather initial sources",
                "Thesis statement written and at least 3 sources collected",
                30,
                ["Start with the central question this video will answer"],
            )
        if not has_thesis:
            return (
                "Write the thesis statement",
                "One-sentence thesis captured in project",
                15,
                [f"{len(video.sources)} sources already collected"],
            )
        return (
            "Review sources and finalize research notes",
            "Research notes complete, ready to outline script",
            20,
            [
                f"Thesis: {video.thesis[:80]}",
                f"{len(video.sources)} sources collected",
            ],
        )

    if phase == "metadata":
        missing = []
        if not video.youtube_title:
            missing.append("title")
        if not video.youtube_description:
            missing.append("description")
        if not video.youtube_tags:
            missing.append("tags")
        if not video.youtube_chapters:
            missing.append("chapters")
        if missing:
            return (
                f"Complete YouTube metadata: {', '.join(missing)}",
                "All metadata fields populated",
                20,
                [f"Use Generate Description button for a starting point"],
            )
        return (
            "Review and finalize all metadata",
            "Metadata approved, ready for export",
            10,
            [],
        )

    if phase == "publish":
        return (
            "Upload video to YouTube and set publish date",
            "Video live on YouTube, youtube_id recorded in project",
            15,
            ["Export final render from DaVinci Resolve first"],
        )

    return ("Continue working", "Phase complete", 30, [])


# ---------------------------------------------------------------------------
# Video research integration
# ---------------------------------------------------------------------------


class VideoPullResearchView(LoginRequiredMixin, View):
    """
    POST /video/<slug>/pull-research/
    Pull sources and annotations from linked essays into the video project.
    One-time merge operation (idempotent on URL match).
    """

    def post(self, request, slug):
        video = get_object_or_404(VideoProject, slug=slug)
        essays = video.linked_essays.all()

        if not essays.exists():
            if request.headers.get("HX-Request"):
                return JsonResponse(
                    {"message": "No linked essays to pull from."}, status=200
                )
            return redirect(
                reverse("editor:video-edit", kwargs={"slug": slug})
            )

        existing_urls = {
            s.get("url", "") for s in (video.sources or []) if s.get("url")
        }
        new_sources = list(video.sources or [])
        notes_additions = []

        for essay in essays:
            # Merge sources (skip duplicates by URL)
            essay_sources = getattr(essay, "sources", None) or []
            if isinstance(essay_sources, list):
                for src in essay_sources:
                    url = src.get("url", "")
                    if url and url not in existing_urls:
                        new_sources.append(src)
                        existing_urls.add(url)

            # Append annotations to research notes
            annotations = getattr(essay, "annotations", None) or []
            if isinstance(annotations, list) and annotations:
                notes_lines = [f"\n\n## From: {essay.title}\n"]
                for ann in annotations:
                    text = ann.get("text", "") if isinstance(ann, dict) else str(ann)
                    if text:
                        notes_lines.append(f"- {text}")
                notes_additions.append("\n".join(notes_lines))

        video.sources = new_sources
        if notes_additions:
            video.research_notes = (
                video.research_notes + "\n".join(notes_additions)
            )
        video.save()

        if request.headers.get("HX-Request"):
            return JsonResponse({
                "success": True,
                "sources_count": len(new_sources),
                "message": f"Pulled research from {essays.count()} essay(s)",
            })
        return redirect(
            reverse("editor:video-edit", kwargs={"slug": slug})
        )


class VideoGenerateDescriptionView(LoginRequiredMixin, View):
    """
    POST /video/<slug>/generate-description/
    Generate YouTube description from project data and update the field.
    Returns the generated text for HTMX to inject into the textarea.
    """

    def post(self, request, slug):
        from apps.content.description_generator import generate_description

        video = get_object_or_404(VideoProject, slug=slug)
        description = generate_description(video)
        video.youtube_description = description
        video.save(update_fields=["youtube_description", "updated_at"])

        if request.headers.get("HX-Request"):
            return JsonResponse({
                "success": True,
                "description": description,
            })
        return redirect(
            reverse("editor:video-edit", kwargs={"slug": slug})
        )


class ProductionDashboardView(LoginRequiredMixin, TemplateView):
    """
    GET /production/
    Production dashboard: active video projects, session heatmap,
    cumulative output, and weekly summary.
    """

    template_name = "editor/production_dashboard.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        now = timezone.now()

        # ── Active projects (everything except published) ─────────────
        active_projects = (
            VideoProject.objects
            .exclude(phase=VideoProject.Phase.PUBLISHED)
            .defer("script_body", "research_notes", "composition")
            .order_by("-updated_at")
        )

        # Annotate each project with its latest session info
        project_data = []
        for project in active_projects:
            latest_session = project.sessions.first()  # ordered by -started_at
            total_hours = (
                project.sessions
                .aggregate(total=Sum("duration_minutes"))["total"] or 0
            ) / 60
            project_data.append({
                "project": project,
                "latest_session": latest_session,
                "total_hours": round(total_hours, 1),
                "session_count": project.sessions.count(),
            })
        ctx["active_projects"] = project_data

        # ── Production calendar (30-day session heatmap) ──────────────
        thirty_days_ago = now - timedelta(days=30)
        daily_sessions = (
            VideoSession.objects
            .filter(started_at__gte=thirty_days_ago)
            .annotate(day=TruncDate("started_at"))
            .values("day")
            .annotate(
                count=Count("id"),
                minutes=Sum("duration_minutes"),
            )
            .order_by("day")
        )

        # Build a dict of date -> {count, minutes} for template lookup
        session_by_day = {}
        max_minutes = 1
        for row in daily_sessions:
            session_by_day[row["day"]] = {
                "count": row["count"],
                "minutes": row["minutes"] or 0,
            }
            if (row["minutes"] or 0) > max_minutes:
                max_minutes = row["minutes"] or 0

        # Build calendar grid (30 days, most recent last)
        calendar = []
        for i in range(30):
            day = (now - timedelta(days=29 - i)).date()
            info = session_by_day.get(day, {"count": 0, "minutes": 0})
            # Intensity 0..4 for CSS classes
            if info["minutes"] == 0:
                intensity = 0
            elif info["minutes"] <= 30:
                intensity = 1
            elif info["minutes"] <= 90:
                intensity = 2
            elif info["minutes"] <= 180:
                intensity = 3
            else:
                intensity = 4
            calendar.append({
                "date": day,
                "weekday": day.strftime("%a"),
                "day_num": day.day,
                "count": info["count"],
                "minutes": info["minutes"],
                "intensity": intensity,
            })
        ctx["calendar"] = calendar

        # ── Weekly summary (current week) ─────────────────────────────
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

        week_sessions = VideoSession.objects.filter(started_at__gte=week_start)
        week_stats = week_sessions.aggregate(
            count=Count("id"),
            total_minutes=Sum("duration_minutes"),
        )
        ctx["week_session_count"] = week_stats["count"] or 0
        ctx["week_total_hours"] = round((week_stats["total_minutes"] or 0) / 60, 1)

        # Phases completed this week (sessions where video phase advanced)
        week_phases = (
            week_sessions
            .values("phase")
            .annotate(count=Count("id"))
            .order_by("phase")
        )
        ctx["week_phases"] = list(week_phases)

        # Next actions across all active projects
        next_actions = []
        for pd in project_data:
            if pd["latest_session"] and pd["latest_session"].next_action:
                next_actions.append({
                    "project": pd["project"],
                    "action": pd["latest_session"].next_action,
                    "tool": pd["latest_session"].next_tool,
                })
        ctx["next_actions"] = next_actions

        # ── Cumulative output (published counts) ──────────────────────
        ctx["published_essays"] = Essay.objects.filter(draft=False).count()
        ctx["published_notes"] = FieldNote.objects.filter(draft=False).count()
        ctx["published_videos"] = VideoProject.objects.filter(
            phase=VideoProject.Phase.PUBLISHED
        ).count()

        ctx["content_type"] = "production"
        return ctx
