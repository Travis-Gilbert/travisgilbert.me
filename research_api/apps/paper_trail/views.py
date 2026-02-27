"""
Public browsing pages for the Paper Trail.

These views render server-side templates using the same research models
as the REST API. No HTTP round-trips: we query the ORM directly.
"""

import json

from django.db.models import Count, Prefetch
from django.http import Http404, HttpResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

from apps.mentions.models import Mention
from apps.research.models import (
    ResearchThread,
    Source,
    SourceLink,
    SourceSuggestion,
    ThreadEntry,
)
from apps.research.services import detect_content_type, get_backlinks


def explorer(request):
    """
    Full-page D3 graph explorer.

    Builds the same nodes + edges structure as the /api/v1/graph/ endpoint,
    then passes it as JSON to the template for client-side D3 rendering.
    Orphaned sources (promoted but not yet linked) appear as isolated nodes.
    """
    links = (
        SourceLink.objects
        .select_related('source')
        .filter(source__public=True)
    )

    source_nodes = {}
    content_nodes = {}
    edges = []

    for lnk in links:
        src = lnk.source
        source_key = f'source:{src.slug}'
        content_key = f'{lnk.content_type}:{lnk.content_slug}'

        if source_key not in source_nodes:
            source_nodes[source_key] = {
                'id': source_key,
                'type': 'source',
                'label': src.title,
                'slug': src.slug,
                'sourceType': src.source_type,
                'creator': src.creator or '',
            }

        if content_key not in content_nodes:
            content_nodes[content_key] = {
                'id': content_key,
                'type': lnk.content_type,
                'label': lnk.content_title or lnk.content_slug,
                'slug': lnk.content_slug,
            }

        edges.append({
            'source': source_key,
            'target': content_key,
            'role': lnk.role,
        })

    # Include orphaned public sources (promoted but not yet linked)
    orphaned = (
        Source.objects.public()
        .exclude(slug__in=[
            key.removeprefix('source:') for key in source_nodes
        ])
    )
    for src in orphaned:
        source_key = f'source:{src.slug}'
        source_nodes[source_key] = {
            'id': source_key,
            'type': 'source',
            'label': src.title,
            'slug': src.slug,
            'sourceType': src.source_type,
            'creator': src.creator or '',
        }

    nodes = list(source_nodes.values()) + list(content_nodes.values())
    graph_data = json.dumps({'nodes': nodes, 'edges': edges})

    # Collect unique source types for the filter legend
    source_types = sorted({n['sourceType'] for n in source_nodes.values()})

    return render(request, 'paper_trail/explorer.html', {
        'graph_data': graph_data,
        'source_types': source_types,
        'node_count': len(nodes),
        'edge_count': len(edges),
        'page_title': 'Paper Trail',
        'nav_section': 'explorer',
    })


def essay_trail(request, slug):
    """
    Per-essay research trail: sources, backlinks, thread, mentions.

    Same aggregation as the /api/v1/trail/<slug>/ BFF endpoint, but
    rendered as a server-side template.
    """
    content_type = detect_content_type(slug)

    # Sources linked to this content
    links = (
        SourceLink.objects
        .filter(
            content_type=content_type,
            content_slug=slug,
            source__public=True,
        )
        .select_related('source')
        .order_by('role', 'source__title')
    )

    if not links.exists():
        raise Http404(f'No research trail found for "{slug}"')

    # Group sources by role for template rendering
    sources_by_role = {}
    for lnk in links:
        role_display = lnk.get_role_display()
        sources_by_role.setdefault(role_display, []).append(lnk)

    # Backlinks
    backlinks = get_backlinks(content_type, slug)

    # Thread
    thread = (
        ResearchThread.objects.public()
        .filter(resulting_essay_slug=slug)
        .prefetch_related(
            Prefetch(
                'entries',
                queryset=ThreadEntry.objects.select_related('source').order_by('order', '-date'),
            )
        )
        .first()
    )

    # Mentions
    mentions = (
        Mention.objects.public()
        .filter(target_slug=slug)
        .select_related('mention_source')
        .order_by('-created_at')[:20]
    )

    # Approved suggestions
    suggestions = (
        SourceSuggestion.objects
        .filter(
            target_slug=slug,
            status='approved',
        )
        .order_by('-reviewed_at')
    )

    # Content title from the first link's content_title
    content_title = links.first().content_title or slug.replace('-', ' ').title()

    return render(request, 'paper_trail/essay_trail.html', {
        'slug': slug,
        'content_type': content_type,
        'content_title': content_title,
        'sources_by_role': sources_by_role,
        'source_count': links.count(),
        'backlinks': backlinks,
        'thread': thread,
        'mentions': mentions,
        'suggestions': suggestions,
        'page_title': f'Trail: {content_title}',
        'nav_section': 'explorer',
    })


def threads(request):
    """All public research threads."""
    status_filter = request.GET.get('status', '')

    qs = (
        ResearchThread.objects.public()
        .annotate(entry_count=Count('entries'))
        .order_by('-started_date')
    )

    if status_filter:
        qs = qs.filter(status=status_filter)

    return render(request, 'paper_trail/threads.html', {
        'threads': qs,
        'active_filter': status_filter,
        'page_title': 'Research Threads',
        'nav_section': 'threads',
    })


def thread_detail(request, slug):
    """Single research thread with timeline of entries."""
    thread = (
        ResearchThread.objects.public()
        .annotate(entry_count=Count('entries'))
        .prefetch_related(
            Prefetch(
                'entries',
                queryset=ThreadEntry.objects.select_related('source').order_by('order', '-date'),
            )
        )
        .filter(slug=slug)
        .first()
    )

    if not thread:
        raise Http404(f'Thread "{slug}" not found')

    return render(request, 'paper_trail/thread_detail.html', {
        'thread': thread,
        'page_title': thread.title,
        'nav_section': 'threads',
    })


def community(request):
    """
    Community contributions wall.

    Shows approved source suggestions and provides HTMX-powered forms
    for submitting new suggestions.
    """
    approved = (
        SourceSuggestion.objects
        .filter(status='approved')
        .order_by('-reviewed_at')[:30]
    )

    return render(request, 'paper_trail/wall.html', {
        'suggestions': approved,
        'page_title': 'Community',
        'nav_section': 'community',
    })


@require_POST
def suggest_source(request):
    """
    HTMX POST handler for community source suggestions.

    Creates a SourceSuggestion record and returns a success/error partial.
    No reCAPTCHA in this server-rendered form (unlike the API endpoint)
    because the form has CSRF protection. Could add reCAPTCHA later.
    """
    title = request.POST.get('title', '').strip()
    url = request.POST.get('url', '').strip()
    target_slug = request.POST.get('target_slug', '').strip()
    relevance_note = request.POST.get('relevance_note', '').strip()
    contributor_name = request.POST.get('contributor_name', '').strip()

    if not title or not target_slug or not contributor_name:
        return HttpResponse(
            '<div id="suggest-result" class="mt-3 px-3 py-2 rounded-brand border border-error/30 '
            'bg-error/5 font-mono text-[11px] text-error">'
            'Please fill in the title, essay slug, and your name.'
            '</div>'
        )

    SourceSuggestion.objects.create(
        title=title,
        url=url,
        target_slug=target_slug,
        relevance_note=relevance_note,
        contributor_name=contributor_name,
    )

    return HttpResponse(
        '<div id="suggest-result" class="mt-3 px-3 py-2 rounded-brand border border-success/30 '
        'bg-success/5 font-mono text-[11px] text-success">'
        'Thanks for the suggestion! It will appear here once reviewed.'
        '</div>'
    )
