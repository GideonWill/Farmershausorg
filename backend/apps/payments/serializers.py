from rest_framework import serializers

from apps.payments.models import Payment, PaymentAttempt


class PaymentInitiationSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=Payment.Method.choices)
    idempotency_key = serializers.CharField(min_length=8, max_length=100)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=16)
    network = serializers.CharField(required=False, allow_blank=True, max_length=32)


class PaymentAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentAttempt
        fields = (
            "id",
            "status",
            "checkout_reference",
            "provider_reference",
            "checkout_url",
            "result_code",
            "created_at",
            "completed_at",
        )


class PaymentReadSerializer(serializers.ModelSerializer):
    attempts = PaymentAttemptSerializer(many=True, read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "order",
            "provider",
            "method",
            "network",
            "amount_minor",
            "currency",
            "status",
            "succeeded_at",
            "attempts",
        )


class PaymentInitiationResponseSerializer(PaymentReadSerializer):
    current_attempt = PaymentAttemptSerializer(read_only=True)

    class Meta(PaymentReadSerializer.Meta):
        fields = (*PaymentReadSerializer.Meta.fields, "current_attempt")


class ProviderErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()


class PaymentReconciliationSerializer(serializers.Serializer):
    date = serializers.DateField()
    branch_id = serializers.UUIDField()
    currency = serializers.CharField()
    internal_daily_summary = serializers.DictField()
    needs_review = serializers.ListField(child=serializers.DictField())


class RefundRetryResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    status = serializers.CharField()
    provider_reference = serializers.CharField(allow_blank=True)
    error = serializers.CharField(allow_blank=True)
