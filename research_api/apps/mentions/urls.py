from django.urls import path

from . import views

app_name = 'mentions'

urlpatterns = [
    path('webmention/', views.receive_webmention, name='receive-webmention'),
    path('ingest/', views.receive_webhook, name='receive-webhook'),
    path('trigger-send/', views.trigger_outbound_webmentions, name='trigger-send'),
]
