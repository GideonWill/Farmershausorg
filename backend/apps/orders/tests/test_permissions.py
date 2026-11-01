from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import BranchMembership
from apps.audit.models import AuditEvent
from apps.branches.models import Branch, BranchPaymentAccount, DeliveryZone
from apps.catalogue.models import Category, Product
from apps.inventory.models import ProductBranch
from apps.orders.models import CustomerOrder, OrderLine
from apps.payments.models import Payment


class OrderPermissionTests(TestCase):
    def setUp(self):
        self.customer = get_user_model().objects.create_user(
            username="order-permission-customer",
            phone="+233550000444",
            password="test-password",
        )
        self.staff = get_user_model().objects.create_user(
            username="order-permission-staff",
            phone="+233550000445",
            password="test-password",
        )
        self.branch = Branch.objects.get(slug="dome")
        self.other_branch = Branch.objects.get(slug="westland")
        self.zone = DeliveryZone.objects.create(branch=self.branch, name="Permission zone")
        self.other_zone = DeliveryZone.objects.create(
            branch=self.other_branch,
            name="Other permission zone",
        )
        self.order = CustomerOrder.objects.create(
            user=self.customer,
            branch=self.branch,
            delivery_zone=self.zone,
            subtotal_minor=1000,
            total_amount_minor=1000,
        )
        self.client = APIClient()

    def test_customer_can_cancel_unpaid_order(self):
        self.client.force_authenticate(self.customer)

        response = self.client.post(
            f"/api/v1/orders/{self.order.order_number}/cancel/",
            {"reason": "Changed my mind"},
            format="json",
        )

        self.order.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.order.status, CustomerOrder.Status.CANCELLED)
        self.assertIsNotNone(self.order.cancelled_at)

    def test_customer_cannot_cancel_paid_order(self):
        self.order.status = CustomerOrder.Status.CONFIRMED
        self.order.paid_at = timezone.now()
        self.order.save(update_fields=("status", "paid_at"))
        self.client.force_authenticate(self.customer)

        response = self.client.post(
            f"/api/v1/orders/{self.order.order_number}/cancel/",
            {"reason": "Refund requested"},
            format="json",
        )

        self.order.refresh_from_db()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.order.status, CustomerOrder.Status.CONFIRMED)

    def test_staff_list_is_restricted_to_membership_branch(self):
        BranchMembership.objects.create(user=self.staff, branch=self.other_branch)
        self.client.force_authenticate(self.staff)

        response = self.client.get(f"/api/v1/staff/orders/?branch={self.branch.pk}")

        self.assertEqual(response.status_code, 403)

    def test_staff_can_advance_orders_only_for_assigned_branch(self):
        BranchMembership.objects.create(user=self.staff, branch=self.branch)
        self.order.status = CustomerOrder.Status.CONFIRMED
        self.order.paid_at = timezone.now()
        self.order.save(update_fields=("status", "paid_at"))
        account = BranchPaymentAccount.objects.create(
            branch=self.branch,
            provider=BranchPaymentAccount.Provider.HUBTEL,
            provider_account_id="hubtel-status-test",
            momo_business_line="+233550000004",
            credentials_secret_ref="secret://payments/status",
            settlement_verified=True,
        )
        Payment.objects.create(
            order=self.order,
            branch_payment_account=account,
            provider=account.provider,
            amount_minor=self.order.total_amount_minor,
            merchant_idempotency_reference=f"order-{self.order.order_number}".lower(),
            status=Payment.Status.SUCCEEDED,
        )
        self.client.force_authenticate(self.staff)

        response = self.client.patch(
            f"/api/v1/staff/orders/{self.order.order_number}/status/",
            {"status": CustomerOrder.Status.PICKING, "note": "Picking started"},
            format="json",
        )

        self.order.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.order.status, CustomerOrder.Status.PICKING)
        self.assertIsNotNone(self.order.picking_at)

    def create_paid_order_payment(self):
        account = BranchPaymentAccount.objects.create(
            branch=self.branch,
            provider=BranchPaymentAccount.Provider.HUBTEL,
            provider_account_id=f"hubtel-{self.order.order_number}",
            momo_business_line="+233550000004",
            credentials_secret_ref="secret://payments/staff-dashboard",
            settlement_verified=True,
        )
        Payment.objects.create(
            order=self.order,
            branch_payment_account=account,
            provider=account.provider,
            amount_minor=self.order.total_amount_minor,
            merchant_idempotency_reference=f"order-{self.order.order_number}".lower(),
            status=Payment.Status.SUCCEEDED,
        )
        self.order.status = CustomerOrder.Status.CONFIRMED
        self.order.paid_at = timezone.now()
        self.order.save(update_fields=("status", "paid_at"))

    def test_staff_can_assign_rider_for_assigned_branch(self):
        BranchMembership.objects.create(user=self.staff, branch=self.branch)
        self.create_paid_order_payment()
        self.client.force_authenticate(self.staff)

        response = self.client.patch(
            f"/api/v1/staff/orders/{self.order.order_number}/rider/",
            {"name": "Ama Rider", "phone": "+233550000777"},
            format="json",
        )

        self.order.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.order.rider_name, "Ama Rider")
        self.assertEqual(self.order.rider_phone, "+233550000777")
        self.assertTrue(AuditEvent.objects.filter(action="order.rider_assigned").exists())

    def test_staff_can_remove_out_of_stock_line_and_flag_refund_for_admin(self):
        BranchMembership.objects.create(user=self.staff, branch=self.branch)
        category = Category.objects.create(slug="staff-adjustment", name="Staff adjustment")
        product = Product.objects.create(
            sku="STAFF-REMOVE-01",
            slug="staff-remove-01",
            category=category,
            name="Unavailable apples",
            unit="kg",
            base_price_minor=1000,
        )
        OrderLine.objects.create(
            order=self.order,
            product=product,
            sku_snapshot=product.sku,
            name_snapshot=product.name,
            unit_snapshot=product.unit,
            quantity=1,
            unit_price_minor=1000,
            line_total_minor=1000,
        )
        self.create_paid_order_payment()
        self.client.force_authenticate(self.staff)

        response = self.client.post(
            f"/api/v1/staff/orders/{self.order.order_number}/items/adjust/",
            {
                "order_line_id": str(self.order.lines.get().pk),
                "action": "remove",
                "reason": "Out of stock at picking.",
            },
            format="json",
        )

        self.order.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(self.order.lines.get().is_removed)
        self.assertEqual(self.order.total_amount_minor, 0)
        self.assertEqual(self.order.refund_difference_minor, 1000)
        self.assertTrue(self.order.refund_review_required)

    def test_staff_can_substitute_an_item_with_available_lower_priced_stock(self):
        BranchMembership.objects.create(user=self.staff, branch=self.branch)
        category = Category.objects.create(slug="staff-substitution", name="Staff substitution")
        original = Product.objects.create(
            sku="STAFF-ORIGINAL-01",
            slug="staff-original-01",
            category=category,
            name="Original produce",
            unit="kg",
            base_price_minor=1000,
        )
        replacement = Product.objects.create(
            sku="STAFF-REPLACEMENT-01",
            slug="staff-replacement-01",
            category=category,
            name="Replacement produce",
            unit="kg",
            base_price_minor=600,
        )
        replacement_inventory = ProductBranch.objects.create(
            branch=self.branch,
            product=replacement,
            stock_on_hand=5,
            is_available=True,
        )
        line = OrderLine.objects.create(
            order=self.order,
            product=original,
            sku_snapshot=original.sku,
            name_snapshot=original.name,
            unit_snapshot=original.unit,
            quantity=1,
            unit_price_minor=1000,
            line_total_minor=1000,
        )
        self.create_paid_order_payment()
        self.client.force_authenticate(self.staff)

        response = self.client.post(
            f"/api/v1/staff/orders/{self.order.order_number}/items/adjust/",
            {
                "order_line_id": str(line.pk),
                "action": "substitute",
                "replacement_product_id": str(replacement.pk),
                "reason": "Original produce is unavailable.",
            },
            format="json",
        )

        self.order.refresh_from_db()
        line.refresh_from_db()
        replacement_inventory.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(line.product_id, replacement.pk)
        self.assertEqual(line.line_total_minor, 600)
        self.assertEqual(replacement_inventory.stock_on_hand, 4)
        self.assertEqual(self.order.refund_difference_minor, 400)

    def test_staff_cannot_adjust_order_from_another_branch(self):
        BranchMembership.objects.create(user=self.staff, branch=self.other_branch)
        self.client.force_authenticate(self.staff)

        response = self.client.post(
            f"/api/v1/staff/orders/{self.order.order_number}/items/adjust/",
            {"order_line_id": str(self.order.pk), "action": "remove", "reason": "Out of stock"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_super_admin_can_cancel_an_unpaid_customer_order(self):
        admin = get_user_model().objects.create_superuser(
            username="order-cancel-super-admin",
            email="order-cancel-admin@example.com",
            phone="+233550000446",
            password="Secure-test-password-446",
        )
        self.client.force_authenticate(admin)

        response = self.client.post(
            f"/api/v1/orders/{self.order.order_number}/cancel/",
            {"reason": "Customer requested cancellation before payment."},
            format="json",
        )

        self.order.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.order.status, CustomerOrder.Status.CANCELLED)

    def test_paid_customer_can_download_pdf_receipt(self):
        self.order.status = CustomerOrder.Status.CONFIRMED
        self.order.paid_at = timezone.now()
        self.order.save(update_fields=("status", "paid_at"))
        self.client.force_authenticate(self.customer)

        response = self.client.get(
            f"/api/v1/orders/{self.order.order_number}/receipt.pdf"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
