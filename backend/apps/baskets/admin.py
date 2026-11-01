from django.contrib import admin

from .models import BasketCategory, BasketComponent, BasketPackage


class BasketComponentInline(admin.TabularInline):
    model = BasketComponent
    extra = 0


@admin.register(BasketPackage)
class BasketPackageAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "category", "base_price_minor", "is_placeholder", "is_active")
    list_filter = ("category", "is_placeholder", "is_active")
    search_fields = ("name", "sku", "slug")
    prepopulated_fields = {"slug": ("name",)}
    inlines = (BasketComponentInline,)


@admin.register(BasketCategory)
class BasketCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "display_order", "is_active")
    list_filter = ("is_active",)
    prepopulated_fields = {"slug": ("name",)}
