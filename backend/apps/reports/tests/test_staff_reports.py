from io import BytesIO
import zipfile

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import BranchMembership
from apps.branches.models import Branch


class StaffReportApiTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.get(slug="dome")
        self.other_branch = Branch.objects.get(slug="westland")
        self.staff = get_user_model().objects.create_user(
            username="report-staff",
            phone="+233550000889",
            password="A-secure-test-password-42",
        )
        BranchMembership.objects.create(user=self.staff, branch=self.branch)
        self.client = APIClient()
        self.client.force_authenticate(self.staff)

    def test_report_and_csv_export_are_scoped_to_assigned_branch(self):
        report = self.client.get(f"/api/v1/staff/reports/?branch={self.branch.pk}")
        export = self.client.get(f"/api/v1/staff/reports/export/?branch={self.branch.pk}&file_format=csv")

        self.assertEqual(report.status_code, 200, report.data)
        self.assertEqual(report.data["branch"], str(self.branch.pk))
        self.assertEqual(export.status_code, 200, export.content[:500])
        self.assertEqual(export["Content-Type"], "text/csv; charset=utf-8")

    def test_staff_cannot_read_other_branch_reports_or_audit_events(self):
        reports = self.client.get(f"/api/v1/staff/reports/?branch={self.other_branch.pk}")
        audit = self.client.get(f"/api/v1/staff/audit/?branch={self.other_branch.pk}")

        self.assertEqual(reports.status_code, 403)
        self.assertEqual(audit.status_code, 403)

    def test_excel_report_is_a_valid_xlsx_archive(self):
        response = self.client.get(
            f"/api/v1/staff/reports/export/?branch={self.branch.pk}&file_format=xlsx"
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(zipfile.is_zipfile(BytesIO(response.content)))
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
