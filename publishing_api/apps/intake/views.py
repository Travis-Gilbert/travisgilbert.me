"""
Sourcebox views: URL intake, OG scraping, and triage.

All views are login-protected. The main Sourcebox page shows a URL input
bar and a grid of pending sources. Triage actions (accept/reject/defer)
swap card content via HTMX.
"""

from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.response import TemplateResponse
from django.utils import timezone
from django.views import View
from django.views.generic import ListView

from apps.intake.forms import SourceboxAddForm, TriageForm
from apps.intake.models import RawSource
from apps.intake.services import scrape_og_metadata


class SourceboxView(LoginRequiredMixin, ListView):
    """Main Sourcebox page: URL input + pending sources grid."""

    model = RawSource
    template_name = "intake/sourcebox.html"
    context_object_name = "sources"
    paginate_by = 24

    def get_queryset(self):
        qs = RawSource.objects.all()
        decision = self.request.GET.get("filter", "pending")
        if decision in ("pending", "accepted", "rejected", "deferred"):
            qs = qs.filter(decision=decision)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["add_form"] = SourceboxAddForm()
        ctx["active_filter"] = self.request.GET.get("filter", "pending")
        ctx["nav_section"] = "sourcebox"

        counts = {
            "pending": RawSource.objects.filter(decision="pending").count(),
            "accepted": RawSource.objects.filter(decision="accepted").count(),
            "rejected": RawSource.objects.filter(decision="rejected").count(),
            "deferred": RawSource.objects.filter(decision="deferred").count(),
        }
        ctx["counts"] = counts

        # Filter tabs with counts baked in for template simplicity
        ctx["filter_tabs"] = [
            ("pending", f"Pending ({counts['pending']})"),
            ("accepted", f"Accepted ({counts['accepted']})"),
            ("rejected", f"Rejected ({counts['rejected']})"),
            ("deferred", f"Deferred ({counts['deferred']})"),
        ]
        return ctx


class SourceboxAddView(LoginRequiredMixin, View):
    """POST: add a URL to the Sourcebox, scrape OG metadata, return card partial."""

    def post(self, request):
        form = SourceboxAddForm(request.POST)
        if not form.is_valid():
            return HttpResponse(
                '<div class="text-error text-sm px-3 py-2">Invalid URL</div>',
                status=422,
            )

        url = form.cleaned_data["url"]

        # Check for duplicate
        existing = RawSource.objects.filter(url=url).first()
        if existing:
            return TemplateResponse(
                request,
                "intake/partials/source_card.html",
                {"source": existing, "duplicate": True},
            )

        # Create and scrape
        source = RawSource.objects.create(url=url)
        og = scrape_og_metadata(url)
        source.og_title = og["title"][:500]
        source.og_description = og["description"]
        source.og_image = og["image"][:2000]
        source.og_site_name = og["site_name"][:300]
        source.save()

        return TemplateResponse(
            request,
            "intake/partials/source_card.html",
            {"source": source},
        )


class SourceboxTriageView(LoginRequiredMixin, View):
    """POST: accept/reject/defer a RawSource. Returns updated card via HTMX."""

    def post(self, request, pk):
        source = get_object_or_404(RawSource, pk=pk)
        form = TriageForm(request.POST)

        if not form.is_valid():
            return HttpResponse("Invalid form", status=422)

        source.decision = form.cleaned_data["decision"]
        source.decision_note = form.cleaned_data.get("decision_note", "")
        source.decided_at = timezone.now()
        source.save()

        return TemplateResponse(
            request,
            "intake/partials/decision_result.html",
            {"source": source},
        )
