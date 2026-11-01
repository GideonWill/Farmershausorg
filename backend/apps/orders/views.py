import json
import io
import time
import uuid

from django.db.models import Count, Q
from django.db import transaction
from django.http import FileResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.accounts.models import BranchMembership
from apps.branches.api import validate_active_branch_id
from apps.common.permissions import HasAnyBranchMembership
from apps.audit.models import AuditEvent
from apps.inventory.models import InventoryAdjustment, ProductBranch
from apps.catalogue.models import Product
from apps.orders.models import CustomerOrder, FulfillmentSlot, OrderStatusHistory
from apps.orders.serializers import (
    CancelOrderSerializer,
    CheckoutSerializer,
    AdminCancellationResponseSerializer,
    FulfillmentSlotSerializer,
    OrderReadSerializer,
    StaffOrderLineAdjustmentSerializer,
    StaffRiderAssignmentSerializer,
    OrderStatusUpdateSerializer,
)
from apps.orders.services import create_order, release_order_reservations, transition_order


def _order_queryset():
    return CustomerOrder.objects.select_related(
        "branch",
        "delivery_zone",
        "fulfillment_slot",
        "user",
        "payment",
    ).prefetch_related(
        "lines__components",
        "status_history",
    )


def _can_access_order(user, order):
    if user.is_superuser or order.user_id == user.pk:
        return True
    return BranchMembership.objects.filter(
        user=user,
        branch_id=order.branch_id,
        is_active=True,
    ).exists()


class FulfillmentSlotListView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        parameters=[
            OpenApiParameter("branch", OpenApiTypes.UUID, OpenApiParameter.QUERY, required=True),
            OpenApiParameter(
                "method",
                OpenApiTypes.STR,
                OpenApiParameter.QUERY,
                enum=CustomerOrder.FulfillmentMethod.values,
                required=True,
            ),
        ],
        responses=FulfillmentSlotSerializer(many=True),
    )
    def get(self, request):
        branch_id = request.query_params.get("branch")
        method = request.query_params.get("method")
        branch_id = validate_active_branch_id(branch_id)
        if method not in CustomerOrder.FulfillmentMethod.values:
            raise ValidationError({"method": "Choose delivery or pickup."})
        slots = (
            FulfillmentSlot.objects.filter(
                branch_id=branch_id,
                method=method,
                is_active=True,
                starts_at__gt=timezone.now(),
            )
            .annotate(
                occupied=Count(
                    "orders",
                    filter=~Q(orders__status__in=(
                        CustomerOrder.Status.CANCELLED,
                        CustomerOrder.Status.EXPIRED,
                    )),
                )
            )
            .order_by("starts_at")
        )
        result = [
            {
                "id": slot.pk,
                "method": slot.method,
                "starts_at": slot.starts_at,
                "ends_at": slot.ends_at,
                "remaining_capacity": max(slot.capacity - slot.occupied, 0),
            }
            for slot in slots
            if slot.capacity > slot.occupied
        ]
        return Response(FulfillmentSlotSerializer(result, many=True).data)


class CheckoutView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=CheckoutSerializer, responses={201: OrderReadSerializer})
    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = create_order(user=request.user, **serializer.validated_data)
        return Response(OrderReadSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderCollectionView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OrderReadSerializer(many=True))
    def get(self, request):
        orders = _order_queryset().filter(user=request.user)
        return Response(OrderReadSerializer(orders, many=True).data)


class OrderDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    def get_object(self, request, order_number):
        order = get_object_or_404(_order_queryset(), order_number=order_number)
        if not _can_access_order(request.user, order):
            raise PermissionDenied("You do not have access to this order.")
        return order

    @extend_schema(responses=OrderReadSerializer)
    def get(self, request, order_number):
        return Response(OrderReadSerializer(self.get_object(request, order_number)).data)


class OrderCancelView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        request=CancelOrderSerializer,
        responses={
            200: OrderReadSerializer,
            202: AdminCancellationResponseSerializer,
            503: AdminCancellationResponseSerializer,
        },
    )
    def post(self, request, order_number):
        order = get_object_or_404(_order_queryset(), order_number=order_number)
        serializer = CancelOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if request.user.is_superuser:
            if order.status == CustomerOrder.Status.AWAITING_PAYMENT:
                order = release_order_reservations(
                    order,
                    final_status=CustomerOrder.Status.CANCELLED,
                    actor=request.user,
                    note=serializer.validated_data["reason"],
                )
            else:
                from apps.payments.services import request_admin_refund

                order = request_admin_refund(order, request.user, serializer.validated_data["reason"])
                refund = getattr(order, "_refund_request", None)
                if refund:
                    status_code = (
                        status.HTTP_503_SERVICE_UNAVAILABLE
                        if getattr(order, "_refund_error", "")
                        else status.HTTP_202_ACCEPTED
                    )
                    return Response(
                        {
                            "order": OrderReadSerializer(order).data,
                            "refund": {
                                "id": str(refund.pk),
                                "status": refund.status,
                                "idempotency_key": refund.idempotency_key,
                                "error": refund.last_error,
                            },
                        },
                        status=status_code,
                    )
        else:
            if order.user_id != request.user.pk:
                raise PermissionDenied("Only the customer or a Super Admin may cancel this order.")
            if order.status != CustomerOrder.Status.AWAITING_PAYMENT:
                raise ValidationError(
                    {"status": "Paid orders cannot be cancelled online by customers; contact support."}
                )
            order = release_order_reservations(
                order,
                final_status=CustomerOrder.Status.CANCELLED,
                actor=request.user,
                note=serializer.validated_data["reason"],
            )
        return Response(OrderReadSerializer(order).data)


class StaffOrderCollectionView(APIView):
    permission_classes = (IsAuthenticated, HasAnyBranchMembership)

    def get_queryset(self, request):
        branch_id = request.query_params.get("branch")
        if not branch_id:
            raise ValidationError({"branch": "A branch is required."})
        if not request.user.is_superuser and not BranchMembership.objects.filter(
            user=request.user,
            branch_id=branch_id,
            is_active=True,
        ).exists():
            raise PermissionDenied("You do not have access to this branch.")
        orders = _order_queryset().filter(branch_id=branch_id)
        if not (request.user.is_superuser and request.query_params.get("include_unpaid") == "true"):
            orders = orders.filter(paid_at__isnull=False)
        return orders.exclude(
            status__in=(CustomerOrder.Status.CANCELLED, CustomerOrder.Status.EXPIRED)
        )[:500]

    @extend_schema(responses=OrderReadSerializer(many=True))
    def get(self, request):
        return Response(OrderReadSerializer(self.get_queryset(request), many=True).data)


class StaffOrderStatusView(APIView):
    permission_classes = (IsAuthenticated, HasAnyBranchMembership)

    @extend_schema(request=OrderStatusUpdateSerializer, responses=OrderReadSerializer)
    def patch(self, request, order_number):
        order = get_object_or_404(_order_queryset(), order_number=order_number)
        if not _can_access_order(request.user, order):
            raise PermissionDenied("You do not have access to this order's branch.")
        if not order.paid_at:
            raise ValidationError({"status": "Only paid orders can be processed by staff."})
        serializer = OrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data["status"] == CustomerOrder.Status.CONFIRMED:
            if order.status != CustomerOrder.Status.CONFIRMED:
                raise ValidationError({"status": "Only a new paid order can be confirmed."})
            if order.staff_confirmed_at is None:
                order.staff_confirmed_at = timezone.now()
                order.save(update_fields=("staff_confirmed_at", "updated_at"))
                AuditEvent.objects.create(
                    actor=request.user,
                    branch=order.branch,
                    action="order.staff_confirmed",
                    resource_type="CustomerOrder",
                    resource_id=str(order.pk),
                    after_data={"staff_confirmed_at": order.staff_confirmed_at.isoformat()},
                )
            return Response(OrderReadSerializer(order).data)
        order = transition_order(
            order,
            to_status=serializer.validated_data["status"],
            actor=request.user,
            note=serializer.validated_data.get("note", ""),
        )
        from apps.notifications.tasks import notify_order_status

        if order.user_id:
            transaction.on_commit(lambda: notify_order_status.delay(str(order.pk)))
        return Response(OrderReadSerializer(order).data)


class StaffOrderRiderView(APIView):
    permission_classes = (IsAuthenticated, HasAnyBranchMembership)

    @extend_schema(request=StaffRiderAssignmentSerializer, responses=OrderReadSerializer)
    def patch(self, request, order_number):
        order = get_object_or_404(_order_queryset(), order_number=order_number)
        if not _can_access_order(request.user, order):
            raise PermissionDenied("You do not have access to this order's branch.")
        if not order.paid_at or order.status in (
            CustomerOrder.Status.CANCELLED,
            CustomerOrder.Status.EXPIRED,
            CustomerOrder.Status.DELIVERED,
        ):
            raise ValidationError({"order": "A rider can only be assigned to an active paid order."})
        serializer = StaffRiderAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        before = {"rider_name": order.rider_name, "rider_phone": order.rider_phone}
        order.rider_name = serializer.validated_data["name"].strip()
        order.rider_phone = serializer.validated_data["phone"].strip()
        order.save(update_fields=("rider_name", "rider_phone", "updated_at"))
        AuditEvent.objects.create(
            actor=request.user,
            branch=order.branch,
            action="order.rider_assigned",
            resource_type="CustomerOrder",
            resource_id=str(order.pk),
            before_data=before,
            after_data={"rider_name": order.rider_name, "rider_phone": order.rider_phone},
        )
        return Response(OrderReadSerializer(order).data)


class StaffOrderLineAdjustmentView(APIView):
    permission_classes = (IsAuthenticated, HasAnyBranchMembership)

    @extend_schema(request=StaffOrderLineAdjustmentSerializer, responses=OrderReadSerializer)
    def post(self, request, order_number):
        serializer = StaffOrderLineAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            order = get_object_or_404(
                _order_queryset().select_for_update(),
                order_number=order_number,
            )
            if not _can_access_order(request.user, order):
                raise PermissionDenied("You do not have access to this order's branch.")
            if not order.paid_at or order.status not in (
                CustomerOrder.Status.CONFIRMED,
                CustomerOrder.Status.PICKING,
            ):
                raise ValidationError({"order": "Items can only be adjusted before dispatch."})
            line = get_object_or_404(
                order.lines.select_for_update(),
                pk=data["order_line_id"],
                is_removed=False,
            )
            before_total = order.total_amount_minor
            original_name = line.name_snapshot

            if data["action"] == "substitute":
                if not line.product_id:
                    raise ValidationError({"order_line_id": "Basket packages cannot be substituted as a single item."})
                replacement = get_object_or_404(
                    Product.objects.filter(is_active=True),
                    pk=data["replacement_product_id"],
                )
                replacement_inventory = get_object_or_404(
                    ProductBranch.objects.select_for_update().select_related("product"),
                    branch=order.branch,
                    product=replacement,
                    is_available=True,
                )
                if replacement_inventory.available_quantity < line.quantity:
                    raise ValidationError({"replacement_product_id": "The replacement does not have enough available stock."})
                replacement_price = replacement_inventory.effective_price_minor
                if replacement_price > line.unit_price_minor:
                    raise ValidationError({"replacement_product_id": "Choose a replacement at or below the original item price."})
                stock_before = replacement_inventory.stock_on_hand
                replacement_inventory.stock_on_hand -= line.quantity
                replacement_inventory.save(update_fields=("stock_on_hand", "updated_at"))
                InventoryAdjustment.objects.create(
                    product_branch=replacement_inventory,
                    actor=request.user,
                    idempotency_key=f"substitute-{uuid.uuid4()}",
                    quantity_delta=-line.quantity,
                    reason=f"Substitute for {order.order_number}: {original_name}",
                    stock_before=stock_before,
                    stock_after=replacement_inventory.stock_on_hand,
                )
                line.product = replacement
                line.sku_snapshot = replacement.sku
                line.name_snapshot = replacement.name
                line.unit_snapshot = replacement.unit
                line.unit_price_minor = replacement_price
                line.line_total_minor = replacement_price * line.quantity
                line.save(update_fields=(
                    "product", "sku_snapshot", "name_snapshot", "unit_snapshot",
                    "unit_price_minor", "line_total_minor", "updated_at",
                ))
            else:
                line.is_removed = True
                line.save(update_fields=("is_removed", "updated_at"))

            active_lines = order.lines.filter(is_removed=False)
            order.subtotal_minor = sum(item.line_total_minor for item in active_lines)
            order.discount_minor = min(
                order.discount_minor,
                order.subtotal_minor + order.delivery_fee_minor,
            )
            order.total_amount_minor = (
                order.subtotal_minor + order.delivery_fee_minor - order.discount_minor
            )
            paid_amount = getattr(getattr(order, "payment", None), "amount_minor", before_total)
            order.refund_difference_minor = max(paid_amount - order.total_amount_minor, 0)
            order.refund_review_required = order.refund_difference_minor > 0
            order.stock_adjustment_note = data["reason"]
            order.save(update_fields=(
                "subtotal_minor", "discount_minor", "total_amount_minor",
                "refund_difference_minor", "refund_review_required",
                "stock_adjustment_note", "updated_at",
            ))
            AuditEvent.objects.create(
                actor=request.user,
                branch=order.branch,
                action=f"order.item_{data['action']}d",
                resource_type="CustomerOrder",
                resource_id=str(order.pk),
                before_data={"line": original_name, "total_amount_minor": before_total},
                after_data={
                    "line": line.name_snapshot,
                    "removed": line.is_removed,
                    "total_amount_minor": order.total_amount_minor,
                    "refund_difference_minor": order.refund_difference_minor,
                    "reason": data["reason"],
                },
            )
        return Response(OrderReadSerializer(order).data)


class OrderTrackingView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OrderReadSerializer)
    def get(self, request, order_number):
        order = get_object_or_404(_order_queryset(), order_number=order_number)
        if not _can_access_order(request.user, order):
            raise PermissionDenied("You do not have access to this order.")
        return Response(OrderReadSerializer(order).data)


class OrderReceiptView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses={200: OpenApiTypes.BINARY})
    def get(self, request, order_number):
        order = get_object_or_404(_order_queryset(), order_number=order_number)
        if not _can_access_order(request.user, order):
            raise PermissionDenied("You do not have access to this order.")
        if not order.paid_at:
            raise ValidationError({"order": "A receipt is available after payment is confirmed."})
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas

        buffer = io.BytesIO()
        document = canvas.Canvas(buffer, pagesize=A4)
        _, page_height = A4
        y = page_height - 54
        document.setTitle(f"FarmersHaus receipt {order.order_number}")
        document.setFont("Helvetica-Bold", 18)
        document.drawString(48, y, "FarmersHaus receipt")
        y -= 28
        document.setFont("Helvetica", 10)
        document.drawString(48, y, f"Order: {order.order_number}")
        y -= 16
        document.drawString(48, y, f"Paid: {order.paid_at:%Y-%m-%d %H:%M} (Accra time)")
        y -= 16
        document.drawString(48, y, f"Branch: {order.branch_snapshot.get('name', '')}")
        y -= 28
        for line in order.lines.filter(is_removed=False):
            description = f"{line.quantity} x {line.name_snapshot} — {order.currency} {line.line_total_minor / 100:.2f}"
            document.drawString(48, y, description[:105])
            y -= 16
            if y < 72:
                document.showPage()
                y = page_height - 54
                document.setFont("Helvetica", 10)
        y -= 12
        document.drawString(48, y, f"Subtotal: {order.currency} {order.subtotal_minor / 100:.2f}")
        y -= 16
        document.drawString(48, y, f"Delivery: {order.currency} {order.delivery_fee_minor / 100:.2f}")
        y -= 16
        document.drawString(48, y, f"Discount: {order.currency} {order.discount_minor / 100:.2f}")
        y -= 20
        document.setFont("Helvetica-Bold", 12)
        document.drawString(48, y, f"Total paid: {order.currency} {order.total_amount_minor / 100:.2f}")
        document.save()
        buffer.seek(0)
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=f"farmershaus-{order.order_number}-receipt.pdf",
            content_type="application/pdf",
        )


class StaffPaidOrderStreamView(APIView):
    permission_classes = (IsAuthenticated, HasAnyBranchMembership)

    @extend_schema(
        parameters=[OpenApiParameter("branch", OpenApiTypes.UUID, OpenApiParameter.QUERY, required=True)],
        responses={200: OpenApiTypes.BINARY},
    )
    def get(self, request):
        branch_id = request.query_params.get("branch")
        if not branch_id:
            raise ValidationError({"branch": "A branch is required."})
        if not request.user.is_superuser and not BranchMembership.objects.filter(
            user=request.user,
            branch_id=branch_id,
            is_active=True,
        ).exists():
            raise PermissionDenied("You do not have access to this branch.")

        cursor = parse_datetime(request.headers.get("Last-Event-ID", ""))
        cursor = cursor or timezone.now()

        def events():
            nonlocal cursor
            deadline = time.monotonic() + 25
            while time.monotonic() < deadline:
                histories = OrderStatusHistory.objects.filter(
                    order__branch_id=branch_id,
                    to_status=CustomerOrder.Status.CONFIRMED,
                    created_at__gt=cursor,
                ).select_related("order").order_by("created_at")
                for event in histories:
                    cursor = event.created_at
                    payload = {
                        "order_number": event.order.order_number,
                        "created_at": event.created_at.isoformat(),
                    }
                    yield f"id: {event.created_at.isoformat()}\nevent: paid-order\ndata: {json.dumps(payload)}\n\n"
                yield ": keep-alive\n\n"
                time.sleep(1)

        response = StreamingHttpResponse(events(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
