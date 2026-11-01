from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.notifications.models import Notification
from apps.notifications.serializers import (
    NotificationReadResponseSerializer,
    NotificationSerializer,
)


class NotificationCollectionView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=NotificationSerializer(many=True))
    def get(self, request):
        notifications = Notification.objects.filter(user=request.user)
        return Response(NotificationSerializer(notifications, many=True).data)


class NotificationReadView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses=NotificationReadResponseSerializer)
    def post(self, request, notification_id):
        notification = get_object_or_404(
            Notification,
            pk=notification_id,
            user=request.user,
        )
        if notification.status != Notification.Status.READ:
            notification.status = Notification.Status.READ
            notification.read_at = timezone.now()
            notification.save(update_fields=("status", "read_at", "updated_at"))
        return Response({"id": notification.pk, "status": notification.status})
