from django.urls import path

from apps.api import views
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

    # Full graph (for D3.js visual explorer)
    path('graph/', views.source_graph, name='source-graph'),

    # Activity data (for heatmap visualization)
    path('activity/', views.research_activity, name='research-activity'),

    # Aggregate stats
    path('stats/', views.research_stats, name='research-stats'),

    # Community contributions
    path('suggest/source/', suggest_source, name='suggest-source'),
    path('suggest/connection/', suggest_connection, name='suggest-connection'),
    path('suggestions/<slug:slug>/', approved_suggestions, name='approved-suggestions'),

    # Internal: source promotion from publishing_api Sourcebox
    path('internal/promote/', views.promote_source, name='promote-source'),
]
