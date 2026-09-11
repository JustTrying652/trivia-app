from django.urls import path

from . import views

urlpatterns = [
    path("rooms/create/", views.create_room, name="create_room"),
    path("rooms/<str:room_code>/", views.room_status, name="room_status"),
]