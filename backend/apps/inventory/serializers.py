from rest_framework import serializers

from apps.inventory.models import InventoryAdjustment, ProductBranch


class ProductBranchSerializer(serializers.ModelSerializer):
    available_quantity = serializers.IntegerField(read_only=True)
    effective_price_minor = serializers.IntegerField(read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_unit = serializers.CharField(source="product.unit", read_only=True)
    product_image_url = serializers.URLField(source="product.image_url", read_only=True)

    class Meta:
        model = ProductBranch
        fields = (
            "id",
            "branch",
            "product",
            "product_name",
            "product_sku",
            "product_unit",
            "product_image_url",
            "stock_on_hand",
            "reserved_quantity",
            "available_quantity",
            "is_available",
            "price_override_minor",
            "effective_price_minor",
        )
        read_only_fields = fields


class InventoryAdjustmentRequestSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity_delta = serializers.IntegerField()
    reason = serializers.CharField(min_length=3, max_length=1000, trim_whitespace=True)

    def validate_quantity_delta(self, value):
        if value == 0:
            raise serializers.ValidationError("The stock adjustment must be non-zero.")
        return value


class ProductBranchUpdateSerializer(serializers.ModelSerializer):
    reason = serializers.CharField(write_only=True, min_length=3, max_length=1000, trim_whitespace=True)

    class Meta:
        model = ProductBranch
        fields = ("is_available", "price_override_minor", "reason")
        extra_kwargs = {
            "is_available": {"required": False},
            "price_override_minor": {"required": False, "allow_null": True, "min_value": 0},
        }

    def validate(self, attrs):
        if "reason" not in attrs:
            raise serializers.ValidationError({"reason": "A reason is required for inventory changes."})
        if not any(field in attrs for field in ("is_available", "price_override_minor")):
            raise serializers.ValidationError("Provide at least one inventory setting to update.")
        return attrs

    def update(self, instance, validated_data):
        validated_data.pop("reason")
        return super().update(instance, validated_data)


class InventoryAdjustmentSerializer(serializers.ModelSerializer):
    product_id = serializers.UUIDField(source="product_branch.product_id", read_only=True)
    branch_id = serializers.UUIDField(source="product_branch.branch_id", read_only=True)
    actor_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = InventoryAdjustment
        fields = (
            "id",
            "product_id",
            "branch_id",
            "actor_id",
            "idempotency_key",
            "quantity_delta",
            "reason",
            "stock_before",
            "stock_after",
            "created_at",
        )
        read_only_fields = fields
