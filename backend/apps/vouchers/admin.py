from django.contrib import admin

from .models import Voucher, VoucherUsage


@admin.register(Voucher)
class VoucherAdmin(admin.ModelAdmin):
    list_display = ("code", "discount_type", "branch", "starts_at", "ends_at", "is_active")
    list_filter = ("discount_type", "branch", "is_active", "starts_at", "ends_at")
    search_fields = ("code",)


@admin.register(VoucherUsage)
class VoucherUsageAdmin(admin.ModelAdmin):
    list_display = ("voucher", "user", "order", "amount_saved_minor", "created_at")
    search_fields = ("voucher__code", "order__order_number", "user__username")
    readonly_fields = tuple(field.name for field in VoucherUsage._meta.fields)
    can_delete = False
