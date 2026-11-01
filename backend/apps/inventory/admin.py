from django.contrib import admin

from .models import InventoryAdjustment, ProductBranch, StockReservation


@admin.register(ProductBranch)
class ProductBranchAdmin(admin.ModelAdmin):
    list_display = ("product", "branch", "stock_on_hand", "reserved_quantity", "is_available")
    list_filter = ("branch", "is_available")
    search_fields = ("product__name", "product__sku", "branch__name")


@admin.register(StockReservation)
class StockReservationAdmin(admin.ModelAdmin):
    list_display = ("order", "product_branch", "quantity", "status", "expires_at")
    list_filter = ("status", "product_branch__branch")
    readonly_fields = ("created_at", "updated_at")


@admin.register(InventoryAdjustment)
class InventoryAdjustmentAdmin(admin.ModelAdmin):
    list_display = ("product_branch", "quantity_delta", "stock_before", "stock_after", "actor", "created_at")
    list_filter = ("product_branch__branch", "created_at")
    search_fields = ("product_branch__product__name", "idempotency_key", "reason")
    readonly_fields = tuple(field.name for field in InventoryAdjustment._meta.fields)
    can_delete = False

    def has_add_permission(self, request):
        return False
