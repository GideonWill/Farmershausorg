from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id",
            "order",
            "channel",
            "template_key",
            "status",
            "redacted_metadata",
            "created_at",
            "sent_at",
            "read_at",
        )
        read_only_fields = fields


class NotificationReadResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=Notification.Status.choices)
