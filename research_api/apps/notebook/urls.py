"""
URL routing for the CommonPlace knowledge graph API.

Router-based ViewSets at /api/v1/notebook/.
Custom endpoints for capture, timeline feed, graph, resurface, and export
are added alongside the router URLs.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'notebook'

router = DefaultRouter()
router.register('types', views.ObjectTypeViewSet, basename='objecttype')
router.register('component-types', views.ComponentTypeViewSet, basename='componenttype')
router.register('objects', views.ObjectViewSet, basename='object')
router.register('components', views.ComponentViewSet, basename='component')
router.register('nodes', views.NodeViewSet, basename='node')
router.register('edges', views.EdgeViewSet, basename='edge')
router.register('notebooks', views.NotebookViewSet, basename='notebook')
router.register('projects', views.ProjectViewSet, basename='project')
router.register('timelines', views.TimelineViewSet, basename='timeline')
router.register('layouts', views.LayoutViewSet, basename='layout')
router.register('daily-logs', views.DailyLogViewSet, basename='dailylog')

urlpatterns = [
    # Router-generated ViewSet URLs
    path('', include(router.urls)),

    # Custom endpoints (Tasks 17-22)
    path('capture/', views.quick_capture_view, name='quick-capture'),
    path('feed/', views.timeline_feed_view, name='timeline-feed'),
    path('graph/', views.graph_data_view, name='graph-data'),
    path('resurface/', views.resurface_view, name='resurface'),
    path('export/object/<slug:slug>/', views.export_object_view, name='export-object'),
    path('export/notebook/<slug:slug>/', views.export_notebook_view, name='export-notebook'),
]
