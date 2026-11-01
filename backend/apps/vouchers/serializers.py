from rest_framework import serializers

from apps.vouchers.models import Voucher


class VoucherValidationRequestSerializer(serializers.Serializer):
    cart_id = serializers.UUIDField()
    branch_id = serializers.UUIDField()
    code = serializers.CharField(max_length=80)


class VoucherValidationResponseSerializer(serializers.Serializer):
    code = serializers.CharField()
    eligible_subtotal_minor = serializers.IntegerField()
    discount_minor = serializers.IntegerField()


class BulkVoucherCreateResponseSerializer(serializers.Serializer):
    codes = serializers.ListField(child=serializers.CharField())
    count = serializers.IntegerField()


class BulkVoucherCreateSerializer(serializers.Serializer):
    prefix = serializers.RegexField(r"^[A-Za-z0-9_-]{2,30}$")
    count = serializers.IntegerField(min_value=1, max_value=500)
    discount_type = serializers.ChoiceField(choices=Voucher.DiscountType.choices)
    fixed_amount_minor = serializers.IntegerField(min_value=0, required=False, default=0)
    percent_basis_points = serializers.IntegerField(min_value=0, max_value=10000, required=False, default=0)
    minimum_spend_minor = serializers.IntegerField(min_value=0, required=False, default=0)
    maximum_discount_minor = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    total_usage_limit = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    per_customer_usage_limit = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    branch_id = serializers.UUIDField(required=False, allow_null=True)
    branch_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )
    product_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )
    basket_package_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()

    def validate(self, attrs):
        if attrs["ends_at"] <= attrs["starts_at"]:
            raise serializers.ValidationError({"ends_at": "Must be later than starts_at."})
        if attrs["discount_type"] == Voucher.DiscountType.FIXED and attrs["fixed_amount_minor"] <= 0:
            raise serializers.ValidationError({"fixed_amount_minor": "Must be greater than zero."})
        if attrs["discount_type"] == Voucher.DiscountType.PERCENT and not (
            1 <= attrs["percent_basis_points"] <= 10000
        ):
            raise serializers.ValidationError({"percent_basis_points": "Use a value from 1 to 10000."})
        return attrs
