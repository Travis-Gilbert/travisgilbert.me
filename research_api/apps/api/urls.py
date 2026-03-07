from django.urls import path

from apps.api import cluster_views, connection_views, views
from apps.research.views import (
    approved_suggestions,
    suggest_connection,
    suggest_source,
)

app_name = 'api'

urlpatterns = [
    # Primary endpoint: full research context for a content slug
    path('trail/<slug:slug>/', views.research_trail, name='research-trail'),

    # Sources
    path('sources/', views.SourceListView.as_view(), name='source-list'),
    path('sources/<slug:slug>/', views.SourceDetailView.as_view(), name='source-detail'),

    # Research threads
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

    # ── Connection engine ───────────────────────────────────────────
    # Content-to-content connections (multi-signal: sources, tags, threads, semantic)
    path('connections/<slug:slug>/', connection_views.content_connections, name='connections'),
    # Full content-to-content graph (D3-ready, distinct from source graph)
    path('connections/graph/', connection_views.connection_graph, name='connection-graph'),

    # ── Semantic similarity ─────────────────────────────────────────
    # Similar content (pure embedding-based, no structural signals)
    path('similar/<slug:slug>/', connection_views.similar_content, name='similar-content'),
    # Similar sources
    path('similar/sources/', connection_views.similar_sources, name='similar-sources'),

    # ── Cluster detection ───────────────────────────────────────────
    # Automatic thematic clusters via agglomerative clustering
    path('clusters/', cluster_views.content_clusters, name='clusters'),

    # Community contributions
    path('suggest/source/', suggest_source, name='suggest-source'),
    path('suggest/connection/', suggest_connection, name='suggest-connection'),
    path('suggestions/<slug:slug>/', approved_suggestions, name='approved-suggestions'),

    # Internal: source promotion from publishing_api Sourcebox
    path('internal/promote/', views.promote_source, name='promote-source'),
]
