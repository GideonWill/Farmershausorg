from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.common.models import UUIDTimestampedModel


def default_whatsapp_numbers():
    return ["+233 55 420 8446", "+233 55 048 8906"]


class SiteSettings(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    currency_code = models.CharField(max_length=3, default="GHS")
    currency_symbol = models.CharField(max_length=8, default="GH₵")
    tagline = models.CharField(max_length=180, default="Everyday Fruits and Veggies — a healthy happy life")
    primary_phone = models.CharField(max_length=16, default="+233 55 420 8446")
    secondary_phone = models.CharField(max_length=16, default="+233 55 048 8906")
    whatsapp_numbers = models.JSONField(default=default_whatsapp_numbers)
    email = models.EmailField(default="info@farmershausgh.com")
    social_links = models.JSONField(default=dict, blank=True)
    announcement_bar_text = models.CharField(max_length=240, blank=True)
    delivery_policy_text = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(id=1), name="site_settings_singleton"),
        ]

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Site settings cannot be deleted.")

    def __str__(self):
        return "FarmersHaus site settings"


class ContentPage(UUIDTimestampedModel):
    slug = models.SlugField(max_length=120, unique=True)
    title = models.CharField(max_length=180)
    body = models.TextField()
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("title",)

    def __str__(self):
        return self.title


class Banner(UUIDTimestampedModel):
    title = models.CharField(max_length=160)
    image_url = models.URLField(max_length=500, blank=True)
    target_url = models.URLField(max_length=500, blank=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("display_order", "created_at")
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(starts_at__isnull=True)
                    | Q(ends_at__isnull=True)
                    | Q(ends_at__gt=models.F("starts_at"))
                ),
                name="banner_end_after_start_when_scheduled",
            ),
        ]

    def __str__(self):
        return self.title


class FAQ(UUIDTimestampedModel):
    question = models.CharField(max_length=300)
    answer = models.TextField()
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("display_order", "question")
        verbose_name = "FAQ"
        verbose_name_plural = "FAQs"

    def __str__(self):
        return self.question
