from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.branches.models import BranchPaymentAccount
from apps.common.models import UUIDTimestampedModel


class Payment(UUIDTimestampedModel):
    class Method(models.TextChoices):
        MOBILE_MONEY = "mobile_money", "Mobile Money"
        CARD = "card", "Card"

    class Status(models.TextChoices):
        CREATED = "created", "Created"
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"
        EXPIRED = "expired", "Expired"
        REFUND_PENDING = "refund_pending", "Refund pending"
        PARTIALLY_REFUNDED = "partially_refunded", "Partially refunded"
        REFUNDED = "refunded", "Refunded"

    order = models.OneToOneField(
        "orders.CustomerOrder",
        on_delete=models.PROTECT,
        related_name="payment",
    )
    branch_payment_account = models.ForeignKey(
        "branches.BranchPaymentAccount",
        on_delete=models.PROTECT,
        related_name="payments",
    )
    provider = models.CharField(max_length=24, choices=BranchPaymentAccount.Provider.choices)
    amount_minor = models.PositiveBigIntegerField(validators=[MinValueValidator(1)])
    currency = models.CharField(max_length=3, default="GHS")
    method = models.CharField(
        max_length=16,
        choices=Method.choices,
        default=Method.MOBILE_MONEY,
    )
    network = models.CharField(max_length=32, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.CREATED)
    merchant_idempotency_reference = models.CharField(max_length=100, unique=True)
    provider_reference = models.CharField(max_length=160, blank=True)
    succeeded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(condition=Q(amount_minor__gt=0), name="payment_amount_positive"),
        ]

    def clean(self):
        errors = {}
        if self.order_id and self.branch_payment_account_id:
            if self.order.branch_id != self.branch_payment_account.branch_id:
                errors["branch_payment_account"] = "The payment account must belong to the order branch."
            if self.provider != self.branch_payment_account.provider:
                errors["provider"] = "The payment provider must match the branch payment account."
            if self.amount_minor != self.order.total_amount_minor:
                errors["amount_minor"] = "The payment amount must match the order total."
            if self.currency != self.order.currency:
                errors["currency"] = "The payment currency must match the order currency."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.order.order_number} — {self.get_status_display()}"


class PaymentAttempt(UUIDTimestampedModel):
    class Status(models.TextChoices):
        CREATED = "created", "Created"
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="attempts")
    idempotency_key = models.CharField(max_length=100, unique=True)
    checkout_reference = models.CharField(max_length=160, blank=True)
    provider_reference = models.CharField(max_length=160, blank=True)
    checkout_url = models.URLField(max_length=1000, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.CREATED)
    request_metadata = models.JSONField(default=dict, blank=True)
    response_metadata = models.JSONField(default=dict, blank=True)
    result_code = models.CharField(max_length=80, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("provider_reference",),
                condition=~Q(provider_reference=""),
                name="unique_nonempty_provider_attempt_reference",
            ),
        ]

    def __str__(self):
        return f"{self.payment} — {self.idempotency_key}"


class PaymentWebhookEvent(UUIDTimestampedModel):
    provider = models.CharField(max_length=24, choices=BranchPaymentAccount.Provider.choices)
    provider_event_id = models.CharField(max_length=160)
    signature_verified = models.BooleanField(default=False)
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    redacted_payload = models.JSONField(default=dict, blank=True)
    processing_error = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ("-received_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("provider", "provider_event_id"),
                name="unique_payment_webhook_event_per_provider",
            ),
        ]

    def __str__(self):
        return f"{self.provider}:{self.provider_event_id}"


class Refund(UUIDTimestampedModel):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="refunds")
    idempotency_key = models.CharField(max_length=100, unique=True)
    provider_reference = models.CharField(max_length=160, blank=True)
    amount_minor = models.PositiveBigIntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.REQUESTED)
    reason = models.TextField()
    last_error = models.TextField(blank=True)
    requested_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="requested_refunds",
    )
    approved_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="approved_refunds",
        null=True,
        blank=True,
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(condition=Q(amount_minor__gt=0), name="refund_amount_positive"),
            models.UniqueConstraint(
                fields=("provider_reference",),
                condition=~Q(provider_reference=""),
                name="unique_nonempty_provider_refund_reference",
            ),
        ]

    def __str__(self):
        return f"Refund {self.amount_minor} for {self.payment}"
