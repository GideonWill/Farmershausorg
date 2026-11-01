import uuid

from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q

from apps.common.models import UUIDTimestampedModel


def new_order_number():
    return f"FH-{uuid.uuid4().hex[:12].upper()}"


class CustomerAddress(UUIDTimestampedModel):
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="addresses",
    )
    recipient_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=16)
    address_line_1 = models.CharField(max_length=255)
    address_line_2 = models.CharField(max_length=255, blank=True)
    area = models.CharField(max_length=120)
    directions = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ("-is_default", "-created_at")
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(latitude__isnull=True, longitude__isnull=True)
                    | Q(latitude__isnull=False, longitude__isnull=False)
                ),
                name="address_coordinates_both_present_or_absent",
            ),
        ]

    def __str__(self):
        return f"{self.recipient_name} — {self.area}"


class CustomerOrder(UUIDTimestampedModel):
    class FulfillmentMethod(models.TextChoices):
        DELIVERY = "delivery", "Delivery"
        PICKUP = "pickup", "Pickup"

    class Status(models.TextChoices):
        AWAITING_PAYMENT = "awaiting_payment", "Awaiting payment"
        CONFIRMED = "confirmed", "Confirmed"
        PICKING = "picking", "Picking"
        READY_FOR_DISPATCH = "ready_for_dispatch", "Ready for dispatch"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for delivery"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"
        EXPIRED = "expired", "Expired"

    order_number = models.CharField(max_length=20, unique=True, default=new_order_number, editable=False)
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="orders",
        null=True,
        blank=True,
    )
    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.PROTECT,
        related_name="orders",
    )
    delivery_zone = models.ForeignKey(
        "branches.DeliveryZone",
        on_delete=models.PROTECT,
        related_name="orders",
        null=True,
        blank=True,
    )
    fulfillment_method = models.CharField(
        max_length=12,
        choices=FulfillmentMethod.choices,
        default=FulfillmentMethod.DELIVERY,
    )
    fulfillment_slot = models.ForeignKey(
        "orders.FulfillmentSlot",
        on_delete=models.PROTECT,
        related_name="orders",
        null=True,
        blank=True,
    )
    cart = models.OneToOneField(
        "cart.Cart",
        on_delete=models.SET_NULL,
        related_name="order",
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.AWAITING_PAYMENT,
    )
    currency = models.CharField(max_length=3, default="GHS")
    subtotal_minor = models.PositiveBigIntegerField()
    delivery_fee_minor = models.PositiveBigIntegerField(default=0)
    discount_minor = models.PositiveBigIntegerField(default=0)
    total_amount_minor = models.PositiveBigIntegerField()
    address_snapshot = models.JSONField(default=dict)
    branch_snapshot = models.JSONField(default=dict)
    delivery_snapshot = models.JSONField(default=dict)
    voucher_code_snapshot = models.CharField(max_length=80, blank=True)
    customer_note = models.TextField(blank=True)
    rider_name = models.CharField(max_length=120, blank=True)
    rider_phone = models.CharField(max_length=16, blank=True)
    refund_difference_minor = models.PositiveBigIntegerField(default=0)
    refund_review_required = models.BooleanField(default=False)
    stock_adjustment_note = models.TextField(blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    staff_confirmed_at = models.DateTimeField(null=True, blank=True)
    picking_at = models.DateTimeField(null=True, blank=True)
    ready_for_dispatch_at = models.DateTimeField(null=True, blank=True)
    out_for_delivery_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    expired_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(
                condition=Q(discount_minor__lte=F("subtotal_minor") + F("delivery_fee_minor")),
                name="order_discount_does_not_exceed_gross",
            ),
            models.CheckConstraint(
                condition=Q(
                    total_amount_minor=F("subtotal_minor") + F("delivery_fee_minor") - F("discount_minor")
                ),
                name="order_total_matches_components",
            ),
        ]

    def clean(self):
        errors = {}
        if self.branch_id and self.delivery_zone_id:
            if self.delivery_zone.branch_id != self.branch_id:
                errors["delivery_zone"] = "The delivery zone must belong to the order branch."
        if self.fulfillment_method == self.FulfillmentMethod.DELIVERY and not self.delivery_zone_id:
            errors["delivery_zone"] = "Delivery orders require a delivery zone."
        if self.fulfillment_method == self.FulfillmentMethod.PICKUP and self.delivery_zone_id:
            errors["delivery_zone"] = "Pickup orders cannot have a delivery zone."
        if self.fulfillment_slot_id and self.fulfillment_slot.branch_id != self.branch_id:
            errors["fulfillment_slot"] = "The time slot must belong to the order branch."
        if self.fulfillment_slot_id and self.fulfillment_slot.method != self.fulfillment_method:
            errors["fulfillment_slot"] = "The time slot must match the fulfillment method."
        if self.cart_id and self.branch_id and self.cart.branch_id != self.branch_id:
            errors["cart"] = "The cart must belong to the order branch."
        if self.cart_id and self.user_id and self.cart.user_id not in (None, self.user_id):
            errors["cart"] = "The cart must belong to the order customer."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return self.order_number


class FulfillmentSlot(UUIDTimestampedModel):
    class Method(models.TextChoices):
        DELIVERY = "delivery", "Delivery"
        PICKUP = "pickup", "Pickup"

    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.PROTECT,
        related_name="fulfillment_slots",
    )
    method = models.CharField(max_length=12, choices=Method.choices)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    capacity = models.PositiveSmallIntegerField(default=10)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("starts_at",)
        constraints = [
            models.CheckConstraint(
                condition=Q(ends_at__gt=models.F("starts_at")),
                name="fulfillment_slot_end_after_start",
            ),
            models.CheckConstraint(
                condition=Q(capacity__gt=0),
                name="fulfillment_slot_capacity_positive",
            ),
            models.UniqueConstraint(
                fields=("branch", "method", "starts_at", "ends_at"),
                name="unique_branch_fulfillment_slot",
            ),
        ]

    def __str__(self):
        return f"{self.branch} — {self.method} — {self.starts_at:%Y-%m-%d %H:%M}"


class OrderStatusHistory(UUIDTimestampedModel):
    order = models.ForeignKey(
        CustomerOrder,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    from_status = models.CharField(max_length=24, blank=True)
    to_status = models.CharField(max_length=24, choices=CustomerOrder.Status.choices)
    actor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="order_status_changes",
        null=True,
        blank=True,
    )
    note = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.order.order_number}: {self.from_status} → {self.to_status}"


class OrderLine(UUIDTimestampedModel):
    order = models.ForeignKey(CustomerOrder, on_delete=models.CASCADE, related_name="lines")
    product = models.ForeignKey(
        "catalogue.Product",
        on_delete=models.SET_NULL,
        related_name="order_lines",
        null=True,
        blank=True,
    )
    basket_package = models.ForeignKey(
        "baskets.BasketPackage",
        on_delete=models.SET_NULL,
        related_name="order_lines",
        null=True,
        blank=True,
    )
    sku_snapshot = models.CharField(max_length=80)
    name_snapshot = models.CharField(max_length=180)
    unit_snapshot = models.CharField(max_length=40, blank=True)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price_minor = models.PositiveBigIntegerField()
    line_total_minor = models.PositiveBigIntegerField()
    gift_recipient_name = models.CharField(max_length=120, blank=True)
    gift_message = models.CharField(max_length=500, blank=True)
    is_removed = models.BooleanField(default=False)

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(product__isnull=False, basket_package__isnull=True)
                    | Q(product__isnull=True, basket_package__isnull=False)
                ),
                name="order_line_has_exactly_one_sellable",
            ),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="order_line_quantity_positive"),
            models.CheckConstraint(
                condition=Q(line_total_minor=F("quantity") * F("unit_price_minor")),
                name="order_line_total_matches_quantity",
            ),
        ]

    def __str__(self):
        return f"{self.name_snapshot} × {self.quantity}"


class OrderLineComponent(UUIDTimestampedModel):
    order_line = models.ForeignKey(OrderLine, on_delete=models.CASCADE, related_name="components")
    product = models.ForeignKey(
        "catalogue.Product",
        on_delete=models.SET_NULL,
        related_name="order_line_components",
        null=True,
        blank=True,
    )
    name_snapshot = models.CharField(max_length=180)
    unit_snapshot = models.CharField(max_length=40, blank=True)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gt=0), name="order_component_quantity_positive"),
        ]

    def __str__(self):
        return f"{self.quantity} × {self.name_snapshot}"
