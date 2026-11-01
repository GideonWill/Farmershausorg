from django.urls import path

from apps.reports.views import StaffAuditListView, StaffReportExportView, StaffReportView


urlpatterns = [
    path("staff/reports/", StaffReportView.as_view(), name="staff-reports"),
    path("staff/reports/export/", StaffReportExportView.as_view(), name="staff-report-export"),
    path("staff/audit/", StaffAuditListView.as_view(), name="staff-audit"),
]
