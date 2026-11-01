from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.branches.models import Branch
from apps.catalogue.models import Category, Product
from apps.inventory.models import ProductBranch


class ProductBranchTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.get(slug="dome")
        category = Category.objects.create(slug="fruit", name="Fruit")
        self.product = Product.objects.create(
            sku="APPLE-001",
            slug="apples",
            category=category,
            name="Apples",
            unit="kg",
            base_price_minor=1200,
        )

    def test_available_quantity_and_branch_price_override(self):
        inventory = ProductBranch.objects.create(
            branch=self.branch,
            product=self.product,
            stock_on_hand=8,
            reserved_quantity=3,
            price_override_minor=1500,
        )

        self.assertEqual(inventory.available_quantity, 5)
        self.assertEqual(inventory.effective_price_minor, 1500)

    def test_reserved_quantity_cannot_exceed_branch_stock(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            ProductBranch.objects.create(
                branch=self.branch,
                product=self.product,
                stock_on_hand=2,
                reserved_quantity=3,
            )
