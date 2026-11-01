from collections import defaultdict
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.baskets.models import BasketComponent
from apps.cart.models import Cart, CartItem
from apps.content.models import SiteSettings
from apps.inventory.models import ProductBranch, StockReservation
from apps.orders.models import (
    CustomerAddress,
    CustomerOrder,
    FulfillmentSlot,
    OrderLine,
    OrderLineComponent,
    OrderStatusHistory,
)
from apps.vouchers.models import Voucher, VoucherUsage


def _branch_snapshot(branch):
    return {
        "id": str(branch.pk),
        "name": branch.name,
        "address": branch.address,
        "phone": branch.phone,
    }


def _address_snapshot(address):
    return {
        "recipient_name": address.recipient_name,
        "phone": address.phone,
        "address_line_1": address.address_line_1,
        "address_line_2": address.address_line_2,
        "area": address.area,
        "directions": address.directions,
        "latitude": str(address.latitude) if address.latitude is not None else None,
        "longitude": str(address.longitude) if address.longitude is not None else None,
    }


def _calculate_voucher(voucher, user, branch, line_values, subtotal):
    now = timezone.now()
    if not voucher.is_active or not voucher.starts_at <= now < voucher.ends_at:
        raise ValidationError({"voucher": {"code": "voucher_inactive"}})
    if voucher.branch_id and voucher.branch_id != branch.pk:
        raise ValidationError({"voucher": {"code": "branch_not_applicable"}})
    scoped_branch_ids = set(voucher.branches.values_list("pk", flat=True))
    if scoped_branch_ids and branch.pk not in scoped_branch_ids:
        raise ValidationError({"voucher": {"code": "branch_not_applicable"}})

    applicable_values = []
    product_ids = set(voucher.products.values_list("pk", flat=True))
    package_ids = set(voucher.basket_packages.values_list("pk", flat=True))
    for line, line_total in line_values:
        has_scoped_sellables = bool(product_ids or package_ids)
        if not has_scoped_sellables:
            applicable_values.append(line_total)
        elif line.product_id and line.product_id in product_ids:
            applicable_values.append(line_total)
        elif line.basket_package_id and line.basket_package_id in package_ids:
            applicable_values.append(line_total)
    eligible_subtotal = sum(applicable_values)
    if eligible_subtotal <= 0:
        raise ValidationError({"voucher": {"code": "no_applicable_items"}})
    if eligible_subtotal < voucher.minimum_spend_minor:
        raise ValidationError({"voucher": {"code": "minimum_spend_not_met"}})

    if voucher.discount_type == Voucher.DiscountType.FIXED:
        discount = min(voucher.fixed_amount_minor, eligible_subtotal)
    else:
        discount = eligible_subtotal * voucher.percent_basis_points // 10000
    if voucher.maximum_discount_minor is not None:
        discount = min(discount, voucher.maximum_discount_minor)
    discount = min(discount, eligible_subtotal, subtotal)
    if discount <= 0:
        raise ValidationError({"voucher": {"code": "no_discount"}})

    if voucher.total_usage_limit is not None:
        usage_count = voucher.usages.filter(
            status__in=(VoucherUsage.Status.RESERVED, VoucherUsage.Status.REDEEMED)
        ).count()
        if usage_count >= voucher.total_usage_limit:
            raise ValidationError({"voucher": {"code": "usage_limit_reached"}})
    if user and voucher.per_customer_usage_limit is not None:
        usage_count = voucher.usages.filter(
            user=user,
            status__in=(VoucherUsage.Status.RESERVED, VoucherUsage.Status.REDEEMED),
        ).count()
        if usage_count >= voucher.per_customer_usage_limit:
            raise ValidationError({"voucher": {"code": "customer_usage_limit_reached"}})
    return discount, eligible_subtotal


@transaction.atomic
def create_order(*, cart_id, user, branch_id, fulfillment_method, address_id=None,
                 delivery_zone_id=None, slot_id=None, voucher_code="", customer_note=""):
    cart = (
        Cart.objects.select_for_update()
        .select_related("branch")
        .filter(pk=cart_id, user=user, status=Cart.Status.OPEN, branch_id=branch_id)
        .first()
    )
    if not cart:
        raise ValidationError({"cart_id": "An open cart for this branch is required."})
    if not cart.branch.is_active:
        raise ValidationError({"branch_id": "This branch is not accepting orders."})

    items = list(
        CartItem.objects.select_for_update()
        .filter(cart=cart)
        .select_related("product", "basket_package")
        .prefetch_related("basket_package__components__product")
        .order_by("created_at")
    )
    if not items:
        raise ValidationError({"cart_id": "Cannot checkout an empty cart."})

    fulfillment_method = CustomerOrder.FulfillmentMethod(fulfillment_method)
    address = None
    delivery_zone = None
    delivery_fee = 0
    address_data = {}
    if fulfillment_method == CustomerOrder.FulfillmentMethod.DELIVERY:
        if not address_id or not delivery_zone_id:
            raise ValidationError(
                {"delivery": "A saved address and delivery zone are required for delivery."}
            )
        address = CustomerAddress.objects.filter(pk=address_id, user=user).first()
        if not address:
            raise ValidationError({"address_id": "Select one of your saved addresses."})
        delivery_zone = cart.branch.delivery_zones.filter(
            pk=delivery_zone_id,
            is_active=True,
        ).first()
        if not delivery_zone:
            raise ValidationError({"delivery_zone_id": "Select an active zone for this branch."})
        delivery_fee = delivery_zone.delivery_fee_minor
        address_data = _address_snapshot(address)
    elif delivery_zone_id:
        raise ValidationError({"delivery_zone_id": "Pickup orders do not use delivery zones."})

    slot = None
    if slot_id:
        slot = FulfillmentSlot.objects.select_for_update().filter(
            pk=slot_id,
            branch=cart.branch,
            method=fulfillment_method,
            is_active=True,
            starts_at__gt=timezone.now(),
        ).first()
        if not slot:
            raise ValidationError({"slot_id": "Select an active future slot for this branch."})
        occupied = slot.orders.exclude(
            status__in=(CustomerOrder.Status.CANCELLED, CustomerOrder.Status.EXPIRED)
        ).count()
        if occupied >= slot.capacity:
            raise ValidationError({"slot_id": "This fulfillment slot is full."})
    elif getattr(settings, "ORDER_REQUIRE_FULFILLMENT_SLOT", True):
        raise ValidationError({"slot_id": "Choose an available fulfillment time slot."})

    requirements = defaultdict(int)
    item_components = {}
    for cart_item in items:
        if cart_item.product_id:
            product = cart_item.product
            if cart_item.gift_recipient_name or cart_item.gift_message:
                raise ValidationError({"cart": "Gift details are available for eligible baskets only."})
            if not product.is_active:
                raise ValidationError({"cart": f"{product.name} is no longer available."})
            product_branch = ProductBranch.objects.filter(
                branch=cart.branch,
                product=product,
            ).first()
            if not product_branch or not product_branch.is_available:
                raise ValidationError({"cart": f"{product.name} is unavailable at this branch."})
            requirements[product.pk] += cart_item.quantity
            item_components[cart_item.pk] = []
        else:
            package = cart_item.basket_package
            components = list(
                BasketComponent.objects.filter(basket_package=package)
                .select_related("product")
                .order_by("product_id")
            )
            if not package.is_active or not components:
                raise ValidationError({"cart": f"{package.name} is not available for sale."})
            if (
                cart_item.gift_recipient_name or cart_item.gift_message
            ) and not package.gift_message_allowed:
                raise ValidationError({"cart": f"{package.name} does not accept gift details."})
            if any(not component.product.is_active for component in components if not component.is_optional):
                raise ValidationError({"cart": f"A required item in {package.name} is unavailable."})
            item_components[cart_item.pk] = components
            for component in components:
                if not component.is_optional:
                    requirements[component.product_id] += component.quantity * cart_item.quantity

    inventory = {
        row.product_id: row
        for row in ProductBranch.objects.select_for_update()
        .filter(branch=cart.branch, product_id__in=sorted(requirements))
        .order_by("product_id")
    }
    for product_id, required in requirements.items():
        row = inventory.get(product_id)
        if not row or not row.is_available or row.available_quantity < required:
            product_name = next(
                item.product.name
                for item in items
                if item.product_id == product_id
            ) if any(item.product_id == product_id for item in items) else "Basket component"
            raise ValidationError({"stock": f"Insufficient stock for {product_name}."})

    line_values = []
    subtotal = 0
    for cart_item in items:
        if cart_item.product_id:
            row = inventory[cart_item.product_id]
            unit_price = row.effective_price_minor
            line_values.append((cart_item, unit_price * cart_item.quantity))
            subtotal += unit_price * cart_item.quantity
        else:
            package = cart_item.basket_package
            line_total = package.base_price_minor * cart_item.quantity
            line_values.append((cart_item, line_total))
            subtotal += line_total
    if delivery_zone and subtotal < delivery_zone.minimum_order_minor:
        raise ValidationError({"delivery_zone_id": "The order is below this zone's minimum spend."})

    voucher = None
    discount = 0
    if voucher_code:
        voucher = Voucher.objects.select_for_update().filter(code__iexact=voucher_code.strip()).first()
        if not voucher:
            raise ValidationError({"voucher": {"code": "voucher_not_found"}})
        discount, _ = _calculate_voucher(voucher, user, cart.branch, line_values, subtotal)
    if subtotal + delivery_fee - discount <= 0:
        raise ValidationError({"voucher": "The discount cannot reduce an order to zero."})

    settings_record = SiteSettings.objects.order_by("pk").first()
    currency = settings_record.currency_code if settings_record else "GHS"
    expires_at = timezone.now() + timedelta(
        minutes=getattr(settings, "ORDER_RESERVATION_MINUTES", 15)
    )
    order = CustomerOrder.objects.create(
        user=user,
        branch=cart.branch,
        delivery_zone=delivery_zone,
        fulfillment_method=fulfillment_method,
        fulfillment_slot=slot,
        cart=cart,
        currency=currency,
        subtotal_minor=subtotal,
        delivery_fee_minor=delivery_fee,
        discount_minor=discount,
        total_amount_minor=subtotal + delivery_fee - discount,
        address_snapshot=address_data,
        branch_snapshot=_branch_snapshot(cart.branch),
        delivery_snapshot={
            "zone": delivery_zone.name if delivery_zone else "",
            "fee_minor": delivery_fee,
            "method": fulfillment_method,
            "slot_starts_at": slot.starts_at.isoformat() if slot else None,
            "slot_ends_at": slot.ends_at.isoformat() if slot else None,
        },
        voucher_code_snapshot=voucher.code if voucher else "",
        customer_note=customer_note,
    )

    order_lines = {}
    for cart_item, line_total in line_values:
        if cart_item.product_id:
            name, sku, unit, product, package = (
                cart_item.product.name,
                cart_item.product.sku,
                cart_item.product.unit,
                cart_item.product,
                None,
            )
            unit_price = line_total // cart_item.quantity
        else:
            basket = cart_item.basket_package
            name, sku, unit, product, package = basket.name, basket.sku, "basket", None, basket
            unit_price = basket.base_price_minor
        order_line = OrderLine.objects.create(
            order=order,
            product=product,
            basket_package=package,
            sku_snapshot=sku,
            name_snapshot=name,
            unit_snapshot=unit,
            quantity=cart_item.quantity,
            unit_price_minor=unit_price,
            line_total_minor=line_total,
            gift_recipient_name=cart_item.gift_recipient_name,
            gift_message=cart_item.gift_message,
        )
        order_lines[cart_item.pk] = order_line

        if package:
            for component in item_components[cart_item.pk]:
                if component.is_optional:
                    continue
                OrderLineComponent.objects.create(
                    order_line=order_line,
                    product=component.product,
                    name_snapshot=component.product.name,
                    unit_snapshot=component.product.unit,
                    quantity=component.quantity * cart_item.quantity,
                )
    for cart_item in items:
        if cart_item.product_id:
            needs = [(cart_item.product_id, cart_item.quantity)]
        else:
            needs = [
                (component.product_id, component.quantity * cart_item.quantity)
                for component in item_components[cart_item.pk]
                if not component.is_optional
            ]
        for product_id, quantity in needs:
            row = inventory.get(product_id)
            if not row or not row.is_available:
                continue
            current = StockReservation.objects.filter(
                order=order,
                order_line=order_lines[cart_item.pk],
                product_branch=row,
                status=StockReservation.Status.ACTIVE,
            ).first()
            if current:
                current.quantity += quantity
                current.save(update_fields=("quantity", "updated_at"))
            else:
                StockReservation.objects.create(
                    order=order,
                    order_line=order_lines[cart_item.pk],
                    product_branch=row,
                    quantity=quantity,
                    expires_at=expires_at,
                )
            row.reserved_quantity += quantity
            row.save(update_fields=("reserved_quantity", "updated_at"))

    if voucher:
        VoucherUsage.objects.create(
            voucher=voucher,
            user=user,
            order=order,
            amount_saved_minor=discount,
            status=VoucherUsage.Status.RESERVED,
        )
    cart.status = Cart.Status.CONVERTED
    cart.save(update_fields=("status", "updated_at"))
    OrderStatusHistory.objects.create(
        order=order,
        from_status="",
        to_status=order.status,
        actor=user,
        note="Order created; stock reserved pending payment.",
    )
    return order


@transaction.atomic
def transition_order(order, *, to_status, actor=None, note=""):
    order = CustomerOrder.objects.select_for_update().get(pk=order.pk)
    to_status = CustomerOrder.Status(to_status)
    allowed = {
        CustomerOrder.Status.CONFIRMED: {CustomerOrder.Status.PICKING},
        CustomerOrder.Status.PICKING: {CustomerOrder.Status.READY_FOR_DISPATCH},
        CustomerOrder.Status.READY_FOR_DISPATCH: {CustomerOrder.Status.OUT_FOR_DELIVERY},
        CustomerOrder.Status.OUT_FOR_DELIVERY: {CustomerOrder.Status.DELIVERED},
    }
    if to_status not in allowed.get(order.status, set()):
        raise ValidationError({"status": f"Cannot move order from {order.status} to {to_status}."})
    try:
        paid = order.payment.status == "succeeded"
    except ObjectDoesNotExist:
        paid = False
    if not paid:
        raise ValidationError({"status": "Only paid orders can enter fulfillment."})
    previous = order.status
    order.status = to_status
    now = timezone.now()
    timestamp_fields = {
        CustomerOrder.Status.PICKING: "picking_at",
        CustomerOrder.Status.READY_FOR_DISPATCH: "ready_for_dispatch_at",
        CustomerOrder.Status.OUT_FOR_DELIVERY: "out_for_delivery_at",
        CustomerOrder.Status.DELIVERED: "delivered_at",
    }
    timestamp_field = timestamp_fields.get(to_status)
    update_fields = ["status", "updated_at"]
    if timestamp_field:
        setattr(order, timestamp_field, now)
        update_fields.append(timestamp_field)
    order.save(update_fields=update_fields)
    OrderStatusHistory.objects.create(
        order=order,
        from_status=previous,
        to_status=to_status,
        actor=actor,
        note=note,
    )
    return order


@transaction.atomic
def release_order_reservations(order, *, final_status, actor=None, note=""):
    order = CustomerOrder.objects.select_for_update().get(pk=order.pk)
    if order.status != CustomerOrder.Status.AWAITING_PAYMENT:
        return order
    reservations = list(
        StockReservation.objects.select_for_update()
        .filter(order=order, status=StockReservation.Status.ACTIVE)
        .select_related("product_branch")
    )
    for reservation in reservations:
        row = ProductBranch.objects.select_for_update().get(pk=reservation.product_branch_id)
        row.reserved_quantity -= reservation.quantity
        row.save(update_fields=("reserved_quantity", "updated_at"))
        reservation.status = (
            StockReservation.Status.EXPIRED
            if final_status == CustomerOrder.Status.EXPIRED
            else StockReservation.Status.RELEASED
        )
        reservation.released_at = timezone.now()
        reservation.save(update_fields=("status", "released_at", "updated_at"))
    usage = getattr(order, "voucher_usage", None)
    if usage and usage.status == VoucherUsage.Status.RESERVED:
        usage.status = VoucherUsage.Status.RELEASED
        usage.save(update_fields=("status", "updated_at"))
    previous = order.status
    order.status = final_status
    if final_status == CustomerOrder.Status.EXPIRED:
        order.expired_at = timezone.now()
        order.save(update_fields=("status", "expired_at", "updated_at"))
    else:
        order.cancelled_at = timezone.now()
        order.save(update_fields=("status", "cancelled_at", "updated_at"))
    OrderStatusHistory.objects.create(
        order=order,
        from_status=previous,
        to_status=final_status,
        actor=actor,
        note=note,
    )
    return order


@transaction.atomic
def consume_order_reservations(order):
    order = CustomerOrder.objects.select_for_update().get(pk=order.pk)
    reservations = list(
        StockReservation.objects.select_for_update()
        .filter(order=order, status=StockReservation.Status.ACTIVE)
        .select_related("product_branch")
    )
    for reservation in reservations:
        row = ProductBranch.objects.select_for_update().get(pk=reservation.product_branch_id)
        if row.reserved_quantity < reservation.quantity or row.stock_on_hand < reservation.quantity:
            raise ValidationError({"stock": "Reserved inventory is inconsistent; contact support."})
        row.reserved_quantity -= reservation.quantity
        row.stock_on_hand -= reservation.quantity
        row.save(update_fields=("reserved_quantity", "stock_on_hand", "updated_at"))
        reservation.status = StockReservation.Status.CONSUMED
        reservation.consumed_at = timezone.now()
        reservation.save(update_fields=("status", "consumed_at", "updated_at"))
    usage = getattr(order, "voucher_usage", None)
    if usage and usage.status == VoucherUsage.Status.RESERVED:
        usage.status = VoucherUsage.Status.REDEEMED
        usage.save(update_fields=("status", "updated_at"))
    return order
