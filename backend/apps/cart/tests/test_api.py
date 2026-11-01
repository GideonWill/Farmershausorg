import uuid

from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.branches.models import Branch
from apps.cart.models import Cart
from apps.cart.models import CartItem
from apps.catalogue.models import Category, Product
from apps.inventory.models import ProductBranch


class CartApiTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.get(slug="dome")
        self.other_branch = Branch.objects.get(slug="westland")
        category = Category.objects.create(slug="cart-vegetables", name="Vegetables")
        self.product = Product.objects.create(
            sku="CART-CARROT-001",
            slug="cart-carrots",
            category=category,
            name="Carrots",
            unit="kg",
            base_price_minor=1200,
        )
        self.other_product = Product.objects.create(
            sku="CART-PEPPER-001",
            slug="cart-pepper",
            category=category,
            name="Pepper",
            unit="pack",
            base_price_minor=800,
        )
        ProductBranch.objects.create(
            branch=self.branch,
            product=self.product,
            stock_on_hand=2,
            price_override_minor=1400,
        )
        self.guest_key = str(uuid.uuid4())

    def add_product(self, product=None, quantity=1, **headers):
        return self.client.post(
            "/api/v1/cart/items/",
            {
                "branch_id": str(self.branch.pk),
                "product_id": str((product or self.product).pk),
                "quantity": quantity,
            },
            format="json",
            HTTP_X_CART_SESSION=self.guest_key,
            **headers,
        )

    def test_guest_cart_is_branch_scoped_and_adds_items(self):
        first = self.add_product()
        second = self.add_product(quantity=2)
        read = self.client.get(
            f"/api/v1/cart/?branch={self.branch.pk}",
            HTTP_X_CART_SESSION=self.guest_key,
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(read.status_code, 200)
        cart = read.data["cart"]
        self.assertEqual(len(cart["items"]), 1)
        self.assertEqual(cart["items"][0]["quantity"], 3)
        self.assertEqual(cart["items"][0]["product"]["unit_price_minor"], 1400)

    def test_validation_reports_missing_and_insufficient_branch_stock(self):
        self.add_product(quantity=3)
        self.add_product(product=self.other_product)
        cart = self.client.get(
            f"/api/v1/cart/?branch={self.branch.pk}",
            HTTP_X_CART_SESSION=self.guest_key,
        ).data["cart"]

        response = self.client.post(
            "/api/v1/cart/validate/",
            {"cart_id": cart["id"], "branch_id": str(self.branch.pk)},
            format="json",
            HTTP_X_CART_SESSION=self.guest_key,
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["is_valid"])
        self.assertEqual(
            {item["reason"] for item in response.data["unavailable_items"]},
            {"insufficient_stock", "unavailable"},
        )

    def test_cart_validation_flags_a_branch_change(self):
        self.add_product()
        cart = self.client.get(
            f"/api/v1/cart/?branch={self.branch.pk}",
            HTTP_X_CART_SESSION=self.guest_key,
        ).data["cart"]

        response = self.client.post(
            "/api/v1/cart/validate/",
            {"cart_id": cart["id"], "branch_id": str(self.other_branch.pk)},
            format="json",
            HTTP_X_CART_SESSION=self.guest_key,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["unavailable_items"][0]["reason"],
            "branch_mismatch",
        )

    def test_guest_cart_requires_a_valid_session_key(self):
        response = self.client.post(
            "/api/v1/cart/items/",
            {
                "branch_id": str(self.branch.pk),
                "product_id": str(self.product.pk),
                "quantity": 1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_login_merges_guest_cart_into_customer_cart(self):
        self.add_product(quantity=2)
        user = User.objects.create_user(
            username="cart-owner",
            phone="+233554208448",
            password="Random-Password-93!",
        )
        token = self.client.post(
            "/api/v1/auth/token/",
            {"identifier": user.phone, "password": "Random-Password-93!"},
            format="json",
            HTTP_X_CART_SESSION=self.guest_key,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.data['access']}")
        cart_response = self.client.get(f"/api/v1/cart/?branch={self.branch.pk}")

        guest_cart = Cart.objects.get(guest_session_key__isnull=True, status=Cart.Status.ABANDONED)
        self.assertEqual(token.status_code, 200)
        self.assertEqual(cart_response.status_code, 200)
        self.assertEqual(cart_response.data["cart"]["items"][0]["quantity"], 2)
        self.assertIsNotNone(guest_cart.updated_at)

    def test_login_rejects_a_merge_that_would_exceed_the_item_limit(self):
        self.add_product(quantity=500)
        user = User.objects.create_user(
            username="cart-limit-owner",
            phone="+233554208449",
            password="Random-Password-93!",
        )
        CartItem.objects.create(
            cart=Cart.objects.create(user=user, branch=self.branch),
            product=self.product,
            quantity=500,
        )

        response = self.client.post(
            "/api/v1/auth/token/",
            {"identifier": user.phone, "password": "Random-Password-93!"},
            format="json",
            HTTP_X_CART_SESSION=self.guest_key,
        )

        guest_cart = Cart.objects.get(guest_session_key=self.guest_key)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(guest_cart.items.get(product=self.product).quantity, 500)
