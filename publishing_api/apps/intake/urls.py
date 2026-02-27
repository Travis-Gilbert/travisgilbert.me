from django.urls import path

from apps.intake import views

app_name = "intake"

urlpatterns = [
    path("sourcebox/", views.SourceboxView.as_view(), name="sourcebox"),
    path("sourcebox/add/", views.SourceboxAddView.as_view(), name="sourcebox-add"),
    path("sourcebox/triage/<int:pk>/", views.SourceboxTriageView.as_view(), name="sourcebox-triage"),
]
