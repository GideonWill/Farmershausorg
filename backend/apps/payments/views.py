import json
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from apps.accounts.models import BranchMembership
from apps.branches.models import Branch
from apps.common.permissions import HasAnyBranchMembership
from apps.common.permissions import IsSuperAdmin
from apps.orders.models import CustomerOrder
from apps.payments.models import Payment, Refund
from apps.payments.providers import PaymentProviderError
from apps.payments.serializers import (
    PaymentInitiationSerializer,
    PaymentInitiationResponseSerializer,
    PaymentAttemptSerializer,
    PaymentReadSerializer,
    PaymentReconciliationSerializer,
    ProviderErrorSerializer,
    RefundRetryResponseSerializer,
)
from apps.payments.services import (
    initiate_payment,
    process_hubtel_webhook,
    retry_refund,
    request_order_adjustment_refund,
)


class PaymentInitiationView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        request=PaymentInitiationSerializer,
        responses={
            201: PaymentInitiationResponseSerializer,
            503: ProviderErrorSerializer,
        },
    )
    def post(self, request, order_number):
        order = get_object_or_404(CustomerOrder, order_number=order_number)
        serializer = PaymentInitiationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment, attempt = initiate_payment(
                order=order,
                user=request.user,
                method=serializer.validated_data["method"],
                idempotency_key=serializer.validated_data["idempotency_key"],
                phone=serializer.validated_data.get("phone", ""),
                network=serializer.validated_data.get("network", ""),
            )
        except (PaymentProviderError, ImproperlyConfigured) as error:
            return Response({"detail": str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        response_data = PaymentReadSerializer(payment).data
        response_data["current_attempt"] = PaymentAttemptSerializer(attempt).data
        return Response(response_data, status=status.HTTP_201_CREATED)


class PaymentSimulateSuccessView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(responses={200: PaymentReadSerializer})
    def post(self, request, order_number):
        import uuid
        from apps.common.models import AuditEvent
        from apps.orders.models import OrderStatusHistory
        from apps.orders.services import consume_order_reservations
        from apps.payments.models import BranchPaymentAccount, PaymentAttempt

        order = get_object_or_404(CustomerOrder, order_number=order_number)
        if order.user_id is not None and not request.user.is_superuser and order.user_id != request.user.pk:
            raise PermissionDenied("You do not have access to this order.")
        if order.status != CustomerOrder.Status.AWAITING_PAYMENT:
            payment = getattr(order, "payment", None)
            if payment:
                return Response(PaymentReadSerializer(payment).data, status=status.HTTP_200_OK)
            raise ValidationError({"order": "This order is not awaiting payment."})

        account = BranchPaymentAccount.objects.filter(branch=order.branch, is_enabled=True).first()
        payment, _ = Payment.objects.get_or_create(
            order=order,
            defaults={
                "branch_payment_account": account,
                "provider": "hubtel",
                "amount_minor": order.total_amount_minor,
                "currency": order.currency,
                "method": request.data.get("method", Payment.Method.MOBILE_MONEY),
                "network": request.data.get("network", "mtn"),
                "merchant_idempotency_reference": f"order-{order.order_number}".lower(),
            },
        )
        attempt = payment.attempts.order_by("-created_at").first()
        if not attempt:
            attempt = PaymentAttempt.objects.create(
                payment=payment,
                idempotency_key=f"sandbox-{uuid.uuid4().hex[:12]}",
                request_metadata={"method": payment.method, "network": payment.network, "mode": "sandbox"},
            )

        provider_reference = f"HUBTEL-TEST-{uuid.uuid4().hex[:8].upper()}"
        attempt.provider_reference = provider_reference
        attempt.status = PaymentAttempt.Status.SUCCEEDED
        attempt.completed_at = timezone.now()
        attempt.save(update_fields=("provider_reference", "status", "completed_at", "updated_at"))

        payment.status = Payment.Status.SUCCEEDED
        payment.provider_reference = provider_reference
        payment.succeeded_at = timezone.now()
        payment.save(update_fields=("status", "provider_reference", "succeeded_at", "updated_at"))

        previous = order.status
        order.status = CustomerOrder.Status.CONFIRMED
        order.paid_at = timezone.now()
        order.confirmed_at = order.paid_at
        order.save(update_fields=("status", "paid_at", "confirmed_at", "updated_at"))

        OrderStatusHistory.objects.create(
            order=order,
            from_status=previous,
            to_status=order.status,
            actor=request.user,
            note="Payment completed via Hubtel Test / Sandbox mode.",
        )
        AuditEvent.objects.create(
            branch=order.branch,
            action="order.status_changed",
            resource_type="CustomerOrder",
            resource_id=str(order.pk),
            before_data={"status": previous},
            after_data={"status": order.status, "source": "sandbox_payment"},
        )
        consume_order_reservations(order)
        return Response(PaymentReadSerializer(payment).data, status=status.HTTP_200_OK)


class PaymentStatusView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(responses=PaymentReadSerializer)
    def get(self, request, order_number):
        payment = get_object_or_404(
            Payment.objects.select_related("order").prefetch_related("attempts"),
            order__order_number=order_number,
        )
        if payment.order.user_id is not None:
            if not request.user.is_authenticated or (
                not request.user.is_superuser
                and payment.order.user_id != request.user.pk
                and not BranchMembership.objects.filter(
                    user=request.user,
                    branch_id=payment.order.branch_id,
                    is_active=True,
                ).exists()
            ):
                raise PermissionDenied("You do not have access to this payment.")
        return Response(PaymentReadSerializer(payment).data)


class HubtelWebhookView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError as error:
            raise ValidationError({"webhook": "A valid JSON payload is required."}) from error
        if not isinstance(payload, dict):
            raise ValidationError({"webhook": "The webhook payload must be a JSON object."})
        result = process_hubtel_webhook(
            raw_body=request.body,
            payload=payload,
            headers=request.headers,
        )
        return Response(result)


class BranchDailyReconciliationView(APIView):
    permission_classes = (IsAuthenticated, HasAnyBranchMembership)

    @extend_schema(
        parameters=[
            OpenApiParameter("branch", OpenApiTypes.UUID, OpenApiParameter.QUERY, required=True),
            OpenApiParameter("date", OpenApiTypes.DATE, OpenApiParameter.QUERY, required=False),
        ],
        responses=PaymentReconciliationSerializer,
    )
    def get(self, request):
        branch_id = request.query_params.get("branch")
        branch = get_object_or_404(Branch, pk=branch_id)
        if not request.user.is_superuser and not BranchMembership.objects.filter(
            user=request.user,
            branch=branch,
            is_active=True,
        ).exists():
            raise PermissionDenied("You do not have access to this branch.")
        try:
            report_date = (
                datetime.strptime(request.query_params["date"], "%Y-%m-%d").date()
                if request.query_params.get("date")
                else timezone.localdate()
            )
        except ValueError as error:
            raise ValidationError({"date": "Use YYYY-MM-DD."}) from error
        zone = ZoneInfo(settings.TIME_ZONE)
        start = timezone.make_aware(datetime.combine(report_date, time.min), zone)
        end = start + timedelta(days=1)
        payments = Payment.objects.filter(
            order__branch=branch,
            created_at__gte=start,
            created_at__lt=end,
        )
        summary = {
            row["status"]: {
                "count": row["count"],
                "amount_minor": row["amount"] or 0,
            }
            for row in payments.values("status").annotate(
                count=Count("pk"),
                amount=Sum("amount_minor"),
            )
        }
        needs_review = list(
            payments.filter(status__in=(Payment.Status.PENDING, Payment.Status.FAILED))
            .values("order__order_number", "status", "amount_minor", "currency")
        )
        return Response(
            {
                "date": report_date,
                "branch_id": branch.pk,
                "currency": payments.values_list("currency", flat=True).first() or "GHS",
                "internal_daily_summary": summary,
                "needs_review": needs_review,
            }
        )


class RefundRetryView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        request=None,
        responses={
            202: RefundRetryResponseSerializer,
            503: RefundRetryResponseSerializer,
        },
    )
    def post(self, request, refund_id):
        if not request.user.is_superuser:
            raise PermissionDenied("Super Admin access is required.")
        refund = get_object_or_404(Refund, pk=refund_id)
        refund = retry_refund(refund, request.user)
        data = {
            "id": str(refund.pk),
            "status": refund.status,
            "provider_reference": refund.provider_reference,
            "error": refund.last_error,
        }
        return Response(
            data,
            status=(
                status.HTTP_503_SERVICE_UNAVAILABLE
                if refund.last_error
                else status.HTTP_202_ACCEPTED
            ),
        )


class StaffRefundReviewView(APIView):
    permission_classes = (IsAuthenticated, IsSuperAdmin)

    def get(self, request):
        review_orders = CustomerOrder.objects.filter(
            refund_review_required=True,
        ).select_related("branch", "user", "payment").order_by("-updated_at")[:100]
        refunds = Refund.objects.select_related("payment__order", "requested_by").order_by("-created_at")[:100]
        return Response({
            "review_orders": [
                {
                    "order_number": order.order_number,
                    "branch": order.branch.name,
                    "customer": order.address_snapshot.get("recipient_name")
                    or (order.user.display_name if order.user_id else ""),
                    "amount_minor": order.refund_difference_minor,
                    "currency": order.currency,
                    "note": order.stock_adjustment_note,
                }
                for order in review_orders
            ],
            "refunds": [
                {
                    "id": str(refund.pk),
                    "order_number": refund.payment.order.order_number,
                    "amount_minor": refund.amount_minor,
                    "currency": refund.payment.currency,
                    "status": refund.status,
                    "reason": refund.reason,
                    "last_error": refund.last_error,
                    "created_at": refund.created_at,
                }
                for refund in refunds
            ],
        })

    def post(self, request, order_number):
        order = get_object_or_404(CustomerOrder, order_number=order_number)
        refund = request_order_adjustment_refund(order, request.user)
        return Response(
            {
                "id": str(refund.pk),
                "order_number": order_number,
                "amount_minor": refund.amount_minor,
                "status": refund.status,
                "error": refund.last_error,
            },
            status=(
                status.HTTP_503_SERVICE_UNAVAILABLE
                if refund.last_error
                else status.HTTP_202_ACCEPTED
            ),
        )
