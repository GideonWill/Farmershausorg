from django.urls import path

from apps.notifications.views import NotificationCollectionView, NotificationReadView


urlpatterns = [
    path("notifications/", NotificationCollectionView.as_view(), name="notifications"),
    path("notifications/<uuid:notification_id>/read/", NotificationReadView.as_view(), name="notification-read"),
]
