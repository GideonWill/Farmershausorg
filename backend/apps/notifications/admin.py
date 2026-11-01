from django.contrib import admin

from .models import DeliveryAttempt, Notification


class DeliveryAttemptInline(admin.TabularInline):
    model = DeliveryAttempt
    extra = 0
    readonly_fields = tuple(field.name for field in DeliveryAttempt._meta.fields)
    can_delete = False


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "template_key", "channel", "status", "created_at")
    list_filter = ("channel", "status", "created_at")
    search_fields = ("user__username", "template_key", "order__order_number")
    inlines = (DeliveryAttemptInline,)
