from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.branches.api import validate_active_branch_id
from apps.cart.models import Cart, CartItem
from apps.cart.serializers import (
    CartItemUpdateSerializer,
    CartItemWriteSerializer,
    CartReadSerializer,
    CartResponseSerializer,
    CartValidationRequestSerializer,
    CartValidationResponseSerializer,
    normalize_guest_session_key,
)
from apps.catalogue.models import Product
from apps.baskets.models import BasketPackage
from apps.inventory.models import ProductBranch


class CartAccessMixin:
    def owner_queryset(self, request):
        carts = Cart.objects.filter(status=Cart.Status.OPEN)
        if request.user.is_authenticated:
            return carts.filter(user=request.user)
        return carts.filter(
            user__isnull=True,
            guest_session_key=normalize_guest_session_key(
                request.headers.get("X-Cart-Session")
            ),
        )

    @staticmethod
    def cart_queryset(branch_id=None):
        inventory = ProductBranch.objects.filter(branch_id=branch_id)
        return Cart.objects.prefetch_related(
            Prefetch(
                "items",
                queryset=CartItem.objects.select_related("product", "basket_package")
                .prefetch_related(
                    Prefetch(
                        "product__branch_inventory",
                        queryset=inventory.select_related("branch"),
                        to_attr="selected_branch_inventory",
                    ),
                    "basket_package__components__product",
                ),
            )
        )


class CartView(CartAccessMixin, APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        parameters=[
            OpenApiParameter("branch", OpenApiTypes.UUID, OpenApiParameter.QUERY, required=True)
        ],
        responses=CartResponseSerializer,
    )
    def get(self, request):
        branch_id = validate_active_branch_id(request.query_params.get("branch"))
        cart = self.owner_queryset(request).filter(branch_id=branch_id).first()
        if cart is None:
            return Response({"cart": None})
        cart = self.cart_queryset(branch_id).get(pk=cart.pk)
        return Response({"cart": CartReadSerializer(cart).data})


class CartItemCollectionView(CartAccessMixin, APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        operation_id="cart_item_add",
        request=CartItemWriteSerializer,
        responses={200: CartReadSerializer, 201: CartReadSerializer},
    )
    def post(self, request):
        serializer = CartItemWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        branch_id = validate_active_branch_id(serializer.validated_data["branch_id"])
        item_fields = serializer.validated_data
        if "product_id" in item_fields:
            if item_fields.get("gift_message") or item_fields.get("gift_recipient_name"):
                raise ValidationError({"gift_message": "Gift details are available for eligible baskets only."})
            sellable = get_object_or_404(
                Product,
                pk=item_fields["product_id"],
                is_active=True,
            )
            sellable_field = "product"
        else:
            sellable = get_object_or_404(
                BasketPackage,
                pk=item_fields["basket_package_id"],
                is_active=True,
            )
            sellable_field = "basket_package"
            if (
                item_fields.get("gift_message")
                or item_fields.get("gift_recipient_name")
            ) and not sellable.gift_message_allowed:
                raise ValidationError({"gift_message": "This basket does not support gift messages."})

        with transaction.atomic():
            cart, _ = self.owner_queryset(request).get_or_create(
                branch_id=branch_id,
                defaults={
                    "user": request.user if request.user.is_authenticated else None,
                    "guest_session_key": (
                        None
                        if request.user.is_authenticated
                        else normalize_guest_session_key(
                            request.headers.get("X-Cart-Session")
                        )
                    ),
                },
            )
            cart = Cart.objects.select_for_update().get(pk=cart.pk)
            item, created = CartItem.objects.get_or_create(
                cart=cart,
                **{sellable_field: sellable},
                defaults={
                    "quantity": item_fields["quantity"],
                    "gift_recipient_name": item_fields.get("gift_recipient_name", ""),
                    "gift_message": item_fields.get("gift_message", ""),
                },
            )
            if not created:
                item.quantity += item_fields["quantity"]
                if item.quantity > 999:
                    raise ValidationError({"quantity": "The cart item limit is 999."})
                item.gift_recipient_name = item_fields.get(
                    "gift_recipient_name", item.gift_recipient_name
                )
                item.gift_message = item_fields.get("gift_message", item.gift_message)
                item.save(
                    update_fields=(
                        "quantity",
                        "gift_recipient_name",
                        "gift_message",
                        "updated_at",
                    )
                )

        cart = self.cart_queryset(branch_id).get(pk=cart.pk)
        return Response(
            CartReadSerializer(cart).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )



class CartItemDetailView(CartAccessMixin, APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        operation_id="cart_item_update",
        request=CartItemUpdateSerializer,
        responses=CartReadSerializer,
    )
    def patch(self, request, item_id):
        serializer = CartItemUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            item = get_object_or_404(
                CartItem.objects.filter(
                    cart__in=self.owner_queryset(request),
                    cart__status=Cart.Status.OPEN,
                ),
                pk=item_id,
            )
            Cart.objects.select_for_update().get(pk=item.cart_id)
            item = CartItem.objects.select_for_update().get(pk=item.pk)
            item.quantity = serializer.validated_data["quantity"]
            item.save(update_fields=("quantity", "updated_at"))
        cart = self.cart_queryset(item.cart.branch_id).get(pk=item.cart_id)
        return Response(CartReadSerializer(cart).data)

    @extend_schema(operation_id="cart_item_remove", responses=CartReadSerializer)
    def delete(self, request, item_id):
        with transaction.atomic():
            item = get_object_or_404(
                CartItem.objects.filter(
                    cart__in=self.owner_queryset(request),
                    cart__status=Cart.Status.OPEN,
                ),
                pk=item_id,
            )
            cart = Cart.objects.select_for_update().get(pk=item.cart_id)
            cart_id = item.cart_id
            branch_id = cart.branch_id
            item.delete()
        cart = self.cart_queryset(branch_id).get(pk=cart_id)
        return Response(CartReadSerializer(cart).data)


class CartValidationView(CartAccessMixin, APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        request=CartValidationRequestSerializer,
        responses=CartValidationResponseSerializer,
    )
    def post(self, request):
        serializer = CartValidationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        branch_id = validate_active_branch_id(serializer.validated_data["branch_id"])
        cart = get_object_or_404(
            self.owner_queryset(request),
            pk=serializer.validated_data["cart_id"],
        )
        items = list(
            CartItem.objects.filter(cart=cart)
            .select_related("product", "basket_package")
            .prefetch_related("basket_package__components__product")
            .order_by("created_at")
        )
        unavailable = []
        product_ids = {
            item.product_id
            for item in items
            if item.product_id
        }
        product_ids.update(
            component.product_id
            for item in items
            if item.basket_package_id
            for component in item.basket_package.components.all()
        )
        inventory_by_product = {
            inventory.product_id: inventory
            for inventory in ProductBranch.objects.filter(
                branch_id=branch_id,
                product_id__in=product_ids,
            )
        }
        for item in items:
            reason = None
            if cart.branch_id != branch_id:
                reason = "branch_mismatch"
            elif item.product_id and not item.product.is_active:
                reason = "product_inactive"
            elif item.basket_package_id:
                components = list(item.basket_package.components.select_related("product"))
                if not item.basket_package.is_active or not components:
                    reason = "basket_unavailable"
                else:
                    for component in components:
                        if component.is_optional:
                            continue
                        inventory = inventory_by_product.get(component.product_id)
                        required = component.quantity * item.quantity
                        if (
                            not inventory
                            or not inventory.is_available
                            or inventory.available_quantity < required
                        ):
                            reason = "unavailable"
                            break
            else:
                inventory = inventory_by_product.get(item.product_id)
                if not inventory or not inventory.is_available or inventory.available_quantity == 0:
                    reason = "unavailable"
                elif inventory.available_quantity < item.quantity:
                    reason = "insufficient_stock"
            if reason:
                unavailable.append(
                    {
                        "cart_item_id": str(item.pk),
                        **(
                            {"product_id": str(item.product_id)}
                            if item.product_id
                            else {"basket_package_id": str(item.basket_package_id)}
                        ),
                        "product_name": item.product.name if item.product_id else item.basket_package.name,
                        "requested_quantity": item.quantity,
                        "reason": reason,
                    }
                )
        return Response(
            {
                "cart_id": str(cart.pk),
                "branch_id": str(branch_id),
                "is_valid": not unavailable,
                "unavailable_items": unavailable,
            }
        )
