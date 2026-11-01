from django.contrib import admin

from .models import Category, Product, ProductTag


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "display_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "category", "base_price_minor", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("name", "sku", "slug")
    prepopulated_fields = {"slug": ("name",)}
    filter_horizontal = ("tags",)


@admin.register(ProductTag)
class ProductTagAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
