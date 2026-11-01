from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q

from apps.common.models import UUIDTimestampedModel


class ProductBranch(UUIDTimestampedModel):
    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.PROTECT,
        related_name="product_inventory",
    )
    product = models.ForeignKey(
        "catalogue.Product",
        on_delete=models.PROTECT,
        related_name="branch_inventory",
    )
    stock_on_hand = models.PositiveIntegerField(default=0)
    reserved_quantity = models.PositiveIntegerField(default=0)
    is_available = models.BooleanField(default=True)
    price_override_minor = models.PositiveBigIntegerField(null=True, blank=True)

    class Meta:
        ordering = ("branch__name", "product__name")
        constraints = [
            models.UniqueConstraint(fields=("branch", "product"), name="unique_product_inventory_per_branch"),
            models.CheckConstraint(
                condition=Q(reserved_quantity__lte=F("stock_on_hand")),
                name="reserved_stock_does_not_exceed_stock",
            ),
            models.CheckConstraint(
                condition=Q(stock_on_hand__gte=0) & Q(reserved_quantity__gte=0),
                name="inventory_quantities_nonnegative",
            ),
        ]

    @property
    def available_quantity(self):
        return self.stock_on_hand - self.reserved_quantity

    @property
    def effective_price_minor(self):
        return self.price_override_minor if self.price_override_minor is not None else self.product.base_price_minor

    def __str__(self):
        return f"{self.product} — {self.branch}"


class StockReservation(UUIDTimestampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        RELEASED = "released", "Released"
        CONSUMED = "consumed", "Consumed"
        EXPIRED = "expired", "Expired"

    order = models.ForeignKey(
        "orders.CustomerOrder",
        on_delete=models.PROTECT,
        related_name="stock_reservations",
    )
    order_line = models.ForeignKey(
        "orders.OrderLine",
        on_delete=models.PROTECT,
        related_name="stock_reservations",
    )
    product_branch = models.ForeignKey(
        ProductBranch,
        on_delete=models.PROTECT,
        related_name="reservations",
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    expires_at = models.DateTimeField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    released_at = models.DateTimeField(null=True, blank=True)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("expires_at",)
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gt=0), name="stock_reservation_quantity_positive"),
            models.UniqueConstraint(
                fields=("order_line", "product_branch"),
                name="unique_reserved_product_per_order_line",
            ),
        ]

    def clean(self):
        errors = {}
        if self.product_branch_id and self.order_id:
            if self.product_branch.branch_id != self.order.branch_id:
                errors["product_branch"] = "Reserved inventory must belong to the order branch."
        if self.order_line_id and self.order_id and self.order_line.order_id != self.order_id:
            errors["order_line"] = "The reserved line must belong to the order."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.quantity} × {self.product_branch} ({self.get_status_display()})"


class InventoryAdjustment(UUIDTimestampedModel):
    product_branch = models.ForeignKey(
        ProductBranch,
        on_delete=models.PROTECT,
        related_name="adjustments",
    )
    actor = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="inventory_adjustments",
    )
    idempotency_key = models.CharField(max_length=100, unique=True)
    quantity_delta = models.IntegerField()
    reason = models.TextField()
    stock_before = models.PositiveIntegerField()
    stock_after = models.PositiveIntegerField()

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(
                condition=~Q(quantity_delta=0),
                name="inventory_adjustment_delta_nonzero",
            ),
            models.CheckConstraint(
                condition=Q(stock_after=F("stock_before") + F("quantity_delta")),
                name="inventory_adjustment_stock_matches_delta",
            ),
        ]

    def clean(self):
        if self.quantity_delta == 0:
            raise ValidationError({"quantity_delta": "An adjustment must change stock."})
        if self.stock_after != self.stock_before + self.quantity_delta:
            raise ValidationError({"stock_after": "The resulting stock must match the adjustment."})

    def __str__(self):
        return f"{self.product_branch} {self.quantity_delta:+d} ({self.idempotency_key})"
