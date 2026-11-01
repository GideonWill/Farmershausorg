from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.branches.models import Branch, DeliveryZone
from apps.orders.models import CustomerOrder


class OrderAmountConstraintTests(TestCase):
    def test_delivery_zone_must_match_order_branch(self):
        dome = Branch.objects.get(slug="dome")
        east_legon = Branch.objects.get(slug="east-legon")
        east_legon_zone = DeliveryZone.objects.create(branch=east_legon, name="East Legon")
        order = CustomerOrder(
            branch=dome,
            delivery_zone=east_legon_zone,
            subtotal_minor=1000,
            total_amount_minor=1000,
        )

        with self.assertRaises(ValidationError) as error:
            order.full_clean()

        self.assertIn("delivery_zone", error.exception.message_dict)

    def test_total_must_match_snapshotted_amounts(self):
        branch = Branch.objects.get(slug="dome")
        delivery_zone = DeliveryZone.objects.create(
            branch=branch,
            name="Dome",
            delivery_fee_minor=500,
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            CustomerOrder.objects.create(
                branch=branch,
                delivery_zone=delivery_zone,
                subtotal_minor=1000,
                delivery_fee_minor=500,
                discount_minor=100,
                total_amount_minor=1200,
            )
