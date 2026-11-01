from django.contrib import admin

from .models import (
    CustomerAddress,
    CustomerOrder,
    FulfillmentSlot,
    OrderLine,
    OrderLineComponent,
    OrderStatusHistory,
)


class OrderLineComponentInline(admin.TabularInline):
    model = OrderLineComponent
    extra = 0
    readonly_fields = ("product", "name_snapshot", "unit_snapshot", "quantity")
    can_delete = False


class OrderLineInline(admin.TabularInline):
    model = OrderLine
    extra = 0
    readonly_fields = (
        "product",
        "basket_package",
        "sku_snapshot",
        "name_snapshot",
        "unit_snapshot",
        "quantity",
        "unit_price_minor",
        "line_total_minor",
    )
    can_delete = False
    show_change_link = True


@admin.register(CustomerAddress)
class CustomerAddressAdmin(admin.ModelAdmin):
    list_display = ("recipient_name", "user", "phone", "area", "is_default")
    list_filter = ("area", "is_default")
    search_fields = ("recipient_name", "phone", "area", "user__username")


@admin.register(CustomerOrder)
class CustomerOrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "branch", "user", "status", "total_amount_minor", "created_at")
    list_filter = ("status", "branch", "created_at")
    search_fields = ("order_number", "user__username", "user__phone")
    readonly_fields = tuple(field.name for field in CustomerOrder._meta.fields)
    inlines = (OrderLineInline,)
    can_delete = False


@admin.register(OrderLine)
class OrderLineAdmin(admin.ModelAdmin):
    list_display = ("name_snapshot", "order", "quantity", "line_total_minor")
    search_fields = ("name_snapshot", "sku_snapshot", "order__order_number")
    readonly_fields = tuple(field.name for field in OrderLine._meta.fields)
    inlines = (OrderLineComponentInline,)
    can_delete = False


@admin.register(FulfillmentSlot)
class FulfillmentSlotAdmin(admin.ModelAdmin):
    list_display = ("branch", "method", "starts_at", "ends_at", "capacity", "is_active")
    list_filter = ("branch", "method", "is_active")
    ordering = ("branch__name", "starts_at")


@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("order", "from_status", "to_status", "actor", "created_at")
    list_filter = ("to_status", "created_at")
    search_fields = ("order__order_number", "note")
    readonly_fields = tuple(field.name for field in OrderStatusHistory._meta.fields)
    can_delete = False
