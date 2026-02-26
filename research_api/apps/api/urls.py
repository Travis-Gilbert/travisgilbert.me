from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'api'

router = DefaultRouter()
router.register('sources', views.SourceViewSet, basename='source')
router.register('references', views.ContentReferenceViewSet, basename='reference')
router.register('threads', views.ResearchThreadViewSet, basename='thread')
router.register('mentions', views.WebmentionViewSet, basename='mention')

urlpatterns = [
    path('', include(router.urls)),
    path('backlinks/', views.backlinks_view, name='backlinks'),
]
