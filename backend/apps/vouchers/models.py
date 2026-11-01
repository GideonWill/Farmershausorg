from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from apps.common.models import UUIDTimestampedModel


class Voucher(UUIDTimestampedModel):
    class DiscountType(models.TextChoices):
        FIXED = "fixed", "Fixed amount"
        PERCENT = "percent", "Percentage"

    code = models.CharField(max_length=80, unique=True)
    discount_type = models.CharField(max_length=12, choices=DiscountType.choices)
    fixed_amount_minor = models.PositiveBigIntegerField(default=0)
    percent_basis_points = models.PositiveSmallIntegerField(default=0)
    minimum_spend_minor = models.PositiveBigIntegerField(default=0)
    maximum_discount_minor = models.PositiveBigIntegerField(null=True, blank=True)
    total_usage_limit = models.PositiveIntegerField(null=True, blank=True)
    per_customer_usage_limit = models.PositiveIntegerField(null=True, blank=True)
    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.PROTECT,
        related_name="vouchers",
        null=True,
        blank=True,
    )
    branches = models.ManyToManyField(
        "branches.Branch",
        related_name="scoped_vouchers",
        blank=True,
    )
    products = models.ManyToManyField(
        "catalogue.Product",
        related_name="vouchers",
        blank=True,
    )
    basket_packages = models.ManyToManyField(
        "baskets.BasketPackage",
        related_name="vouchers",
        blank=True,
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("-starts_at", "code")
        constraints = [
            models.UniqueConstraint(Lower("code"), name="unique_voucher_code_ci"),
            models.CheckConstraint(
                condition=Q(ends_at__gt=models.F("starts_at")),
                name="voucher_end_after_start",
            ),
            models.CheckConstraint(
                condition=(
                    Q(discount_type="fixed", fixed_amount_minor__gt=0)
                    | Q(
                        discount_type="percent",
                        percent_basis_points__gt=0,
                        percent_basis_points__lte=10000,
                    )
                ),
                name="voucher_discount_matches_type",
            ),
        ]

    def __str__(self):
        return self.code

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)


class VoucherUsage(UUIDTimestampedModel):
    class Status(models.TextChoices):
        RESERVED = "reserved", "Reserved"
        REDEEMED = "redeemed", "Redeemed"
        RELEASED = "released", "Released"

    voucher = models.ForeignKey(Voucher, on_delete=models.PROTECT, related_name="usages")
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="voucher_usages",
        null=True,
        blank=True,
    )
    order = models.OneToOneField(
        "orders.CustomerOrder",
        on_delete=models.PROTECT,
        related_name="voucher_usage",
    )
    amount_saved_minor = models.PositiveBigIntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.RESERVED,
    )

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(
                condition=Q(amount_saved_minor__gt=0),
                name="voucher_usage_discount_positive",
            ),
        ]

    def clean(self):
        if self.order_id and self.user_id and self.order.user_id not in (None, self.user_id):
            raise ValidationError({"user": "The voucher usage customer must match the order customer."})

    def __str__(self):
        return f"{self.voucher.code} — {self.order.order_number}"
