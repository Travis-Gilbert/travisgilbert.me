from django.urls import path

from apps.comments import views

app_name = 'comments'

urlpatterns = [
    path('', views.comments_list_create, name='list-create'),
    path('<uuid:comment_id>/flag/', views.flag_comment, name='flag'),
]
