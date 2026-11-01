from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from apps.baskets.models import BasketCategory, BasketComponent, BasketPackage


class BasketCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BasketCategory
        fields = ("id", "slug", "name", "display_order")


class BasketBranchAvailabilitySerializer(serializers.Serializer):
    is_available = serializers.BooleanField()
    price_minor = serializers.IntegerField()


class BasketComponentSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_unit = serializers.CharField(source="product.unit", read_only=True)

    class Meta:
        model = BasketComponent
        fields = ("product", "product_name", "product_unit", "quantity", "is_optional")
        read_only_fields = fields


class BasketPackageSerializer(serializers.ModelSerializer):
    components = BasketComponentSerializer(many=True, read_only=True)
    branch_availability = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)

    class Meta:
        model = BasketPackage
        fields = (
            "id",
            "sku",
            "slug",
            "name",
            "category",
            "category_name",
            "description",
            "base_price_minor",
            "image_url",
            "is_placeholder",
            "gift_message_allowed",
            "components",
            "branch_availability",
        )
        read_only_fields = fields

    @extend_schema_field(BasketBranchAvailabilitySerializer)
    def get_branch_availability(self, basket) -> dict[str, bool | int]:
        components = list(basket.components.all())
        if not components:
            return {"is_available": False, "price_minor": basket.base_price_minor}

        available = True
        for component in components:
            if component.is_optional:
                continue
            inventories = getattr(component.product, "selected_branch_inventory", [])
            inventory = inventories[0] if inventories else None
            if (
                inventory is None
                or not inventory.is_available
                or inventory.available_quantity < component.quantity
            ):
                available = False
                break

        return {"is_available": available, "price_minor": basket.base_price_minor}
