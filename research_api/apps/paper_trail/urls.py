from django.urls import path

from . import views

app_name = 'paper_trail'

urlpatterns = [
    path('', views.explorer, name='explorer'),
    path('essay/<slug:slug>/', views.essay_trail, name='essay-trail'),
    path('threads/', views.threads, name='threads'),
    path('threads/<slug:slug>/', views.thread_detail, name='thread-detail'),
    path('community/', views.community, name='community'),
    path('suggest/', views.suggest_source, name='suggest'),
]
