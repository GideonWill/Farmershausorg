import secrets

from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.baskets.models import BasketPackage
from apps.branches.models import Branch
from apps.catalogue.models import Product
from apps.cart.models import Cart, CartItem
from apps.cart.serializers import normalize_guest_session_key
from apps.vouchers.models import Voucher
from apps.vouchers.serializers import (
    BulkVoucherCreateSerializer,
    BulkVoucherCreateResponseSerializer,
    VoucherValidationRequestSerializer,
    VoucherValidationResponseSerializer,
)


class VoucherValidationView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        request=VoucherValidationRequestSerializer,
        responses=VoucherValidationResponseSerializer,
    )
    def post(self, request):
        serializer = VoucherValidationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        carts = Cart.objects.filter(
            pk=data["cart_id"],
            branch_id=data["branch_id"],
            status="open",
        )
        if request.user.is_authenticated:
            carts = carts.filter(user=request.user)
        else:
            carts = carts.filter(
                user__isnull=True,
                guest_session_key=normalize_guest_session_key(
                    request.headers.get("X-Cart-Session")
                ),
            )
        cart = carts.first()
        if not cart:
            raise ValidationError({"cart_id": "An open cart for this branch is required."})
        items = list(
            CartItem.objects.filter(cart=cart)
            .select_related("product", "basket_package")
            .prefetch_related("product__branch_inventory")
        )
        if not items:
            raise ValidationError({"cart_id": "Cannot validate a voucher against an empty cart."})
        line_values = []
        subtotal = 0
        for item in items:
            if item.product_id:
                inventory = item.product.branch_inventory.filter(branch_id=cart.branch_id).first()
                if not inventory or not inventory.is_available:
                    raise ValidationError({"cart": f"{item.product.name} is unavailable at this branch."})
                line_total = inventory.effective_price_minor * item.quantity
            else:
                line_total = item.basket_package.base_price_minor * item.quantity
            line_values.append((item, line_total))
            subtotal += line_total
        voucher = Voucher.objects.filter(code__iexact=data["code"].strip()).first()
        if not voucher:
            raise ValidationError({"voucher": {"code": "voucher_not_found"}})
        from apps.orders.services import _calculate_voucher

        discount, eligible_subtotal = _calculate_voucher(
            voucher,
            request.user if request.user.is_authenticated else None,
            cart.branch,
            line_values,
            subtotal,
        )
        return Response(
            {
                "code": voucher.code,
                "eligible_subtotal_minor": eligible_subtotal,
                "discount_minor": discount,
            }
        )


class BulkVoucherCreateView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        request=BulkVoucherCreateSerializer,
        responses={201: BulkVoucherCreateResponseSerializer},
    )
    def post(self, request):
        if not request.user.is_superuser:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Super Admin access is required.")
        serializer = BulkVoucherCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data.copy()
        count = values.pop("count")
        prefix = values.pop("prefix").upper()
        branch_id = values.pop("branch_id", None)
        branch_ids = values.pop("branch_ids", [])
        product_ids = values.pop("product_ids", [])
        basket_package_ids = values.pop("basket_package_ids", [])
        branch = Branch.objects.filter(pk=branch_id).first() if branch_id else None
        if branch_id and not branch:
            raise ValidationError({"branch_id": "Select a valid branch."})
        branches = list(Branch.objects.filter(pk__in=branch_ids))
        products = list(Product.objects.filter(pk__in=product_ids))
        packages = list(BasketPackage.objects.filter(pk__in=basket_package_ids))
        if len(branches) != len(set(branch_ids)):
            raise ValidationError({"branch_ids": "One or more branches are invalid."})
        if len(products) != len(set(product_ids)):
            raise ValidationError({"product_ids": "One or more products are invalid."})
        if len(packages) != len(set(basket_package_ids)):
            raise ValidationError({"basket_package_ids": "One or more baskets are invalid."})
        with transaction.atomic():
            vouchers = []
            for _ in range(count):
                code = f"{prefix}-{secrets.token_hex(4).upper()}"
                while Voucher.objects.filter(code=code).exists():
                    code = f"{prefix}-{secrets.token_hex(4).upper()}"
                vouchers.append(Voucher(code=code, branch=branch, **values))
            created = Voucher.objects.bulk_create(vouchers)
            for voucher in created:
                voucher.branches.set(branches)
                voucher.products.set(products)
                voucher.basket_packages.set(packages)
        return Response(
            {"codes": [voucher.code for voucher in created], "count": len(created)},
            status=status.HTTP_201_CREATED,
        )
