from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from apps.common.models import UUIDTimestampedModel


class User(UUIDTimestampedModel, AbstractUser):
    phone = models.CharField(max_length=16, unique=True, null=True, blank=True)
    display_name = models.CharField(max_length=120, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("email"),
                condition=~Q(email=""),
                name="unique_nonempty_user_email_ci",
            ),
        ]

    def __str__(self):
        return self.display_name or self.get_username()


class BranchMembership(UUIDTimestampedModel):
    class Role(models.TextChoices):
        STAFF = "staff", "Branch staff"
        MANAGER = "manager", "Branch manager"

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="branch_memberships",
    )
    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.PROTECT,
        related_name="memberships",
    )
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.STAFF)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("user", "branch"), name="unique_branch_membership"),
        ]
        ordering = ("branch__name", "user__username")

    def __str__(self):
        return f"{self.user} — {self.branch} ({self.get_role_display()})"


class OTPChallenge(UUIDTimestampedModel):
    identifier = models.CharField(max_length=254, db_index=True)
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("identifier", "expires_at"), name="otp_identifier_expiry_idx"),
        ]

    def __str__(self):
        return f"OTP challenge for {self.identifier}"
