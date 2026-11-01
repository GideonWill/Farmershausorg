from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.baskets.models import BasketPackage
from apps.branches.models import Branch
from apps.cart.models import Cart, CartItem
from apps.catalogue.models import Category, Product


class CartItemConstraintTests(TestCase):
    def test_cart_item_must_reference_exactly_one_sellable(self):
        cart = Cart.objects.create(
            branch=Branch.objects.get(slug="dome"),
            guest_session_key="test-guest-session",
        )
        category = Category.objects.create(slug="fruit", name="Fruit")
        product = Product.objects.create(
            sku="ORANGE-001",
            slug="oranges",
            category=category,
            name="Oranges",
            unit="kg",
            base_price_minor=900,
        )
        basket = BasketPackage.objects.create(
            sku="FRUIT-BASKET-001",
            slug="fruit-basket",
            name="Fruit basket",
            base_price_minor=2500,
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            CartItem.objects.create(cart=cart, quantity=1)

        with self.assertRaises(IntegrityError), transaction.atomic():
            CartItem.objects.create(
                cart=cart,
                product=product,
                basket_package=basket,
                quantity=1,
            )
