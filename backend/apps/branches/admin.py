from django.contrib import admin

from .models import Branch, BranchPaymentAccount, DeliveryZone


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "address", "latitude", "longitude", "hours_are_placeholder", "is_active")
    list_filter = ("is_active",)
    list_editable = ("hours_are_placeholder",)
    search_fields = ("name", "address", "slug")
    prepopulated_fields = {"slug": ("name",)}
    fieldsets = (
        (None, {"fields": ("name", "slug", "address", "phone", "is_active")}),
        ("Location pin", {"fields": ("latitude", "longitude")}),
        ("Opening hours", {"fields": ("opening_hours", "hours_are_placeholder")}),
    )


@admin.register(DeliveryZone)
class DeliveryZoneAdmin(admin.ModelAdmin):
    list_display = ("name", "branch", "delivery_fee_minor", "minimum_order_minor", "is_active")
    list_filter = ("branch", "is_active")
    search_fields = ("name", "branch__name")


@admin.register(BranchPaymentAccount)
class BranchPaymentAccountAdmin(admin.ModelAdmin):
    list_display = (
        "branch",
        "provider",
        "provider_account_id",
        "is_enabled",
        "settlement_verified",
    )
    list_filter = ("provider", "is_enabled", "settlement_verified")
    readonly_fields = ("credentials_secret_ref",)
