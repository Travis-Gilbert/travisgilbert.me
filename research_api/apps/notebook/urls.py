from django.urls import path

from . import views

app_name = 'notebook'

urlpatterns = [
    # Node types (read-only)
    path('types/', views.NodeTypeListView.as_view(), name='type-list'),

    # KnowledgeNode CRUD
    path('nodes/', views.KnowledgeNodeListView.as_view(), name='node-list'),
    path('nodes/create/', views.KnowledgeNodeCreateView.as_view(), name='node-create'),
    path('nodes/<slug:slug>/', views.KnowledgeNodeDetailView.as_view(), name='node-detail'),
    path('nodes/<slug:slug>/update/', views.KnowledgeNodeUpdateView.as_view(), name='node-update'),

    # QuickCapture
    path('capture/', views.quick_capture, name='quick-capture'),

    # Edges
    path('edges/', views.EdgeListView.as_view(), name='edge-list'),

    # Resurface (serendipity)
    path('resurface/', views.resurface, name='resurface'),

    # Calendar (DailyLog)
    path('calendar/', views.notebook_calendar, name='calendar'),

    # Stats
    path('stats/', views.notebook_stats, name='stats'),

    # Graph (D3)
    path('graph/', views.notebook_graph, name='graph'),

    # Notebooks
    path('notebooks/', views.NotebookListView.as_view(), name='notebook-list'),
    path('notebooks/<slug:slug>/', views.NotebookDetailView.as_view(), name='notebook-detail'),
]
