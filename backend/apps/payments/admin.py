from django.contrib import admin

from .models import Payment, PaymentAttempt, PaymentWebhookEvent, Refund


class PaymentAttemptInline(admin.TabularInline):
    model = PaymentAttempt
    extra = 0
    readonly_fields = tuple(field.name for field in PaymentAttempt._meta.fields)
    can_delete = False


class RefundInline(admin.TabularInline):
    model = Refund
    extra = 0
    readonly_fields = tuple(field.name for field in Refund._meta.fields)
    can_delete = False


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("order", "provider", "method", "amount_minor", "currency", "status", "created_at")
    list_filter = ("provider", "method", "status", "created_at")
    search_fields = ("order__order_number", "provider_reference", "merchant_idempotency_reference")
    readonly_fields = tuple(field.name for field in Payment._meta.fields)
    inlines = (PaymentAttemptInline, RefundInline)
    can_delete = False


@admin.register(PaymentWebhookEvent)
class PaymentWebhookEventAdmin(admin.ModelAdmin):
    list_display = (
        "provider",
        "provider_event_id",
        "signature_verified",
        "received_at",
        "processed_at",
        "processing_error",
    )
    list_filter = ("provider", "signature_verified", "received_at")
    search_fields = ("provider_event_id",)
    readonly_fields = tuple(field.name for field in PaymentWebhookEvent._meta.fields)
    can_delete = False
