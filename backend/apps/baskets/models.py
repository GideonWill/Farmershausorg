from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

from apps.common.models import UUIDTimestampedModel


class BasketCategory(UUIDTimestampedModel):
    slug = models.SlugField(max_length=100, unique=True)
    name = models.CharField(max_length=120)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("display_order", "name")
        verbose_name_plural = "basket categories"

    def __str__(self):
        return self.name


class BasketPackage(UUIDTimestampedModel):
    sku = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    name = models.CharField(max_length=180)
    category = models.ForeignKey(
        BasketCategory,
        on_delete=models.PROTECT,
        related_name="packages",
        null=True,
        blank=True,
    )
    description = models.TextField(blank=True)
    base_price_minor = models.PositiveBigIntegerField(validators=[MinValueValidator(0)])
    image_url = models.URLField(max_length=500, blank=True)
    is_placeholder = models.BooleanField(default=False)
    gift_message_allowed = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return f"{self.name} ({self.sku})"


class BasketComponent(UUIDTimestampedModel):
    basket_package = models.ForeignKey(
        BasketPackage,
        on_delete=models.CASCADE,
        related_name="components",
    )
    product = models.ForeignKey(
        "catalogue.Product",
        on_delete=models.PROTECT,
        related_name="basket_components",
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    is_optional = models.BooleanField(default=False)

    class Meta:
        ordering = ("basket_package__name", "product__name")
        constraints = [
            models.UniqueConstraint(
                fields=("basket_package", "product"),
                name="unique_product_per_basket_package",
            ),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="basket_component_quantity_positive"),
        ]

    def __str__(self):
        return f"{self.quantity} × {self.product} in {self.basket_package}"
