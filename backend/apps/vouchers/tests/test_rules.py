from datetime import timedelta
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.branches.models import Branch, DeliveryZone
from apps.catalogue.models import Category, Product
from apps.orders.models import CustomerOrder
from apps.vouchers.models import Voucher, VoucherUsage
from apps.orders.services import _calculate_voucher


class VoucherRuleTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="voucher-customer",
            phone="+233550000333",
            password="test-password",
        )
        cls.branch = Branch.objects.get(slug="dome")
        cls.other_branch = Branch.objects.get(slug="westland")
        cls.category, _ = Category.objects.get_or_create(
            slug="voucher-test",
            defaults={"name": "Voucher test"},
        )
        cls.product = Product.objects.create(
            sku="VOUCHER-ITEM",
            slug="voucher-item",
            category=cls.category,
            name="Voucher test item",
            unit="each",
            base_price_minor=500,
        )

    def create_voucher(self, **overrides):
        now = timezone.now()
        fields = {
            "code": "test-code",
            "discount_type": Voucher.DiscountType.FIXED,
            "fixed_amount_minor": 150,
            "starts_at": now - timedelta(minutes=5),
            "ends_at": now + timedelta(hours=1),
        }
        fields.update(overrides)
        return Voucher.objects.create(**fields)

    def test_fixed_discount_applies_to_eligible_product_subtotal(self):
        voucher = self.create_voucher()
        voucher.products.add(self.product)
        line = SimpleNamespace(product_id=self.product.pk, basket_package_id=None)

        discount, eligible_subtotal = _calculate_voucher(
            voucher,
            self.user,
            self.branch,
            [(line, 500)],
            500,
        )

        self.assertEqual(discount, 150)
        self.assertEqual(eligible_subtotal, 500)

    def test_voucher_rejects_wrong_branch_scope(self):
        voucher = self.create_voucher()
        voucher.branches.add(self.other_branch)
        line = SimpleNamespace(product_id=self.product.pk, basket_package_id=None)

        with self.assertRaises(ValidationError) as error:
            _calculate_voucher(voucher, self.user, self.branch, [(line, 500)], 500)

        self.assertEqual(error.exception.detail["voucher"]["code"], "branch_not_applicable")

    def test_percentage_discount_respects_cap(self):
        voucher = self.create_voucher(
            code="percentage-test",
            discount_type=Voucher.DiscountType.PERCENT,
            fixed_amount_minor=0,
            percent_basis_points=5000,
            maximum_discount_minor=100,
        )
        line = SimpleNamespace(product_id=self.product.pk, basket_package_id=None)

        discount, eligible_subtotal = _calculate_voucher(
            voucher,
            self.user,
            self.branch,
            [(line, 500)],
            500,
        )

        self.assertEqual((discount, eligible_subtotal), (100, 500))

    def test_customer_usage_limit_counts_reserved_redemptions(self):
        voucher = self.create_voucher(
            code="customer-limit",
            per_customer_usage_limit=1,
        )
        order = CustomerOrder.objects.create(
            user=self.user,
            branch=self.branch,
            delivery_zone=DeliveryZone.objects.create(
                branch=self.branch,
                name="Voucher usage zone",
            ),
            subtotal_minor=500,
            total_amount_minor=500,
        )
        VoucherUsage.objects.create(
            voucher=voucher,
            user=self.user,
            order=order,
            amount_saved_minor=100,
            status=VoucherUsage.Status.RESERVED,
        )
        line = SimpleNamespace(product_id=self.product.pk, basket_package_id=None)

        with self.assertRaises(ValidationError) as error:
            _calculate_voucher(voucher, self.user, self.branch, [(line, 500)], 500)

        self.assertEqual(
            error.exception.detail["voucher"]["code"],
            "customer_usage_limit_reached",
        )
