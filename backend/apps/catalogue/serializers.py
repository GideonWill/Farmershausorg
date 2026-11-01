from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from apps.catalogue.models import Category, Product


class ProductBranchAvailabilitySerializer(serializers.Serializer):
    is_available = serializers.BooleanField()
    price_minor = serializers.IntegerField()
    available_quantity = serializers.IntegerField()


class ProductBranchAlternativeSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    slug = serializers.SlugField()
    name = serializers.CharField()
    price_minor = serializers.IntegerField()


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "slug", "name", "description", "display_order")
        read_only_fields = fields


class ProductSerializer(serializers.ModelSerializer):
    branch_availability = serializers.SerializerMethodField()
    available_at_other_branches = serializers.SerializerMethodField()
    category = serializers.SlugRelatedField(read_only=True, slug_field="slug")
    tags = serializers.SlugRelatedField(many=True, read_only=True, slug_field="slug")

    class Meta:
        model = Product
        fields = (
            "id",
            "sku",
            "slug",
            "category",
            "name",
            "description",
            "unit",
            "unit_type",
            "base_price_minor",
            "image_url",
            "gallery_image_urls",
            "nutrition",
            "origin",
            "tags",
            "branch_availability",
            "available_at_other_branches",
        )
        read_only_fields = fields

    @extend_schema_field(ProductBranchAvailabilitySerializer)
    def get_branch_availability(self, product) -> dict[str, bool | int]:
        inventories = getattr(product, "selected_branch_inventory", [])
        if not inventories:
            return {
                "is_available": False,
                "price_minor": product.base_price_minor,
                "available_quantity": 0,
            }

        inventory = inventories[0]
        return {
            "is_available": inventory.is_available and inventory.available_quantity > 0,
            "price_minor": inventory.effective_price_minor,
            "available_quantity": inventory.available_quantity,
        }

    @extend_schema_field(ProductBranchAlternativeSerializer(many=True))
    def get_available_at_other_branches(self, product) -> list[dict[str, str | int]]:
        selected_branch_id = self.context.get("selected_branch_id")
        selected = getattr(product, "selected_branch_inventory", [])
        if selected and selected[0].is_available and selected[0].available_quantity > 0:
            return []
        return [
            {
                "id": str(inventory.branch_id),
                "slug": inventory.branch.slug,
                "name": inventory.branch.name,
                "price_minor": inventory.effective_price_minor,
            }
            for inventory in getattr(product, "all_branch_inventory", [])
            if inventory.branch_id != selected_branch_id
            and inventory.branch.is_active
            and inventory.is_available
            and inventory.available_quantity > 0
        ]
