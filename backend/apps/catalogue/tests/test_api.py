from rest_framework.test import APITestCase

from apps.branches.models import Branch
from apps.catalogue.models import Category, Product, ProductTag
from apps.inventory.models import ProductBranch


class ProductApiTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.get(slug="dome")
        category = Category.objects.create(slug="vegetables", name="Vegetables")
        self.product = Product.objects.create(
            sku="CARROT-001",
            slug="carrots",
            category=category,
            name="Carrots",
            unit="kg",
            base_price_minor=1200,
        )

    def test_price_and_availability_are_resolved_for_selected_branch(self):
        ProductBranch.objects.create(
            branch=self.branch,
            product=self.product,
            stock_on_hand=6,
            price_override_minor=1500,
        )

        response = self.client.get(f"/api/v1/products/?branch={self.branch.pk}")

        self.assertEqual(response.status_code, 200)
        product = response.data["results"][0]
        self.assertEqual(product["branch_availability"]["price_minor"], 1500)
        self.assertTrue(product["branch_availability"]["is_available"])
        self.assertEqual(product["branch_availability"]["available_quantity"], 6)

    def test_branch_is_required_and_must_be_active(self):
        missing_branch = self.client.get("/api/v1/products/")
        invalid_branch = self.client.get("/api/v1/products/?branch=unknown")

        self.assertEqual(missing_branch.status_code, 400)
        self.assertEqual(invalid_branch.status_code, 400)

    def test_unavailable_product_lists_available_alternative_branches(self):
        dome = self.branch
        westland = Branch.objects.get(slug="westland")
        ProductBranch.objects.create(
            branch=dome,
            product=self.product,
            stock_on_hand=0,
            is_available=True,
        )
        ProductBranch.objects.create(
            branch=westland,
            product=self.product,
            stock_on_hand=5,
            is_available=True,
            price_override_minor=1700,
        )

        response = self.client.get(f"/api/v1/products/?branch={dome.pk}")

        self.assertEqual(response.status_code, 200)
        product = response.data["results"][0]
        self.assertFalse(product["branch_availability"]["is_available"])
        self.assertEqual(product["branch_availability"]["available_quantity"], 0)
        self.assertEqual(product["available_at_other_branches"][0]["slug"], "westland")
        self.assertEqual(product["available_at_other_branches"][0]["price_minor"], 1700)
        self.assertNotIn("stock_on_hand", product["available_at_other_branches"][0])

    def test_catalogue_search_filter_and_suggestions_use_product_tags(self):
        organic = ProductTag.objects.create(slug="organic", name="Organic")
        self.product.name = "Organic Carrots"
        self.product.save(update_fields=("name", "updated_at"))
        self.product.tags.add(organic)
        ProductBranch.objects.create(
            branch=self.branch,
            product=self.product,
            stock_on_hand=3,
        )

        filtered = self.client.get(
            f"/api/v1/products/?branch={self.branch.pk}&organic=true&ordering=-price"
        )
        suggestions = self.client.get(
            f"/api/v1/search/suggestions/?branch={self.branch.pk}&q=car"
        )

        self.assertEqual(filtered.status_code, 200)
        self.assertEqual(filtered.data["results"][0]["tags"], ["organic"])
        self.assertEqual(suggestions.status_code, 200)
        self.assertEqual(suggestions.data["results"][0]["slug"], "carrots")

    def test_catalogue_loads_all_products_when_boolean_filters_omitted(self):
        organic = ProductTag.objects.create(slug="organic", name="Organic")
        in_season = ProductTag.objects.create(slug="in-season", name="In season")

        organic_product = Product.objects.create(
            sku="PINEAPPLE-001",
            slug="pineapple",
            category=self.product.category,
            name="Pineapple",
            unit="each",
            base_price_minor=1200,
        )
        organic_product.tags.add(organic, in_season)

        season_product = Product.objects.create(
            sku="TOMATO-001",
            slug="tomatoes",
            category=self.product.category,
            name="Tomatoes",
            unit="kg",
            base_price_minor=1600,
        )
        season_product.tags.add(in_season)

        for prod in (self.product, organic_product, season_product):
            ProductBranch.objects.create(
                branch=self.branch,
                product=prod,
                stock_on_hand=5,
            )

        # Default query without organic/in_season filters must return all products
        response = self.client.get(f"/api/v1/products/?branch={self.branch.pk}")
        self.assertEqual(response.status_code, 200)
        returned_slugs = {p["slug"] for p in response.data["results"]}
        self.assertEqual(returned_slugs, {"carrots", "pineapple", "tomatoes"})

        # Filtering by organic=true must include organic products (even if in-season)
        res_org = self.client.get(f"/api/v1/products/?branch={self.branch.pk}&organic=true")
        self.assertEqual(res_org.status_code, 200)
        self.assertEqual({p["slug"] for p in res_org.data["results"]}, {"pineapple"})

        # Filtering by in_season=true must include in-season products (even if organic)
        res_season = self.client.get(f"/api/v1/products/?branch={self.branch.pk}&in_season=true")
        self.assertEqual(res_season.status_code, 200)
        self.assertEqual({p["slug"] for p in res_season.data["results"]}, {"pineapple", "tomatoes"})

        # Filtering by organic=false excludes organic products
        res_no_org = self.client.get(f"/api/v1/products/?branch={self.branch.pk}&organic=false")
        self.assertEqual(res_no_org.status_code, 200)
        self.assertEqual({p["slug"] for p in res_no_org.data["results"]}, {"carrots", "tomatoes"})

        # Filtering by in_season=false excludes in-season products
        res_no_season = self.client.get(f"/api/v1/products/?branch={self.branch.pk}&in_season=false")
        self.assertEqual(res_no_season.status_code, 200)
        self.assertEqual({p["slug"] for p in res_no_season.data["results"]}, {"carrots"})
