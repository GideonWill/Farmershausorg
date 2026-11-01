from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from apps.common.models import UUIDTimestampedModel


class Cart(UUIDTimestampedModel):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CONVERTED = "converted", "Converted"
        EXPIRED = "expired", "Expired"
        ABANDONED = "abandoned", "Abandoned"

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="carts",
        null=True,
        blank=True,
    )
    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.PROTECT,
        related_name="carts",
    )
    guest_session_key = models.CharField(max_length=128, null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(
                condition=Q(user__isnull=False) | Q(guest_session_key__gt=""),
                name="cart_has_user_or_guest_session",
            ),
            models.UniqueConstraint(
                fields=("user", "branch"),
                condition=Q(user__isnull=False, status="open"),
                name="one_open_cart_per_user_branch",
            ),
            models.UniqueConstraint(
                fields=("guest_session_key", "branch"),
                condition=Q(user__isnull=True, status="open", guest_session_key__isnull=False),
                name="one_open_guest_cart_per_branch",
            ),
        ]

    def __str__(self):
        return f"Cart {self.pk} — {self.branch}"


class CartItem(UUIDTimestampedModel):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        "catalogue.Product",
        on_delete=models.PROTECT,
        related_name="cart_items",
        null=True,
        blank=True,
    )
    basket_package = models.ForeignKey(
        "baskets.BasketPackage",
        on_delete=models.PROTECT,
        related_name="cart_items",
        null=True,
        blank=True,
    )
    quantity = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(999)]
    )
    gift_recipient_name = models.CharField(max_length=120, blank=True)
    gift_message = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(product__isnull=False, basket_package__isnull=True)
                    | Q(product__isnull=True, basket_package__isnull=False)
                ),
                name="cart_item_has_exactly_one_sellable",
            ),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="cart_item_quantity_positive"),
            models.CheckConstraint(condition=Q(quantity__lte=999), name="cart_item_quantity_at_most_999"),
            models.UniqueConstraint(
                fields=("cart", "product"),
                condition=Q(product__isnull=False),
                name="unique_product_per_cart",
            ),
            models.UniqueConstraint(
                fields=("cart", "basket_package"),
                condition=Q(basket_package__isnull=False),
                name="unique_basket_package_per_cart",
            ),
        ]

    def __str__(self):
        return f"Cart item {self.pk} × {self.quantity}"
