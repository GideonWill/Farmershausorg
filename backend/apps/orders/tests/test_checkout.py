from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.baskets.models import BasketComponent, BasketPackage
from apps.branches.models import Branch, DeliveryZone
from apps.cart.models import Cart, CartItem
from apps.catalogue.models import Category, Product
from apps.inventory.models import ProductBranch, StockReservation
from apps.orders.models import CustomerAddress, CustomerOrder, FulfillmentSlot
from apps.orders.services import (
    consume_order_reservations,
    create_order,
    release_order_reservations,
)
from apps.orders.tasks import expire_order_reservation
from apps.vouchers.models import Voucher, VoucherUsage


class CheckoutReservationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="checkout-customer",
            phone="+233550000111",
            password="test-password",
        )
        cls.branch = Branch.objects.get(slug="dome")
        cls.zone = DeliveryZone.objects.create(
            branch=cls.branch,
            name="Checkout test zone",
            delivery_fee_minor=300,
            minimum_order_minor=0,
        )
        cls.category, _ = Category.objects.get_or_create(
            slug="checkout-test",
            defaults={"name": "Checkout test"},
        )
        cls.product = Product.objects.create(
            sku="CHECKOUT-ITEM",
            slug="checkout-item",
            category=cls.category,
            name="Checkout test item",
            unit="each",
            base_price_minor=500,
        )
        cls.inventory = ProductBranch.objects.create(
            branch=cls.branch,
            product=cls.product,
            stock_on_hand=10,
            is_available=True,
        )
        cls.address = CustomerAddress.objects.create(
            user=cls.user,
            recipient_name="Checkout Customer",
            phone=cls.user.phone,
            address_line_1="1 Test Road",
            area="Dome",
        )
        starts_at = timezone.now() + timedelta(hours=2)
        cls.slot = FulfillmentSlot.objects.create(
            branch=cls.branch,
            method=FulfillmentSlot.Method.DELIVERY,
            starts_at=starts_at,
            ends_at=starts_at + timedelta(hours=1),
            capacity=2,
        )

    def create_cart(self, quantity=2):
        cart = Cart.objects.create(user=self.user, branch=self.branch)
        CartItem.objects.create(cart=cart, product=self.product, quantity=quantity)
        return cart

    def checkout(self, cart):
        return create_order(
            cart_id=cart.pk,
            user=self.user,
            branch_id=self.branch.pk,
            fulfillment_method=CustomerOrder.FulfillmentMethod.DELIVERY,
            address_id=self.address.pk,
            delivery_zone_id=self.zone.pk,
            slot_id=self.slot.pk,
        )

    def test_checkout_snapshots_price_and_reserves_stock_until_cancelled(self):
        cart = self.create_cart()

        order = self.checkout(cart)

        self.inventory.refresh_from_db()
        cart.refresh_from_db()
        self.assertEqual(order.subtotal_minor, 1000)
        self.assertEqual(order.delivery_fee_minor, 300)
        self.assertEqual(order.total_amount_minor, 1300)
        self.assertEqual(self.inventory.reserved_quantity, 2)
        self.assertEqual(cart.status, Cart.Status.CONVERTED)
        self.assertEqual(
            StockReservation.objects.get(order=order).status,
            StockReservation.Status.ACTIVE,
        )

        release_order_reservations(
            order,
            final_status=CustomerOrder.Status.CANCELLED,
            actor=self.user,
            note="Customer cancelled before payment.",
        )

        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.reserved_quantity, 0)
        self.assertEqual(order.status_history.count(), 2)

    def test_checkout_rejects_insufficient_stock_without_partial_reservation(self):
        cart = self.create_cart(quantity=11)

        with self.assertRaises(ValidationError):
            self.checkout(cart)

        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.reserved_quantity, 0)
        self.assertFalse(CustomerOrder.objects.exists())

    def test_checkout_rejects_a_full_fulfillment_slot(self):
        cart = self.create_cart()
        self.slot.capacity = 1
        self.slot.save(update_fields=("capacity",))
        existing = CustomerOrder.objects.create(
            user=self.user,
            branch=self.branch,
            delivery_zone=self.zone,
            fulfillment_method=CustomerOrder.FulfillmentMethod.DELIVERY,
            fulfillment_slot=self.slot,
            subtotal_minor=1000,
            total_amount_minor=1000,
        )

        with self.assertRaises(ValidationError):
            self.checkout(cart)

        self.assertEqual(existing.status, CustomerOrder.Status.AWAITING_PAYMENT)

    def test_paid_order_consumes_reserved_stock(self):
        order = self.checkout(self.create_cart())

        consume_order_reservations(order)

        self.inventory.refresh_from_db()
        reservation = StockReservation.objects.get(order=order)
        self.assertEqual(self.inventory.stock_on_hand, 8)
        self.assertEqual(self.inventory.reserved_quantity, 0)
        self.assertEqual(reservation.status, StockReservation.Status.CONSUMED)

    def test_expiry_task_releases_stock_and_expires_order(self):
        order = self.checkout(self.create_cart())
        reservation = StockReservation.objects.get(order=order)
        reservation.expires_at = timezone.now() - timedelta(minutes=1)
        reservation.save(update_fields=("expires_at",))

        expire_order_reservation.run(str(order.pk))

        order.refresh_from_db()
        self.inventory.refresh_from_db()
        reservation.refresh_from_db()
        self.assertEqual(order.status, CustomerOrder.Status.EXPIRED)
        self.assertEqual(self.inventory.reserved_quantity, 0)
        self.assertEqual(reservation.status, StockReservation.Status.EXPIRED)

    def test_basket_checkout_reserves_components_and_snapshots_gift_details(self):
        package = BasketPackage.objects.create(
            sku="CHECKOUT-BASKET",
            slug="checkout-basket",
            name="Checkout basket",
            base_price_minor=1200,
            gift_message_allowed=True,
        )
        BasketComponent.objects.create(
            basket_package=package,
            product=self.product,
            quantity=2,
        )
        cart = Cart.objects.create(user=self.user, branch=self.branch)
        CartItem.objects.create(
            cart=cart,
            basket_package=package,
            quantity=2,
            gift_recipient_name="Gift recipient",
            gift_message="Enjoy!",
        )

        order = self.checkout(cart)

        reservation = StockReservation.objects.get(order=order)
        line = order.lines.get()
        self.assertEqual(reservation.quantity, 4)
        self.assertEqual(line.gift_recipient_name, "Gift recipient")
        self.assertEqual(line.gift_message, "Enjoy!")
        self.assertEqual(line.components.get().quantity, 4)

    def test_checkout_reserves_voucher_use_and_cancellation_releases_it(self):
        now = timezone.now()
        voucher = Voucher.objects.create(
            code="checkout-save",
            discount_type=Voucher.DiscountType.FIXED,
            fixed_amount_minor=100,
            starts_at=now - timedelta(minutes=1),
            ends_at=now + timedelta(hours=1),
            total_usage_limit=1,
            per_customer_usage_limit=1,
        )
        voucher.products.add(self.product)

        order = create_order(
            cart_id=self.create_cart().pk,
            user=self.user,
            branch_id=self.branch.pk,
            fulfillment_method=CustomerOrder.FulfillmentMethod.DELIVERY,
            address_id=self.address.pk,
            delivery_zone_id=self.zone.pk,
            slot_id=self.slot.pk,
            voucher_code="checkout-save",
        )

        usage = VoucherUsage.objects.get(order=order)
        self.assertEqual(order.discount_minor, 100)
        self.assertEqual(usage.status, VoucherUsage.Status.RESERVED)
        release_order_reservations(
            order,
            final_status=CustomerOrder.Status.CANCELLED,
            actor=self.user,
            note="Cancelled before payment.",
        )
        usage.refresh_from_db()
        self.assertEqual(usage.status, VoucherUsage.Status.RELEASED)
