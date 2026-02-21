from django.urls import path

from apps.editor import views

app_name = "editor"

urlpatterns = [
    # Dashboard
    path("", views.DashboardView.as_view(), name="dashboard"),

    # Auto-save (HTMX)
    path("auto-save/", views.AutoSaveView.as_view(), name="auto-save"),

    # Essays
    path("essays/", views.EssayListView.as_view(), name="essay-list"),
    path("essays/new/", views.EssayCreateView.as_view(), name="essay-create"),
    path("essays/<slug:slug>/", views.EssayEditView.as_view(), name="essay-edit"),
    path("essays/<slug:slug>/publish/", views.EssayPublishView.as_view(), name="essay-publish"),

    # Field Notes
    path("field-notes/", views.FieldNoteListView.as_view(), name="field-note-list"),
    path("field-notes/new/", views.FieldNoteCreateView.as_view(), name="field-note-create"),
    path("field-notes/<slug:slug>/", views.FieldNoteEditView.as_view(), name="field-note-edit"),
    path("field-notes/<slug:slug>/publish/", views.FieldNotePublishView.as_view(), name="field-note-publish"),

    # Shelf
    path("shelf/", views.ShelfListView.as_view(), name="shelf-list"),
    path("shelf/new/", views.ShelfCreateView.as_view(), name="shelf-create"),
    path("shelf/<slug:slug>/", views.ShelfEditView.as_view(), name="shelf-edit"),
    path("shelf/<slug:slug>/publish/", views.ShelfPublishView.as_view(), name="shelf-publish"),

    # Projects
    path("projects/", views.ProjectListView.as_view(), name="project-list"),
    path("projects/new/", views.ProjectCreateView.as_view(), name="project-create"),
    path("projects/<slug:slug>/", views.ProjectEditView.as_view(), name="project-edit"),
    path("projects/<slug:slug>/publish/", views.ProjectPublishView.as_view(), name="project-publish"),

    # Now page
    path("now/", views.NowPageEditView.as_view(), name="now-edit"),
    path("now/publish/", views.NowPagePublishView.as_view(), name="now-publish"),
]
