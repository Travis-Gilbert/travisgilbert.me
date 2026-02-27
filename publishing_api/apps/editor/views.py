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

from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect
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
        ctx["now_page"] = NowPage.objects.first()
        ctx["recent_publishes"] = PublishLog.objects.all()[:10]
        ctx["draft_counts"] = {
            "essays": Essay.objects.filter(draft=True).count(),
            "field_notes": FieldNote.objects.filter(draft=True).count(),
            "projects": Project.objects.filter(draft=True).count(),
        }
        ctx["has_drafts"] = (
            ctx["draft_counts"]["essays"]
            or ctx["draft_counts"]["field_notes"]
            or ctx["draft_counts"]["projects"]
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
