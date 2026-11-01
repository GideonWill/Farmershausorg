from django.db import models

from apps.common.models import UUIDTimestampedModel


class Notification(UUIDTimestampedModel):
    class Channel(models.TextChoices):
        IN_APP = "in_app", "In app"
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"
        WHATSAPP = "whatsapp", "WhatsApp"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"
        READ = "read", "Read"

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    order = models.ForeignKey(
        "orders.CustomerOrder",
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    channel = models.CharField(max_length=12, choices=Channel.choices, default=Channel.IN_APP)
    template_key = models.CharField(max_length=100)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    redacted_metadata = models.JSONField(default=dict, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("user", "order", "channel", "template_key"),
                condition=models.Q(order__isnull=False),
                name="unique_order_notification_channel_template",
            ),
        ]
        indexes = [
            models.Index(fields=("user", "status", "-created_at"), name="notification_user_status_idx"),
        ]

    def __str__(self):
        return f"{self.template_key} — {self.user}"


class DeliveryAttempt(UUIDTimestampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="delivery_attempts",
    )
    provider_reference = models.CharField(max_length=160, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    retry_count = models.PositiveSmallIntegerField(default=0)
    next_retry_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("provider_reference",),
                condition=~models.Q(provider_reference=""),
                name="unique_nonempty_notification_provider_ref",
            ),
        ]

    def __str__(self):
        return f"{self.notification} — {self.get_status_display()}"
