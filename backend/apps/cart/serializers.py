import uuid

from rest_framework import serializers
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field

from apps.cart.models import Cart, CartItem
from apps.inventory.models import ProductBranch


class CartItemWriteSerializer(serializers.Serializer):
    branch_id = serializers.UUIDField()
    product_id = serializers.UUIDField(required=False)
    basket_package_id = serializers.UUIDField(required=False)
    quantity = serializers.IntegerField(min_value=1, max_value=999)
    gift_recipient_name = serializers.CharField(required=False, max_length=120, allow_blank=True)
    gift_message = serializers.CharField(required=False, max_length=500, allow_blank=True)

    def validate(self, attrs):
        if ("product_id" in attrs) == ("basket_package_id" in attrs):
            raise serializers.ValidationError(
                "Provide exactly one of product_id or basket_package_id."
            )
        return attrs


class CartItemUpdateSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, max_value=999)


class CartValidationRequestSerializer(serializers.Serializer):
    cart_id = serializers.UUIDField()
    branch_id = serializers.UUIDField()


class CartProductSerializer(serializers.Serializer):
    id = serializers.UUIDField(source="pk")
    sku = serializers.CharField()
    slug = serializers.SlugField()
    name = serializers.CharField()
    unit = serializers.CharField()
    unit_type = serializers.CharField()
    image_url = serializers.URLField(allow_blank=True)
    unit_price_minor = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()

    def _inventory(self, product):
        inventories = getattr(product, "selected_branch_inventory", [])
        return inventories[0] if inventories else None

    @extend_schema_field(OpenApiTypes.INT)
    def get_unit_price_minor(self, product) -> int:
        inventory = self._inventory(product)
        return inventory.effective_price_minor if inventory else product.base_price_minor

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_is_available(self, product) -> bool:
        inventory = self._inventory(product)
        return bool(
            inventory
            and inventory.is_available
            and inventory.available_quantity > 0
        )


class CartItemReadSerializer(serializers.ModelSerializer):
    product = CartProductSerializer(read_only=True)
    basket_package = serializers.SerializerMethodField()

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_basket_package(self, item):
        if not item.basket_package_id:
            return None
        basket = item.basket_package
        return {
            "id": str(basket.pk),
            "name": basket.name,
            "slug": basket.slug,
            "is_placeholder": basket.is_placeholder,
        }

    class Meta:
        model = CartItem
        fields = (
            "id",
            "product",
            "basket_package",
            "quantity",
            "gift_recipient_name",
            "gift_message",
        )
        read_only_fields = fields


class CartReadSerializer(serializers.ModelSerializer):
    items = CartItemReadSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = ("id", "branch", "status", "items", "updated_at")
        read_only_fields = fields


class CartResponseSerializer(serializers.Serializer):
    cart = CartReadSerializer(allow_null=True)


class CartValidationItemSerializer(serializers.Serializer):
    cart_item_id = serializers.UUIDField()
    product_id = serializers.UUIDField(required=False)
    basket_package_id = serializers.UUIDField(required=False)
    product_name = serializers.CharField()
    requested_quantity = serializers.IntegerField()
    reason = serializers.ChoiceField(
        choices=(
            "branch_mismatch",
            "product_inactive",
            "unavailable",
            "insufficient_stock",
            "basket_unavailable",
        )
    )


class CartValidationResponseSerializer(serializers.Serializer):
    cart_id = serializers.UUIDField()
    branch_id = serializers.UUIDField()
    is_valid = serializers.BooleanField()
    unavailable_items = CartValidationItemSerializer(many=True)


def normalize_guest_session_key(value):
    if not value:
        raise serializers.ValidationError(
            {"X-Cart-Session": "A UUIDv4 cart session key is required for guest carts."}
        )
    try:
        parsed = uuid.UUID(value)
    except (ValueError, AttributeError) as error:
        raise serializers.ValidationError(
            {"X-Cart-Session": "Provide a valid UUIDv4 cart session key."}
        ) from error
    if parsed.version != 4:
        raise serializers.ValidationError(
            {"X-Cart-Session": "Provide a valid UUIDv4 cart session key."}
        )
    return str(parsed)
