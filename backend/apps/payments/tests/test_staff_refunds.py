from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import BranchMembership
from apps.branches.models import Branch, BranchPaymentAccount, DeliveryZone
from apps.orders.models import CustomerOrder
from apps.payments.models import Payment, Refund


class StaffRefundReviewTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_superuser(
            username="refund-super-admin",
            email="refund-admin@example.com",
            phone="+233550000902",
            password="Secure-test-password-902",
        )
        self.staff = user_model.objects.create_user(
            username="refund-branch-staff",
            phone="+233550000903",
            password="Secure-test-password-903",
        )
        self.branch = Branch.objects.get(slug="dome")
        self.zone = DeliveryZone.objects.create(branch=self.branch, name="Refund review zone")
        self.account = BranchPaymentAccount.objects.create(
            branch=self.branch,
            provider=BranchPaymentAccount.Provider.HUBTEL,
            provider_account_id="refund-review-account",
            momo_business_line="+233550000004",
            credentials_secret_ref="secret://payments/refund-review",
            settlement_verified=True,
        )
        self.order = CustomerOrder.objects.create(
            user=self.staff,
            branch=self.branch,
            delivery_zone=self.zone,
            status=CustomerOrder.Status.CONFIRMED,
            subtotal_minor=1000,
            total_amount_minor=1000,
            paid_at=timezone.now(),
            refund_difference_minor=250,
            refund_review_required=True,
            stock_adjustment_note="A produce item was removed during picking.",
        )
        self.payment = Payment.objects.create(
            order=self.order,
            branch_payment_account=self.account,
            provider=self.account.provider,
            amount_minor=1000,
            merchant_idempotency_reference=f"refund-review-{self.order.order_number}".lower(),
            status=Payment.Status.SUCCEEDED,
        )
        BranchMembership.objects.create(user=self.staff, branch=self.branch)
        self.client = APIClient()

    def test_staff_cannot_access_super_admin_refund_review(self):
        self.client.force_authenticate(self.staff)

        response = self.client.get("/api/v1/payments/staff/refunds/")

        self.assertEqual(response.status_code, 403)

    @patch("apps.payments.services.get_payment_provider")
    def test_super_admin_approves_only_the_adjustment_difference(self, get_provider):
        get_provider.side_effect = ImproperlyConfigured("Provider credentials are not configured.")
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            f"/api/v1/payments/staff/refunds/{self.order.order_number}/approve-adjustment/",
            {},
            format="json",
        )

        self.order.refresh_from_db()
        refund = Refund.objects.get(payment=self.payment)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(refund.amount_minor, 250)
        self.assertEqual(refund.status, Refund.Status.REQUESTED)
        self.assertFalse(self.order.refund_review_required)
