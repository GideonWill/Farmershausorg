from django.db import models

from apps.common.models import UUIDTimestampedModel


class ReportExport(UUIDTimestampedModel):
    class Format(models.TextChoices):
        CSV = "csv", "CSV"
        XLSX = "xlsx", "Excel"

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"
        EXPIRED = "expired", "Expired"

    requester = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="report_exports",
    )
    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.PROTECT,
        related_name="report_exports",
        null=True,
        blank=True,
    )
    report_type = models.CharField(max_length=80)
    filters = models.JSONField(default=dict, blank=True)
    file_format = models.CharField(max_length=8, choices=Format.choices, default=Format.CSV)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.QUEUED)
    private_file_key = models.CharField(max_length=500, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    error_summary = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.report_type} — {self.requester}"
