from django.contrib import admin

from .models import Banner, ContentPage, FAQ, SiteSettings


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    fieldsets = (
        ("Storefront", {"fields": ("currency_code", "currency_symbol", "tagline")}),
        (
            "Contact",
            {
                "fields": (
                    "primary_phone",
                    "secondary_phone",
                    "whatsapp_numbers",
                    "email",
                    "social_links",
                )
            },
        ),
        ("Customer information", {"fields": ("announcement_bar_text", "delivery_policy_text")}),
    )

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ContentPage)
class ContentPageAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "is_published", "published_at")
    list_filter = ("is_published",)
    search_fields = ("title", "slug")
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ("title", "display_order", "is_active", "starts_at", "ends_at")
    list_filter = ("is_active",)


@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    list_display = ("question", "display_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("question", "answer")
