from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from apps.orders.models import (
    CustomerOrder,
    OrderLine,
    OrderStatusHistory,
)


class CheckoutSerializer(serializers.Serializer):
    cart_id = serializers.UUIDField()
    branch_id = serializers.UUIDField()
    fulfillment_method = serializers.ChoiceField(choices=CustomerOrder.FulfillmentMethod.choices)
    address_id = serializers.UUIDField(required=False)
    delivery_zone_id = serializers.UUIDField(required=False)
    slot_id = serializers.UUIDField(required=False)
    voucher_code = serializers.CharField(required=False, allow_blank=True, max_length=80)
    customer_note = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    recipient_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=50)
    email = serializers.EmailField(required=False, allow_blank=True)
    address_line_1 = serializers.CharField(required=False, allow_blank=True, max_length=255)
    address_line_2 = serializers.CharField(required=False, allow_blank=True, max_length=255)
    area = serializers.CharField(required=False, allow_blank=True, max_length=120)
    directions = serializers.CharField(required=False, allow_blank=True, max_length=500)


class OrderLineComponentSerializer(serializers.Serializer):
    name = serializers.CharField(source="name_snapshot")
    unit = serializers.CharField(source="unit_snapshot")
    quantity = serializers.IntegerField()


class OrderLineSerializer(serializers.ModelSerializer):
    components = OrderLineComponentSerializer(many=True, read_only=True)

    class Meta:
        model = OrderLine
        fields = (
            "id",
            "product_id",
            "sku_snapshot",
            "name_snapshot",
            "unit_snapshot",
            "quantity",
            "unit_price_minor",
            "line_total_minor",
            "gift_recipient_name",
            "gift_message",
            "components",
            "is_removed",
        )


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = ("from_status", "to_status", "note", "created_at")


class OrderReadSerializer(serializers.ModelSerializer):
    lines = OrderLineSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    payment_status = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()

    class Meta:
        model = CustomerOrder
        fields = (
            "id",
            "order_number",
            "branch",
            "branch_snapshot",
            "fulfillment_method",
            "fulfillment_slot",
            "delivery_snapshot",
            "address_snapshot",
            "status",
            "payment_status",
            "currency",
            "subtotal_minor",
            "delivery_fee_minor",
            "discount_minor",
            "total_amount_minor",
            "voucher_code_snapshot",
            "customer_note",
            "customer_name",
            "customer_phone",
            "rider_name",
            "rider_phone",
            "refund_difference_minor",
            "refund_review_required",
            "stock_adjustment_note",
            "lines",
            "status_history",
            "created_at",
            "paid_at",
            "confirmed_at",
            "staff_confirmed_at",
            "picking_at",
            "ready_for_dispatch_at",
            "out_for_delivery_at",
            "cancelled_at",
            "delivered_at",
            "expired_at",
        )

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_payment_status(self, order):
        try:
            return order.payment.status
        except ObjectDoesNotExist:
            return None

    def get_customer_name(self, order):
        return (
            order.address_snapshot.get("recipient_name")
            or (order.user.display_name or order.user.get_full_name() or order.user.username)
            if order.user_id
            else order.address_snapshot.get("recipient_name", "")
        )

    def get_customer_phone(self, order):
        return (
            order.address_snapshot.get("phone")
            or (order.user.phone if order.user_id else "")
        )


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            CustomerOrder.Status.CONFIRMED,
            CustomerOrder.Status.PICKING,
            CustomerOrder.Status.READY_FOR_DISPATCH,
            CustomerOrder.Status.OUT_FOR_DELIVERY,
            CustomerOrder.Status.DELIVERED,
        )
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)


class StaffRiderAssignmentSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, allow_blank=True)
    phone = serializers.CharField(max_length=16, allow_blank=True)

    def validate(self, attrs):
        if bool(attrs["name"].strip()) != bool(attrs["phone"].strip()):
            raise serializers.ValidationError("Provide both rider name and phone, or clear both.")
        return attrs


class StaffOrderLineAdjustmentSerializer(serializers.Serializer):
    order_line_id = serializers.UUIDField()
    action = serializers.ChoiceField(choices=("remove", "substitute"))
    replacement_product_id = serializers.UUIDField(required=False)
    reason = serializers.CharField(min_length=3, max_length=500, trim_whitespace=True)

    def validate(self, attrs):
        if attrs["action"] == "substitute" and not attrs.get("replacement_product_id"):
            raise serializers.ValidationError({"replacement_product_id": "Choose a replacement product."})
        if attrs["action"] == "remove" and attrs.get("replacement_product_id"):
            raise serializers.ValidationError({"replacement_product_id": "A removed item cannot have a replacement."})
        return attrs


class CancelOrderSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=1000)


class AdminRefundSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    status = serializers.CharField()
    idempotency_key = serializers.CharField()
    error = serializers.CharField(allow_blank=True)


class AdminCancellationResponseSerializer(serializers.Serializer):
    order = OrderReadSerializer()
    refund = AdminRefundSummarySerializer()


class FulfillmentSlotSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    method = serializers.CharField()
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()
    remaining_capacity = serializers.IntegerField()
