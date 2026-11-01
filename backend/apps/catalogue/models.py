from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import UUIDTimestampedModel


class Category(UUIDTimestampedModel):
    slug = models.SlugField(max_length=100, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("display_order", "name")
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class ProductTag(UUIDTimestampedModel):
    slug = models.SlugField(max_length=60, unique=True)
    name = models.CharField(max_length=80)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name


class Product(UUIDTimestampedModel):
    class UnitType(models.TextChoices):
        WEIGHT = "weight", "Weight"
        PIECE = "piece", "Piece"
        BUNCH = "bunch", "Bunch"
        PACK = "pack", "Pack"
        VOLUME = "volume", "Volume"
        CRATE = "crate", "Crate"
        TRAY = "tray", "Tray"

    sku = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    unit = models.CharField(max_length=40)
    unit_type = models.CharField(max_length=16, choices=UnitType.choices, default=UnitType.PIECE)
    base_price_minor = models.PositiveBigIntegerField(validators=[MinValueValidator(0)])
    image_url = models.URLField(max_length=500, blank=True)
    gallery_image_urls = models.JSONField(default=list, blank=True)
    nutrition = models.JSONField(default=dict, blank=True)
    origin = models.CharField(max_length=120, blank=True)
    tags = models.ManyToManyField(ProductTag, related_name="products", blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return f"{self.name} ({self.sku})"
