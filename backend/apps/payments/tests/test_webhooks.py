import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.branches.models import Branch, BranchPaymentAccount, DeliveryZone
from apps.orders.models import CustomerOrder
from apps.payments.models import Payment, PaymentAttempt, PaymentWebhookEvent, Refund
from apps.payments.providers import PaymentProviderError
from apps.payments.services import (
    initiate_payment,
    process_hubtel_webhook,
    request_admin_refund,
)


class MockHubtelProvider:
    def __init__(self, valid=True):
        self.valid = valid

    def verify_webhook(self, raw_body, headers):
        return self.valid

    def initiate(self, payment, attempt, *, customer_name, phone, email):
        return {
            "checkout_url": "https://checkout.example.test/session",
            "provider_reference": f"provider-{attempt.idempotency_key}",
        }

    def refund(self, refund):
        return "hubtel-refund-1"


class HubtelWebhookTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="payment-customer",
            phone="+233550000222",
            password="test-password",
        )
        cls.branch = Branch.objects.get(slug="dome")
        cls.zone = DeliveryZone.objects.create(branch=cls.branch, name="Payment test zone")
        cls.order = CustomerOrder.objects.create(
            user=cls.user,
            branch=cls.branch,
            delivery_zone=cls.zone,
            subtotal_minor=1000,
            total_amount_minor=1000,
        )
        cls.account = BranchPaymentAccount.objects.create(
            branch=cls.branch,
            provider=BranchPaymentAccount.Provider.HUBTEL,
            provider_account_id="hubtel-webhook-test",
            momo_business_line="+233550000001",
            credentials_secret_ref="secret://payments/test",
            is_enabled=True,
            settlement_verified=True,
        )
        cls.payment = Payment.objects.create(
            order=cls.order,
            branch_payment_account=cls.account,
            provider=BranchPaymentAccount.Provider.HUBTEL,
            amount_minor=1000,
            currency="GHS",
            merchant_idempotency_reference=f"order-{cls.order.order_number}".lower(),
        )
        cls.attempt = PaymentAttempt.objects.create(
            payment=cls.payment,
            idempotency_key="attempt-idempotency-0001",
        )

    def payload(self):
        return {
            "eventId": "hubtel-event-1",
            "clientReference": self.attempt.idempotency_key,
            "transactionId": "hubtel-transaction-1",
            "status": "success",
            "totalAmount": "10.00",
            "currency": "GHS",
        }

    @patch("apps.payments.services.get_payment_provider")
    def test_mobile_money_payment_attempt_is_idempotent(self, get_provider):
        get_provider.return_value = MockHubtelProvider()
        order = CustomerOrder.objects.create(
            user=self.user,
            branch=self.branch,
            delivery_zone=self.zone,
            subtotal_minor=1200,
            total_amount_minor=1200,
        )

        payment, attempt = initiate_payment(
            order=order,
            user=self.user,
            method=Payment.Method.MOBILE_MONEY,
            network="mtn",
            idempotency_key="payment-attempt-0002",
        )
        duplicate_payment, duplicate_attempt = initiate_payment(
            order=order,
            user=self.user,
            method=Payment.Method.MOBILE_MONEY,
            network="mtn",
            idempotency_key="payment-attempt-0002",
        )

        self.assertEqual(payment.pk, duplicate_payment.pk)
        self.assertEqual(attempt.pk, duplicate_attempt.pk)
        self.assertEqual(attempt.status, PaymentAttempt.Status.PENDING)
        self.assertEqual(attempt.checkout_url, "https://checkout.example.test/session")
        get_provider.assert_called_once()

    @patch("apps.payments.services.get_payment_provider")
    def test_card_method_creates_a_hosted_checkout_attempt(self, get_provider):
        get_provider.return_value = MockHubtelProvider()
        order = CustomerOrder.objects.create(
            user=self.user,
            branch=self.branch,
            delivery_zone=self.zone,
            subtotal_minor=1500,
            total_amount_minor=1500,
        )

        payment, attempt = initiate_payment(
            order=order,
            user=self.user,
            method=Payment.Method.CARD,
            idempotency_key="payment-attempt-card-01",
        )

        self.assertEqual(payment.method, Payment.Method.CARD)
        self.assertEqual(attempt.status, PaymentAttempt.Status.PENDING)

    @patch("apps.payments.services.get_payment_provider")
    def test_verified_webhook_marks_payment_and_order_paid(self, get_provider):
        get_provider.return_value = MockHubtelProvider()
        raw_body = json.dumps(self.payload()).encode()

        result = process_hubtel_webhook(
            raw_body=raw_body,
            payload=self.payload(),
            headers={},
        )

        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertFalse(result["duplicate"])
        self.assertEqual(self.payment.status, Payment.Status.SUCCEEDED)
        self.assertEqual(self.order.status, CustomerOrder.Status.CONFIRMED)
        self.assertIsNotNone(self.order.paid_at)
        self.assertEqual(PaymentWebhookEvent.objects.count(), 1)

    @patch("apps.payments.services.get_payment_provider")
    def test_duplicate_webhook_is_idempotent(self, get_provider):
        get_provider.return_value = MockHubtelProvider()
        raw_body = json.dumps(self.payload()).encode()
        process_hubtel_webhook(raw_body=raw_body, payload=self.payload(), headers={})

        result = process_hubtel_webhook(
            raw_body=raw_body,
            payload=self.payload(),
            headers={},
        )

        self.assertTrue(result["duplicate"])
        self.assertEqual(PaymentWebhookEvent.objects.count(), 1)

    @patch("apps.payments.services.get_payment_provider")
    def test_invalid_signature_never_marks_payment_paid(self, get_provider):
        get_provider.return_value = MockHubtelProvider(valid=False)

        with self.assertRaises(PermissionDenied):
            process_hubtel_webhook(
                raw_body=b'{"invalid":"signature"}',
                payload=self.payload(),
                headers={},
            )

        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertNotEqual(self.payment.status, Payment.Status.SUCCEEDED)
        self.assertEqual(self.order.status, CustomerOrder.Status.AWAITING_PAYMENT)
        self.assertEqual(PaymentWebhookEvent.objects.count(), 0)

    @patch("apps.payments.services.get_payment_provider")
    def test_late_payment_on_expired_order_can_be_refunded_by_admin(self, get_provider):
        get_provider.return_value = MockHubtelProvider()
        self.order.status = CustomerOrder.Status.EXPIRED
        self.order.expired_at = timezone.now()
        self.order.save(update_fields=("status", "expired_at"))
        payload = self.payload()
        payload["eventId"] = "late-payment-event"
        process_hubtel_webhook(
            raw_body=json.dumps(payload).encode(),
            payload=payload,
            headers={},
        )
        admin = get_user_model().objects.create_superuser(
            username="late-payment-refund-admin",
            phone="+233550000993",
            password="test-password",
        )

        order = request_admin_refund(self.order, admin, "Late payment after expiry")

        self.payment.refresh_from_db()
        self.assertEqual(order.status, CustomerOrder.Status.CANCELLED)
        self.assertEqual(
            Refund.objects.get(payment=self.payment).status,
            Refund.Status.PENDING,
        )
        self.assertEqual(self.payment.status, Payment.Status.REFUND_PENDING)

    @patch("apps.payments.services.get_payment_provider")
    def test_webhook_amount_mismatch_is_rejected(self, get_provider):
        get_provider.return_value = MockHubtelProvider()
        payload = self.payload()
        payload["totalAmount"] = "9.99"

        from rest_framework.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            process_hubtel_webhook(
                raw_body=json.dumps(payload).encode(),
                payload=payload,
                headers={},
            )

        self.payment.refresh_from_db()
        self.assertNotEqual(self.payment.status, Payment.Status.SUCCEEDED)

    @patch("apps.payments.services.get_payment_provider")
    def test_admin_refund_is_recorded_and_confirmed_by_signed_webhook(self, get_provider):
        get_provider.return_value = MockHubtelProvider()
        admin = get_user_model().objects.create_superuser(
            username="refund-super-admin",
            phone="+233550000991",
            password="test-password",
        )
        self.order.status = CustomerOrder.Status.CONFIRMED
        self.order.paid_at = timezone.now()
        self.order.save(update_fields=("status", "paid_at"))
        self.payment.status = Payment.Status.SUCCEEDED
        self.payment.provider_reference = "hubtel-original-payment"
        self.payment.save(update_fields=("status", "provider_reference"))

        order = request_admin_refund(self.order, admin, "Customer service approved refund")
        refund = Refund.objects.get(payment=self.payment)
        payload = {
            "eventId": "hubtel-refund-event-1",
            "refundReference": refund.provider_reference,
            "status": "success",
            "amount": "10.00",
            "currency": "GHS",
        }

        process_hubtel_webhook(
            raw_body=json.dumps(payload).encode(),
            payload=payload,
            headers={},
        )

        self.payment.refresh_from_db()
        refund.refresh_from_db()
        self.assertEqual(order.status, CustomerOrder.Status.CANCELLED)
        self.assertEqual(refund.status, Refund.Status.SUCCEEDED)
        self.assertEqual(self.payment.status, Payment.Status.REFUNDED)

    @patch("apps.payments.services.get_payment_provider")
    def test_refund_provider_error_is_persisted_for_admin_retry(self, get_provider):
        class FailingRefundProvider(MockHubtelProvider):
            def refund(self, refund):
                raise PaymentProviderError("Refund endpoint is unavailable.")

        get_provider.return_value = FailingRefundProvider()
        admin = get_user_model().objects.create_superuser(
            username="refund-error-admin",
            phone="+233550000992",
            password="test-password",
        )
        self.order.status = CustomerOrder.Status.CONFIRMED
        self.order.paid_at = timezone.now()
        self.order.save(update_fields=("status", "paid_at"))
        self.payment.status = Payment.Status.SUCCEEDED
        self.payment.provider_reference = "hubtel-original-payment"
        self.payment.save(update_fields=("status", "provider_reference"))

        order = request_admin_refund(self.order, admin, "Refund requested")
        refund = Refund.objects.get(payment=self.payment)
        self.payment.refresh_from_db()
        self.assertEqual(order.status, CustomerOrder.Status.CANCELLED)
        self.assertEqual(refund.status, Refund.Status.REQUESTED)
        self.assertTrue(refund.last_error)
        self.assertEqual(self.payment.status, Payment.Status.REFUND_PENDING)
