from rest_framework.test import APITestCase

from apps.baskets.models import BasketComponent, BasketPackage
from apps.branches.models import Branch
from apps.catalogue.models import Category, Product
from apps.inventory.models import ProductBranch


class BasketPackageApiTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.get(slug="dome")
        category = Category.objects.create(slug="basket-fruit", name="Fruit")
        self.product = Product.objects.create(
            sku="BANANA-001",
            slug="bananas",
            category=category,
            name="Bananas",
            unit="kg",
            base_price_minor=800,
        )
        self.basket = BasketPackage.objects.create(
            sku="FRUIT-BASKET-001",
            slug="fruit-basket",
            name="Fruit basket",
            base_price_minor=2500,
        )
        BasketComponent.objects.create(
            basket_package=self.basket,
            product=self.product,
            quantity=2,
        )

    def test_basket_availability_uses_selected_branch_stock(self):
        ProductBranch.objects.create(
            branch=self.branch,
            product=self.product,
            stock_on_hand=2,
        )

        response = self.client.get(f"/api/v1/basket-packages/?branch={self.branch.pk}")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data[0]["branch_availability"]["is_available"])

    def test_basket_is_unavailable_when_a_required_component_is_missing(self):
        response = self.client.get(f"/api/v1/basket-packages/?branch={self.branch.pk}")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data[0]["branch_availability"]["is_available"])
