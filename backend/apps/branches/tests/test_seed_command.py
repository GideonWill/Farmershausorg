from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import BranchMembership, User
from apps.baskets.models import BasketComponent, BasketPackage
from apps.branches.models import Branch
from apps.catalogue.models import Product
from apps.inventory.models import ProductBranch


class DemoSeedCommandTests(TestCase):
    @override_settings(DEBUG=True)
    def test_seed_command_is_repeatable_and_creates_branch_stock_and_role_users(self):
        password = "Seed-Only-Password-2026!"
        admin_basket = BasketPackage.objects.create(
            sku="FH-ADMIN-BASKET",
            slug="admin-created-basket",
            name="Admin-created basket",
            base_price_minor=1234,
        )

        call_command("seed_demo_data", password=password, verbosity=0)
        call_command("seed_demo_data", password=password, verbosity=0)

        self.assertEqual(Branch.objects.count(), 4)
        self.assertGreaterEqual(Product.objects.count(), 50)
        self.assertEqual(
            ProductBranch.objects.count(),
            Branch.objects.count() * Product.objects.count(),
        )
        self.assertEqual(
            BasketPackage.objects.filter(sku__startswith="FH-DEMO-BASKET-").count(),
            5,
        )
        fruit_basket = BasketPackage.objects.get(sku="FH-DEMO-BASKET-FRUIT")
        self.assertEqual(fruit_basket.base_price_minor, 7500)
        self.assertEqual(
            BasketComponent.objects.filter(basket_package=fruit_basket).count(),
            5,
        )
        response = APIClient().get(
            f"/api/v1/basket-packages/?branch={Branch.objects.get(slug='dome').pk}"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 6)
        seeded_baskets = [
            basket for basket in response.data
            if basket["sku"].startswith("FH-DEMO-BASKET-")
        ]
        self.assertEqual(len(seeded_baskets), 5)
        self.assertTrue(all(basket["components"] for basket in seeded_baskets))
        self.assertTrue(
            all(basket["branch_availability"]["is_available"] for basket in seeded_baskets)
        )
        self.assertIn(admin_basket.slug, {basket["slug"] for basket in response.data})
        self.assertEqual(
            set(User.objects.filter(username__startswith="demo-").values_list("username", flat=True)),
            {
                "demo-customer",
                "demo-staff",
                "demo-manager",
                "demo-super-admin",
            },
        )
        self.assertEqual(
            BranchMembership.objects.filter(user__username__startswith="demo-").count(),
            2,
        )
