from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.branches.models import Branch, BranchPaymentAccount, DeliveryZone
from apps.orders.models import CustomerOrder
from apps.payments.models import Payment


class PaymentConfigurationTests(TestCase):
    def test_payment_must_match_order_and_branch_account(self):
        branch = Branch.objects.get(slug="dome")
        zone = DeliveryZone.objects.create(branch=branch, name="Dome")
        order = CustomerOrder.objects.create(
            branch=branch,
            delivery_zone=zone,
            subtotal_minor=1000,
            total_amount_minor=1000,
        )
        account = BranchPaymentAccount.objects.create(
            branch=branch,
            provider=BranchPaymentAccount.Provider.HUBTEL,
            provider_account_id="hubtel-dome",
            momo_business_line="+233550000001",
            credentials_secret_ref="secret://payments/dome",
        )
        payment = Payment(
            order=order,
            branch_payment_account=account,
            provider=BranchPaymentAccount.Provider.PAYSTACK,
            amount_minor=900,
            currency="USD",
            merchant_idempotency_reference="order-dome-test",
        )

        with self.assertRaises(ValidationError) as error:
            payment.full_clean()

        self.assertIn("provider", error.exception.message_dict)
        self.assertIn("amount_minor", error.exception.message_dict)
        self.assertIn("currency", error.exception.message_dict)
