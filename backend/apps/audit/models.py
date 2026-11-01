from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import UUIDModel


class AuditEvent(UUIDModel):
    actor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="audit_events",
        null=True,
        blank=True,
    )
    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.SET_NULL,
        related_name="audit_events",
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=100)
    resource_type = models.CharField(max_length=100)
    resource_id = models.CharField(max_length=100, blank=True)
    request_id = models.CharField(max_length=100, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)
    before_data = models.JSONField(default=dict, blank=True)
    after_data = models.JSONField(default=dict, blank=True)
    source_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ("-occurred_at",)
        indexes = [
            models.Index(fields=("resource_type", "resource_id"), name="audit_resource_idx"),
            models.Index(fields=("branch", "-occurred_at"), name="audit_branch_time_idx"),
        ]

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValidationError("Audit events are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Audit events cannot be deleted.")

    def __str__(self):
        return f"{self.action} {self.resource_type} {self.resource_id}".strip()
