import re
from datetime import time
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.common.models import UUIDTimestampedModel


class Branch(UUIDTimestampedModel):
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    address = models.CharField(max_length=255)
    phone = models.CharField(max_length=16, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    opening_hours = models.JSONField(default=dict, blank=True)
    hours_are_placeholder = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(latitude__isnull=True, longitude__isnull=True)
                    | Q(latitude__isnull=False, longitude__isnull=False)
                ),
                name="branch_coordinates_both_present_or_absent",
            ),
            models.CheckConstraint(
                condition=(
                    Q(latitude__isnull=True)
                    | (Q(latitude__gte=-90) & Q(latitude__lte=90))
                ),
                name="branch_latitude_in_range",
            ),
            models.CheckConstraint(
                condition=(
                    Q(longitude__isnull=True)
                    | (Q(longitude__gte=-180) & Q(longitude__lte=180))
                ),
                name="branch_longitude_in_range",
            ),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        errors = {}
        if (self.latitude is None) != (self.longitude is None):
            errors["latitude"] = "Latitude and longitude must be provided together."
        if not isinstance(self.opening_hours, dict):
            errors["opening_hours"] = "Opening hours must be a weekday-to-hours object."
        else:
            for day, hours in self.opening_hours.items():
                if day not in {
                    "monday", "tuesday", "wednesday", "thursday",
                    "friday", "saturday", "sunday",
                }:
                    errors["opening_hours"] = f"Unknown weekday: {day}."
                    break
                if hours is None:
                    continue
                if not isinstance(hours, dict) or set(hours) != {"open", "close"}:
                    errors["opening_hours"] = f"{day} must contain open and close times."
                    break
                if any(
                    not isinstance(hours[key], str)
                    or not re.fullmatch(r"\d{2}:\d{2}", hours[key])
                    for key in ("open", "close")
                ):
                    errors["opening_hours"] = f"{day} hours must use HH:MM times."
                    break
                try:
                    opening = time.fromisoformat(hours["open"])
                    closing = time.fromisoformat(hours["close"])
                except (TypeError, ValueError):
                    errors["opening_hours"] = f"{day} hours must use HH:MM times."
                    break
                if opening == closing:
                    errors["opening_hours"] = f"{day} opening and closing times cannot be equal."
                    break
        if errors:
            raise ValidationError(errors)

    def is_open(self, at=None):
        local_now = timezone.localtime(at or timezone.now(), ZoneInfo(settings.TIME_ZONE))
        today_key = local_now.strftime("%A").lower()
        today_hours = self.opening_hours.get(today_key)
        if not today_hours:
            return False

        current_time = local_now.time().replace(tzinfo=None)
        opens_at = time.fromisoformat(today_hours["open"])
        closes_at = time.fromisoformat(today_hours["close"])
        if opens_at < closes_at:
            return opens_at <= current_time < closes_at
        if opens_at > closes_at:
            return current_time >= opens_at or current_time < closes_at
        return False


class DeliveryZone(UUIDTimestampedModel):
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="delivery_zones")
    name = models.CharField(max_length=120)
    area_description = models.TextField(blank=True)
    postcodes = models.JSONField(default=list, blank=True)
    delivery_fee_minor = models.PositiveBigIntegerField(default=0)
    minimum_order_minor = models.PositiveBigIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("branch__name", "name")
        constraints = [
            models.UniqueConstraint(fields=("branch", "name"), name="unique_delivery_zone_name_per_branch"),
            models.CheckConstraint(
                condition=Q(delivery_fee_minor__gte=0) & Q(minimum_order_minor__gte=0),
                name="delivery_zone_amounts_nonnegative",
            ),
        ]

    def __str__(self):
        return f"{self.name} — {self.branch}"


class BranchPaymentAccount(UUIDTimestampedModel):
    class Provider(models.TextChoices):
        HUBTEL = "hubtel", "Hubtel"
        PAYSTACK = "paystack", "Paystack"
        MTN_MOMO = "mtn_momo", "MTN MoMo"

    class SettlementMode(models.TextChoices):
        DIRECT = "direct", "Direct settlement"
        SPLIT = "split", "Provider split settlement"

    branch = models.OneToOneField(
        Branch,
        on_delete=models.PROTECT,
        related_name="payment_account",
    )
    provider = models.CharField(max_length=24, choices=Provider.choices)
    provider_account_id = models.CharField(max_length=120)
    momo_business_line = models.CharField(max_length=16)
    supported_networks = models.JSONField(default=list)
    settlement_mode = models.CharField(
        max_length=16,
        choices=SettlementMode.choices,
        default=SettlementMode.DIRECT,
    )
    credentials_secret_ref = models.CharField(
        max_length=255,
        help_text="Reference to provider credentials in the deployment secret manager; do not enter credentials.",
    )
    is_enabled = models.BooleanField(default=False)
    settlement_verified = models.BooleanField(
        default=False,
        help_text="Enable only after the provider confirms this branch's intended settlement destination.",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("provider", "provider_account_id"),
                name="unique_provider_account_id",
            ),
            models.CheckConstraint(
                condition=~Q(provider_account_id="") & ~Q(credentials_secret_ref=""),
                name="payment_account_has_provider_and_secret_ref",
            ),
        ]

    def __str__(self):
        return f"{self.branch} — {self.get_provider_display()}"
