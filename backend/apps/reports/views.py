import csv
import io
import zipfile
from datetime import date, timedelta
from xml.etree.ElementTree import Element, SubElement, register_namespace, tostring

from django.db.models import Count, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import BranchMembership
from apps.audit.models import AuditEvent
from apps.common.permissions import HasAnyBranchMembership
from apps.inventory.models import InventoryAdjustment
from apps.orders.models import CustomerOrder
from apps.payments.models import Payment
from apps.vouchers.models import VoucherUsage


def _report_filters(request):
    branch_id = request.query_params.get("branch", "").strip()
    if not request.user.is_superuser and not branch_id:
        raise ValidationError({"branch": "Choose one of your assigned branches."})
    if branch_id and not request.user.is_superuser and not BranchMembership.objects.filter(
        user=request.user,
        branch_id=branch_id,
        is_active=True,
    ).exists():
        raise PermissionDenied("You do not have access to this branch.")

    today = timezone.localdate()
    try:
        end_date = date.fromisoformat(request.query_params.get("to", today.isoformat()))
        start_date = date.fromisoformat(
            request.query_params.get("from", (today - timedelta(days=29)).isoformat())
        )
    except ValueError as error:
        raise ValidationError({"date": "Dates must use YYYY-MM-DD format."}) from error
    if start_date > end_date:
        raise ValidationError({"date": "The start date must be on or before the end date."})
    return branch_id, start_date, end_date


def _report_data(branch_id, start_date, end_date):
    paid_orders = CustomerOrder.objects.filter(
        paid_at__date__gte=start_date,
        paid_at__date__lte=end_date,
    )
    payments = Payment.objects.filter(
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    )
    voucher_usages = VoucherUsage.objects.filter(
        order__paid_at__date__gte=start_date,
        order__paid_at__date__lte=end_date,
        status=VoucherUsage.Status.REDEEMED,
    )
    audit_events = AuditEvent.objects.all()
    if branch_id:
        paid_orders = paid_orders.filter(branch_id=branch_id)
        payments = payments.filter(order__branch_id=branch_id)
        voucher_usages = voucher_usages.filter(order__branch_id=branch_id)
        audit_events = audit_events.filter(branch_id=branch_id)

    daily = list(
        paid_orders.values("paid_at__date", "branch__name")
        .annotate(
            order_count=Count("id"),
            gross_paid_minor=Sum("payment__amount_minor"),
            adjusted_total_minor=Sum("total_amount_minor"),
            refund_review_minor=Sum("refund_difference_minor"),
        )
        .order_by("paid_at__date", "branch__name")
    )
    best_sellers = list(
        paid_orders.filter(lines__is_removed=False)
        .values("lines__name_snapshot")
        .annotate(quantity=Sum("lines__quantity"), sales_minor=Sum("lines__line_total_minor"))
        .order_by("-quantity", "lines__name_snapshot")[:20]
    )
    payment_statuses = list(
        payments.values("status").annotate(count=Count("id"), amount_minor=Sum("amount_minor")).order_by("status")
    )
    vouchers = list(
        voucher_usages.values("voucher__code")
        .annotate(redemptions=Count("id"), amount_saved_minor=Sum("amount_saved_minor"))
        .order_by("-redemptions", "voucher__code")
    )
    return {
        "daily_sales": [
            {
                "date": row["paid_at__date"].isoformat(),
                "branch": row["branch__name"],
                "order_count": row["order_count"],
                "gross_paid_minor": row["gross_paid_minor"] or 0,
                "adjusted_total_minor": row["adjusted_total_minor"] or 0,
                "refund_review_minor": row["refund_review_minor"] or 0,
            }
            for row in daily
        ],
        "best_sellers": [
            {
                "product": row["lines__name_snapshot"],
                "quantity": row["quantity"] or 0,
                "sales_minor": row["sales_minor"] or 0,
            }
            for row in best_sellers
        ],
        "payment_statuses": [
            {
                "status": row["status"],
                "count": row["count"],
                "amount_minor": row["amount_minor"] or 0,
            }
            for row in payment_statuses
        ],
        "voucher_usage": [
            {
                "code": row["voucher__code"],
                "redemptions": row["redemptions"],
                "amount_saved_minor": row["amount_saved_minor"] or 0,
            }
            for row in vouchers
        ],
        "audit_count": audit_events.count(),
        "inventory_adjustment_count": InventoryAdjustment.objects.filter(
            product_branch__branch_id=branch_id
        ).count() if branch_id else InventoryAdjustment.objects.count(),
    }


class StaffReportView(APIView):
    permission_classes = (IsAuthenticated, HasAnyBranchMembership)

    def get(self, request):
        branch_id, start_date, end_date = _report_filters(request)
        return Response({
            "from": start_date.isoformat(),
            "to": end_date.isoformat(),
            "branch": branch_id or None,
            **_report_data(branch_id, start_date, end_date),
        })


def _xlsx_workbook(sheets):
    spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    relationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    package_relationships = "http://schemas.openxmlformats.org/package/2006/relationships"
    content_types = "http://schemas.openxmlformats.org/package/2006/content-types"
    register_namespace("", spreadsheet)
    register_namespace("r", relationships)
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as workbook:
        types = Element(f"{{{content_types}}}Types")
        SubElement(types, f"{{{content_types}}}Default", {"Extension": "rels", "ContentType": "application/vnd.openxmlformats-package.relationships+xml"})
        SubElement(types, f"{{{content_types}}}Default", {"Extension": "xml", "ContentType": "application/xml"})
        SubElement(types, f"{{{content_types}}}Override", {"PartName": "/xl/workbook.xml", "ContentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"})
        for index in range(1, len(sheets) + 1):
            SubElement(types, f"{{{content_types}}}Override", {
                "PartName": f"/xl/worksheets/sheet{index}.xml",
                "ContentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml",
            })
        workbook.writestr("[Content_Types].xml", tostring(types, encoding="utf-8", xml_declaration=True))

        root_rels = Element(f"{{{package_relationships}}}Relationships")
        SubElement(root_rels, f"{{{package_relationships}}}Relationship", {
            "Id": "rId1",
            "Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
            "Target": "xl/workbook.xml",
        })
        workbook.writestr("_rels/.rels", tostring(root_rels, encoding="utf-8", xml_declaration=True))

        book = Element(f"{{{spreadsheet}}}workbook")
        sheet_list = SubElement(book, f"{{{spreadsheet}}}sheets")
        for index, (name, _) in enumerate(sheets, start=1):
            SubElement(sheet_list, f"{{{spreadsheet}}}sheet", {
                "name": name, "sheetId": str(index), f"{{{relationships}}}id": f"rId{index}",
            })
        workbook.writestr("xl/workbook.xml", tostring(book, encoding="utf-8", xml_declaration=True))
        book_rels = Element(f"{{{package_relationships}}}Relationships")
        for index, _ in enumerate(sheets, start=1):
            SubElement(book_rels, f"{{{package_relationships}}}Relationship", {
                "Id": f"rId{index}",
                "Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet",
                "Target": f"worksheets/sheet{index}.xml",
            })
        workbook.writestr("xl/_rels/workbook.xml.rels", tostring(book_rels, encoding="utf-8", xml_declaration=True))

        for sheet_index, (_, rows) in enumerate(sheets, start=1):
            sheet = Element(f"{{{spreadsheet}}}worksheet")
            data = SubElement(sheet, f"{{{spreadsheet}}}sheetData")
            for row_index, row in enumerate(rows, start=1):
                xml_row = SubElement(data, f"{{{spreadsheet}}}row", {"r": str(row_index)})
                for column_index, value in enumerate(row, start=1):
                    column = ""
                    number = column_index
                    while number:
                        number, remainder = divmod(number - 1, 26)
                        column = chr(65 + remainder) + column
                    cell = SubElement(xml_row, f"{{{spreadsheet}}}c", {"r": f"{column}{row_index}"})
                    if isinstance(value, (int, float)):
                        SubElement(cell, f"{{{spreadsheet}}}v").text = str(value)
                    else:
                        cell.set("t", "inlineStr")
                        inline = SubElement(cell, f"{{{spreadsheet}}}is")
                        SubElement(inline, f"{{{spreadsheet}}}t").text = str(value)
            workbook.writestr(
                f"xl/worksheets/sheet{sheet_index}.xml",
                tostring(sheet, encoding="utf-8", xml_declaration=True),
            )
    return output.getvalue()


class StaffReportExportView(APIView):
    permission_classes = (IsAuthenticated, HasAnyBranchMembership)

    def get(self, request):
        branch_id, start_date, end_date = _report_filters(request)
        report = _report_data(branch_id, start_date, end_date)
        export_format = request.query_params.get("file_format", "csv").lower()
        sheets = [
            ("Daily Sales", [["Date", "Branch", "Orders", "Gross paid (minor)", "Adjusted total (minor)", "Refund review (minor)"]]),
            ("Best Sellers", [["Product", "Quantity", "Sales (minor)"]]),
            ("Payment Status", [["Status", "Payments", "Amount (minor)"]]),
            ("Voucher Usage", [["Code", "Redemptions", "Amount saved (minor)"]]),
        ]
        sheets[0][1].extend([
            item["date"], item["branch"], item["order_count"], item["gross_paid_minor"],
            item["adjusted_total_minor"], item["refund_review_minor"],
        ] for item in report["daily_sales"])
        sheets[1][1].extend([
            item["product"], item["quantity"], item["sales_minor"],
        ] for item in report["best_sellers"])
        sheets[2][1].extend([
            item["status"], item["count"], item["amount_minor"],
        ] for item in report["payment_statuses"])
        sheets[3][1].extend([
            item["code"], item["redemptions"], item["amount_saved_minor"],
        ] for item in report["voucher_usage"])
        if export_format == "xlsx":
            response = HttpResponse(
                _xlsx_workbook(sheets),
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            response["Content-Disposition"] = 'attachment; filename="farmershaus-sales-report.xlsx"'
            return response
        if export_format != "csv":
            raise ValidationError({"format": "Choose csv or xlsx."})
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        for name, rows in sheets:
            writer.writerow([name])
            writer.writerows(rows)
            writer.writerow([])
        response = HttpResponse(buffer.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="farmershaus-sales-report.csv"'
        return response


class StaffAuditListView(APIView):
    permission_classes = (IsAuthenticated, HasAnyBranchMembership)

    def get(self, request):
        branch_id = request.query_params.get("branch", "").strip()
        if not request.user.is_superuser and not branch_id:
            raise ValidationError({"branch": "Choose one of your assigned branches."})
        events = AuditEvent.objects.select_related("actor", "branch")
        if branch_id:
            if not request.user.is_superuser and not BranchMembership.objects.filter(
                user=request.user,
                branch_id=branch_id,
                is_active=True,
            ).exists():
                raise PermissionDenied("You do not have access to this branch.")
            events = events.filter(branch_id=branch_id)
        return Response([
            {
                "id": str(event.pk),
                "occurred_at": event.occurred_at,
                "actor": str(event.actor) if event.actor else "",
                "branch": event.branch.name if event.branch else "",
                "action": event.action,
                "resource_type": event.resource_type,
                "resource_id": event.resource_id,
                "before_data": event.before_data,
                "after_data": event.after_data,
            }
            for event in events[:200]
        ])
