from django.contrib import admin

from .models import ReportExport


@admin.register(ReportExport)
class ReportExportAdmin(admin.ModelAdmin):
    list_display = ("report_type", "requester", "branch", "file_format", "status", "created_at")
    list_filter = ("status", "file_format", "branch")
    search_fields = ("report_type", "requester__username")
    readonly_fields = tuple(field.name for field in ReportExport._meta.fields)
    can_delete = False
