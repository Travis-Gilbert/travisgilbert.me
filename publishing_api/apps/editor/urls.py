from django.urls import path

from apps.editor import views

app_name = "editor"

urlpatterns = [
    # Dashboard
    path("", views.DashboardView.as_view(), name="dashboard"),

    # Auto-save (HTMX)
    path("auto-save/", views.AutoSaveView.as_view(), name="auto-save"),

    # -----------------------------------------------------------------------
    # Content types
    # -----------------------------------------------------------------------

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

    # Toolkit
    path("toolkit/", views.ToolkitListView.as_view(), name="toolkit-list"),
    path("toolkit/new/", views.ToolkitCreateView.as_view(), name="toolkit-create"),
    path("toolkit/<slug:slug>/", views.ToolkitEditView.as_view(), name="toolkit-edit"),
    path("toolkit/<slug:slug>/publish/", views.ToolkitPublishView.as_view(), name="toolkit-publish"),

    # Production Dashboard
    path("production/", views.ProductionDashboardView.as_view(), name="production-dashboard"),

    # Video Projects
    path("video/", views.VideoListView.as_view(), name="video-list"),
    path("video/new/", views.VideoCreateView.as_view(), name="video-create"),
    path("video/<slug:slug>/", views.VideoEditView.as_view(), name="video-edit"),
    path("video/<slug:slug>/publish/", views.VideoPublishView.as_view(), name="video-publish"),
    path("video/<slug:slug>/set-phase/", views.VideoSetPhaseView.as_view(), name="video-set-phase"),

    # Video HTMX inline endpoints (scenes, deliverables, sessions)
    path("video/<slug:slug>/scenes/add/", views.VideoSceneAddView.as_view(), name="video-scene-add"),
    path("video/<slug:slug>/scenes/<int:pk>/update/", views.VideoSceneUpdateView.as_view(), name="video-scene-update"),
    path("video/<slug:slug>/scenes/<int:pk>/delete/", views.VideoSceneDeleteView.as_view(), name="video-scene-delete"),
    path("video/<slug:slug>/scenes/<int:pk>/toggle/", views.VideoSceneToggleView.as_view(), name="video-scene-toggle"),
    path("video/<slug:slug>/deliverables/add/", views.VideoDeliverableAddView.as_view(), name="video-deliverable-add"),
    path("video/<slug:slug>/deliverables/<int:pk>/update/", views.VideoDeliverableUpdateView.as_view(), name="video-deliverable-update"),
    path("video/<slug:slug>/deliverables/<int:pk>/delete/", views.VideoDeliverableDeleteView.as_view(), name="video-deliverable-delete"),
    path("video/<slug:slug>/sessions/start/", views.VideoSessionStartView.as_view(), name="video-session-start"),
    path("video/<slug:slug>/sessions/<int:pk>/stop/", views.VideoSessionStopView.as_view(), name="video-session-stop"),

    # Video research integration (HTMX, login-protected)
    path("video/<slug:slug>/pull-research/", views.VideoPullResearchView.as_view(), name="video-pull-research"),
    path("video/<slug:slug>/generate-description/", views.VideoGenerateDescriptionView.as_view(), name="video-generate-description"),

    # -----------------------------------------------------------------------
    # Video API (JSON, for Orchestra Conductor + frontend)
    # -----------------------------------------------------------------------
    path("api/videos/", views.VideoAPIListView.as_view(), name="api-video-list"),
    path("api/videos/<slug:slug>/", views.VideoAPIDetailView.as_view(), name="api-video-detail"),
    path("api/videos/<slug:slug>/sessions/", views.VideoAPISessionsView.as_view(), name="api-video-sessions"),
    path("api/videos/<slug:slug>/log-session/", views.VideoAPILogSessionView.as_view(), name="api-video-log-session"),
    path("api/videos/<slug:slug>/advance/", views.VideoAPIAdvanceView.as_view(), name="api-video-advance"),
    path("api/videos/<slug:slug>/deliverable/", views.VideoAPIDeliverableView.as_view(), name="api-video-deliverable"),
    path("api/videos/<slug:slug>/next-action/", views.VideoAPINextActionView.as_view(), name="api-video-next-action"),

    # Now page
    path("now/", views.NowPageEditView.as_view(), name="now-edit"),
    path("now/publish/", views.NowPagePublishView.as_view(), name="now-publish"),

    # -----------------------------------------------------------------------
    # Generic content actions
    # -----------------------------------------------------------------------
    path(
        "delete/<slug:content_type>/<slug:slug>/",
        views.DeleteContentView.as_view(),
        name="delete-content",
    ),
    path(
        "set-stage/<slug:content_type>/<slug:slug>/",
        views.SetStageView.as_view(),
        name="set-stage",
    ),

    # -----------------------------------------------------------------------
    # Collage image upload
    # -----------------------------------------------------------------------
    path(
        "upload/collage/",
        views.UploadCollageImageView.as_view(),
        name="upload-collage",
    ),

    # -----------------------------------------------------------------------
    # Compose (page compositions)
    # -----------------------------------------------------------------------
    path("compose/", views.PageCompositionListView.as_view(), name="compose-list"),
    path("compose/new/", views.PageCompositionCreateView.as_view(), name="compose-create"),
    path("compose/<slug:page_key>/", views.PageCompositionEditView.as_view(), name="compose-edit"),

    # -----------------------------------------------------------------------
    # Settings
    # -----------------------------------------------------------------------
    path("settings/tokens/", views.DesignTokensEditView.as_view(), name="tokens-edit"),
    path("settings/nav/", views.NavEditorView.as_view(), name="nav-editor"),
    path("settings/site/", views.SiteSettingsEditView.as_view(), name="site-settings"),
    path("settings/publish-log/", views.PublishLogListView.as_view(), name="publish-log"),
    path("settings/publish-config/", views.PublishSiteConfigView.as_view(), name="publish-config"),
]
