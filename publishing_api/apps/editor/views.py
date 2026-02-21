"""
Editor views: the writing interface.

All views require login (enforced via LoginRequiredMixin). The URL structure:

  /                         Dashboard (list all content)
  /essays/new/              Create essay
  /essays/<slug>/           Edit essay
  /essays/<slug>/publish/   Publish essay (POST only)
  /field-notes/new/         Create field note
  /field-notes/<slug>/      Edit field note
  ... (same pattern for shelf, projects, now)
"""

import json

from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.views import View
from django.views.generic import CreateView, ListView, TemplateView, UpdateView

from apps.content.models import (
    Essay,
    FieldNote,
    NowPage,
    Project,
    PublishLog,
    ShelfEntry,
)
from apps.editor.forms import (
    EssayForm,
    FieldNoteForm,
    NowPageForm,
    ProjectForm,
    ShelfEntryForm,
)
from apps.publisher.publish import (
    publish_essay,
    publish_field_note,
    publish_now_page,
    publish_project,
    publish_shelf_entry,
)


# ──────────────────────────────────────────────
# Dashboard
# ──────────────────────────────────────────────


class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = "editor/dashboard.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["essays"] = Essay.objects.all()[:20]
        ctx["field_notes"] = FieldNote.objects.all()[:20]
        ctx["shelf_entries"] = ShelfEntry.objects.all()[:20]
        ctx["projects"] = Project.objects.all()[:20]
        ctx["now_page"] = NowPage.objects.first()
        ctx["recent_publishes"] = PublishLog.objects.all()[:10]
        return ctx


# ──────────────────────────────────────────────
# Essay CRUD
# ──────────────────────────────────────────────


class EssayListView(LoginRequiredMixin, ListView):
    model = Essay
    template_name = "editor/content_list.html"
    context_object_name = "items"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "essay"
        ctx["content_type_plural"] = "Essays"
        ctx["new_url"] = reverse("editor:essay-create")
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
        log = publish_essay(essay)
        if request.headers.get("HX-Request"):
            return JsonResponse({
                "success": log.success,
                "commit_sha": log.commit_sha,
                "commit_url": log.commit_url,
                "error": log.error_message,
            })
        return redirect(reverse("editor:essay-edit", kwargs={"slug": slug}))


# ──────────────────────────────────────────────
# Field Note CRUD
# ──────────────────────────────────────────────


class FieldNoteListView(LoginRequiredMixin, ListView):
    model = FieldNote
    template_name = "editor/content_list.html"
    context_object_name = "items"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "field_note"
        ctx["content_type_plural"] = "Field Notes"
        ctx["new_url"] = reverse("editor:field-note-create")
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
        ctx["recent_publishes"] = PublishLog.objects.filter(
            content_type="field_note", content_slug=self.object.slug
        )[:5]
        return ctx

    def get_success_url(self):
        return reverse("editor:field-note-edit", kwargs={"slug": self.object.slug})


class FieldNotePublishView(LoginRequiredMixin, View):
    def post(self, request, slug):
        note = get_object_or_404(FieldNote, slug=slug)
        log = publish_field_note(note)
        if request.headers.get("HX-Request"):
            return JsonResponse({
                "success": log.success,
                "commit_sha": log.commit_sha,
                "commit_url": log.commit_url,
                "error": log.error_message,
            })
        return redirect(reverse("editor:field-note-edit", kwargs={"slug": slug}))


# ──────────────────────────────────────────────
# Shelf CRUD
# ──────────────────────────────────────────────


class ShelfListView(LoginRequiredMixin, ListView):
    model = ShelfEntry
    template_name = "editor/content_list.html"
    context_object_name = "items"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "shelf"
        ctx["content_type_plural"] = "Shelf"
        ctx["new_url"] = reverse("editor:shelf-create")
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
        ctx["recent_publishes"] = PublishLog.objects.filter(
            content_type="shelf", content_slug=self.object.slug
        )[:5]
        return ctx

    def get_success_url(self):
        return reverse("editor:shelf-edit", kwargs={"slug": self.object.slug})


class ShelfPublishView(LoginRequiredMixin, View):
    def post(self, request, slug):
        entry = get_object_or_404(ShelfEntry, slug=slug)
        log = publish_shelf_entry(entry)
        if request.headers.get("HX-Request"):
            return JsonResponse({
                "success": log.success,
                "commit_sha": log.commit_sha,
                "commit_url": log.commit_url,
                "error": log.error_message,
            })
        return redirect(reverse("editor:shelf-edit", kwargs={"slug": slug}))


# ──────────────────────────────────────────────
# Project CRUD
# ──────────────────────────────────────────────


class ProjectListView(LoginRequiredMixin, ListView):
    model = Project
    template_name = "editor/content_list.html"
    context_object_name = "items"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["content_type"] = "project"
        ctx["content_type_plural"] = "Projects"
        ctx["new_url"] = reverse("editor:project-create")
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
        ctx["recent_publishes"] = PublishLog.objects.filter(
            content_type="project", content_slug=self.object.slug
        )[:5]
        return ctx

    def get_success_url(self):
        return reverse("editor:project-edit", kwargs={"slug": self.object.slug})


class ProjectPublishView(LoginRequiredMixin, View):
    def post(self, request, slug):
        project = get_object_or_404(Project, slug=slug)
        log = publish_project(project)
        if request.headers.get("HX-Request"):
            return JsonResponse({
                "success": log.success,
                "commit_sha": log.commit_sha,
                "commit_url": log.commit_url,
                "error": log.error_message,
            })
        return redirect(reverse("editor:project-edit", kwargs={"slug": slug}))


# ──────────────────────────────────────────────
# Now Page
# ──────────────────────────────────────────────


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
        log = publish_now_page(now)
        if request.headers.get("HX-Request"):
            return JsonResponse({
                "success": log.success,
                "commit_sha": log.commit_sha,
                "commit_url": log.commit_url,
                "error": log.error_message,
            })
        return redirect(reverse("editor:now-edit"))


# ──────────────────────────────────────────────
# Auto-save (HTMX endpoint)
# ──────────────────────────────────────────────


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
