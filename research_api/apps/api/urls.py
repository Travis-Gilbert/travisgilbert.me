from django.urls import path

from apps.api import (
    cluster_views,
    connection_views,
    export_views,
    graph_views,
    health_views,
    key_views,
    search_views,
    session_views,
    temporal_views,
    tension_views,
    views,
    webhook_views,
)
from apps.research.views import (
    approved_suggestions,
    suggest_connection,
    suggest_source,
)

app_name = 'api'

urlpatterns = [
    # ── API key management ──────────────────────────────────────────
    path('keys/register/', key_views.register_api_key, name='register-key'),
    path('usage/', key_views.usage_analytics, name='usage'),

    # Primary endpoint: full research context for a content slug
    path('trail/<slug:slug>/', views.research_trail, name='research-trail'),

    # Sources (literal paths must come before slug catch-all)
    path('sources/health/', health_views.source_health, name='source-health'),
    path('sources/ranked/', graph_views.sources_ranked, name='sources-ranked'),
    path('sources/', views.SourceListView.as_view(), name='source-list'),
    path('sources/<slug:slug>/', views.SourceDetailView.as_view(), name='source-detail'),

    # Research threads (velocity must come before slug catch-all)
    path('threads/velocity/', temporal_views.thread_velocity, name='thread-velocity'),
    path('threads/', views.ThreadListView.as_view(), name='thread-list'),
    path('threads/<slug:slug>/', views.ThreadDetailView.as_view(), name='thread-detail'),

    # Mentions
    path('mentions/<slug:slug>/', views.mentions_for_content, name='mentions'),

    # Backlinks
    path('backlinks/<slug:slug>/', views.backlinks_for_content, name='backlinks'),

    # Full graph (for D3.js visual explorer) - source-to-content relationships
    path('graph/', views.source_graph, name='source-graph'),

    # Activity data (for heatmap visualization)
    path('activity/', views.research_activity, name='research-activity'),

    # Aggregate stats
    path('stats/', views.research_stats, name='research-stats'),

    # ── Full-text search ─────────────────────────────────────────────
    path('search/', search_views.search, name='search'),

    # ── Graph algorithms ──────────────────────────────────────────
    path('path/', graph_views.find_path_view, name='find-path'),
    path('reading-order/', graph_views.reading_order, name='reading-order'),

    # ── Export and Import ─────────────────────────────────────────
    path('export/', export_views.export_sources, name='export'),
    path('import/', export_views.import_sources, name='import'),

    # ── Temporal analysis ─────────────────────────────────────────
    path('trends/', temporal_views.trends, name='trends'),

    # ── Tension detection ──────────────────────────────────────────
    path('tensions/', tension_views.tensions, name='tensions'),

    # ── Connection engine ───────────────────────────────────────────
    path('connections/<slug:slug>/', connection_views.content_connections, name='connections'),
    path('connections/graph/', connection_views.connection_graph, name='connection-graph'),

    # ── Semantic similarity ─────────────────────────────────────────
    path('similar/<slug:slug>/', connection_views.similar_content, name='similar-content'),
    path('similar/sources/', connection_views.similar_sources, name='similar-sources'),

    # ── Research sessions ───────────────────────────────────────────
    path('sessions/', session_views.session_list, name='session-list'),
    path('sessions/<slug:slug>/', session_views.session_detail, name='session-detail'),

    # ── Cluster detection ───────────────────────────────────────────
    path('clusters/', cluster_views.content_clusters, name='clusters'),

    # ── Webhooks ────────────────────────────────────────────────────
    path('webhooks/', webhook_views.webhook_list, name='webhook-list'),
    path('webhooks/test/', webhook_views.webhook_test, name='webhook-test'),
    path('webhooks/<int:pk>/', webhook_views.webhook_detail, name='webhook-detail'),
    path('webhooks/<int:pk>/deliveries/', webhook_views.webhook_deliveries, name='webhook-deliveries'),

    # Community contributions
    path('suggest/source/', suggest_source, name='suggest-source'),
    path('suggest/connection/', suggest_connection, name='suggest-connection'),
    path('suggestions/<slug:slug>/', approved_suggestions, name='approved-suggestions'),

    # Internal: source promotion from publishing_api Sourcebox
    path('internal/promote/', views.promote_source, name='promote-source'),
]
