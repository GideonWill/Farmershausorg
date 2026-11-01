from django.contrib import admin

from .models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("occurred_at", "actor", "branch", "action", "resource_type", "resource_id")
    list_filter = ("action", "resource_type", "branch", "occurred_at")
    search_fields = ("resource_id", "request_id", "actor__username")
    readonly_fields = tuple(field.name for field in AuditEvent._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
