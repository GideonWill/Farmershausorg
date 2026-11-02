from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.cart.models import Cart, CartItem
from apps.cart.serializers import normalize_guest_session_key


@transaction.atomic
def merge_guest_carts(user, guest_session_key):
    if not guest_session_key:
        return
    try:
        guest_session_key = normalize_guest_session_key(guest_session_key)
    except ValidationError:
        return
    guest_carts = list(
        Cart.objects.select_for_update()
        .filter(
            guest_session_key=guest_session_key,
            user__isnull=True,
            status=Cart.Status.OPEN,
        )
        .prefetch_related("items")
    )
    for guest_cart in guest_carts:
        user_cart, _ = Cart.objects.get_or_create(
            user=user,
            branch=guest_cart.branch,
            status=Cart.Status.OPEN,
        )
        user_cart = Cart.objects.select_for_update().get(pk=user_cart.pk)
        for guest_item in guest_cart.items.select_for_update().all():
            sellable_field = "product" if guest_item.product_id else "basket_package"
            sellable = guest_item.product if guest_item.product_id else guest_item.basket_package
            user_item, created = CartItem.objects.get_or_create(
                cart=user_cart,
                **{sellable_field: sellable},
                defaults={
                    "quantity": guest_item.quantity,
                    "gift_recipient_name": guest_item.gift_recipient_name,
                    "gift_message": guest_item.gift_message,
                },
            )
            if not created:
                if user_item.quantity + guest_item.quantity > 999:
                    raise ValidationError(
                        {"quantity": "The merged cart item limit is 999."}
                    )
                user_item.quantity += guest_item.quantity
                if guest_item.gift_recipient_name:
                    user_item.gift_recipient_name = guest_item.gift_recipient_name
                if guest_item.gift_message:
                    user_item.gift_message = guest_item.gift_message
                user_item.save(
                    update_fields=(
                        "quantity",
                        "gift_recipient_name",
                        "gift_message",
                        "updated_at",
                    )
                )
            guest_item.delete()
        guest_cart.status = Cart.Status.ABANDONED
        guest_cart.guest_session_key = None
        guest_cart.save(update_fields=("status", "guest_session_key", "updated_at"))
