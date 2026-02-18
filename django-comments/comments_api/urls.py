from django.urls import path
from .views import CommentListCreateView, CommentFlagView

urlpatterns = [
    path("comments/", CommentListCreateView.as_view(), name="comment-list-create"),
    path("comments/<uuid:pk>/flag/", CommentFlagView.as_view(), name="comment-flag"),
]
