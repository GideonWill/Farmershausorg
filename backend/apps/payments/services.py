import hashlib
import uuid
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.branches.models import BranchPaymentAccount
from apps.audit.models import AuditEvent
from apps.orders.models import CustomerOrder, OrderStatusHistory
from apps.orders.services import consume_order_reservations
from apps.payments.models import (
    Payment,
    PaymentAttempt,
    PaymentWebhookEvent,
    Refund,
)
from apps.payments.providers import PaymentProviderError, get_payment_provider


@transaction.atomic
def create_payment_attempt(*, order, user, method, idempotency_key, phone="", network=""):
    order = CustomerOrder.objects.select_for_update().get(pk=order.pk)
    if order.user_id != user.pk:
        raise PermissionDenied("You do not have access to this order.")
    if order.status != CustomerOrder.Status.AWAITING_PAYMENT:
        raise ValidationError({"order": "This order is not awaiting payment."})
    if order.total_amount_minor <= 0:
        raise ValidationError({"order": "The order total must be greater than zero."})
    account = BranchPaymentAccount.objects.filter(
        branch=order.branch,
        provider=BranchPaymentAccount.Provider.HUBTEL,
        is_enabled=True,
    ).first()
    if not account:
        raise ValidationError({"payment": "Online payment is not configured for this branch."})
    if not account.settlement_verified:
        raise ValidationError({"payment": "This branch's provider settlement setup is not verified."})
    phone = phone or user.phone or ""
    if method == Payment.Method.MOBILE_MONEY:
        if not phone.strip():
            raise ValidationError({"phone": "A phone number is required for Mobile Money."})
        if account.supported_networks and network not in account.supported_networks:
            raise ValidationError({"network": "Select a supported Mobile Money network."})
    elif network:
        raise ValidationError({"network": "A network is only used for Mobile Money."})
    payment, _ = Payment.objects.get_or_create(
        order=order,
        defaults={
            "branch_payment_account": account,
            "provider": account.provider,
            "amount_minor": order.total_amount_minor,
            "currency": order.currency,
            "method": method,
            "network": network,
            "merchant_idempotency_reference": f"order-{order.order_number}".lower(),
        },
    )
    if payment.status == Payment.Status.SUCCEEDED:
        raise ValidationError({"payment": "This order has already been paid."})
    if (
        payment.branch_payment_account_id != account.pk
        or payment.method != method
        or payment.network != network
    ):
        raise ValidationError({"payment": "Payment method or branch account cannot be changed."})
    attempt = PaymentAttempt.objects.filter(idempotency_key=idempotency_key).first()
    if attempt:
        if attempt.payment_id != payment.pk:
            raise ValidationError({"idempotency_key": "This key is already associated with another order."})
        return payment, attempt, account, False
    attempt = PaymentAttempt.objects.create(
        payment=payment,
        idempotency_key=idempotency_key,
        request_metadata={"method": method, "network": network},
    )
    payment.status = Payment.Status.PENDING
    payment.save(update_fields=("status", "updated_at"))
    return payment, attempt, account, True


def initiate_payment(*, order, user, method, idempotency_key, phone="", network=""):
    payment, attempt, account, created = create_payment_attempt(
        order=order,
        user=user,
        method=method,
        idempotency_key=idempotency_key,
        phone=phone,
        network=network,
    )
    if not created:
        return payment, attempt
    try:
        provider = get_payment_provider(account)
        response = provider.initiate(
            payment,
            attempt,
            customer_name=user.display_name or user.get_username(),
            phone=phone or user.phone or "",
            email=user.email or "",
        )
    except (ImproperlyConfigured, PaymentProviderError) as error:
        attempt.status = PaymentAttempt.Status.FAILED
        attempt.result_code = "provider_unavailable"
        attempt.response_metadata = {"error": str(error)}
        attempt.completed_at = timezone.now()
        attempt.save(
            update_fields=("status", "result_code", "response_metadata", "completed_at", "updated_at")
        )
        payment.status = Payment.Status.FAILED
        payment.save(update_fields=("status", "updated_at"))
        raise
    attempt.status = PaymentAttempt.Status.PENDING
    attempt.checkout_url = response["checkout_url"]
    attempt.checkout_reference = response.get("provider_reference", "")
    attempt.response_metadata = {"checkout_url": attempt.checkout_url}
    attempt.save(
        update_fields=(
            "status",
            "checkout_url",
            "checkout_reference",
            "response_metadata",
            "updated_at",
        )
    )
    return payment, attempt


def _webhook_reference(payload):
    return (
        payload.get("refundReference")
        or payload.get("refund_reference")
        or payload.get("checkoutReference")
        or payload.get("checkout_reference")
        or payload.get("checkoutId")
        or payload.get("checkout_id")
        or payload.get("clientReference")
        or payload.get("client_reference")
        or payload.get("reference")
        or payload.get("merchantReference")
    )


def _webhook_outcome(payload):
    state = str(
        payload.get("status")
        or payload.get("transactionStatus")
        or payload.get("paymentStatus")
        or ""
    ).strip().lower()
    response_code = str(payload.get("responseCode") or payload.get("response_code") or "")
    if state in {"success", "successful", "paid", "completed"} or response_code == "0000":
        return "succeeded"
    if state in {"failed", "failure", "rejected", "cancelled", "canceled", "error"}:
        return "failed"
    if response_code and response_code != "0000":
        return "failed"
    return "pending"


def _webhook_amount_minor(payload):
    value = payload.get("totalAmount", payload.get("amount"))
    if value is None:
        raise ValidationError({"webhook": "The provider webhook did not include an amount."})
    try:
        amount = Decimal(str(value)) * 100
    except InvalidOperation as error:
        raise ValidationError({"webhook": "The provider webhook amount is invalid."}) from error
    if amount != amount.to_integral_value():
        raise ValidationError({"webhook": "The provider webhook amount has invalid precision."})
    return int(amount)


@transaction.atomic
def process_hubtel_webhook(*, raw_body, payload, headers):
    reference = _webhook_reference(payload)
    if not reference:
        raise ValidationError({"webhook": "A payment reference is required."})
    attempt = (
        PaymentAttempt.objects.select_related("payment__branch_payment_account", "payment__order")
        .filter(idempotency_key=reference, payment__provider=BranchPaymentAccount.Provider.HUBTEL)
        .first()
    )
    if not attempt:
        attempt = (
            PaymentAttempt.objects.select_related("payment__branch_payment_account", "payment__order")
            .filter(
                Q(checkout_reference=reference) | Q(provider_reference=reference),
                payment__provider=BranchPaymentAccount.Provider.HUBTEL,
            )
            .first()
        )
    refund = None
    if not attempt:
        refund = (
            Refund.objects.select_related("payment__branch_payment_account", "payment__order")
            .filter(
                payment__provider=BranchPaymentAccount.Provider.HUBTEL,
            )
            .filter(Q(idempotency_key=reference) | Q(provider_reference=reference))
            .first()
        )
    if not attempt and not refund:
        raise ValidationError({"webhook": "No Hubtel payment matches this reference."})
    payment_context = attempt.payment if attempt else refund.payment
    provider = get_payment_provider(payment_context.branch_payment_account)
    verified = provider.verify_webhook(raw_body, headers)
    if not verified:
        raise PermissionDenied("Hubtel webhook signature verification failed.")
    event_id = str(
        payload.get("eventId")
        or payload.get("event_id")
        or hashlib.sha256(raw_body).hexdigest()
    )[:160]
    event, created = PaymentWebhookEvent.objects.get_or_create(
        provider=BranchPaymentAccount.Provider.HUBTEL,
        provider_event_id=event_id,
        defaults={
            "signature_verified": verified,
            "redacted_payload": {
                key: value
                for key, value in payload.items()
                if key.lower() not in {"phone", "mobile", "email", "authorization"}
            },
        },
    )
    if not created:
        return {
            "duplicate": True,
            "payment_status": payment_context.status,
        }

    if refund:
        if payload.get("totalAmount") is not None or payload.get("amount") is not None:
            if _webhook_amount_minor(payload) != refund.amount_minor:
                event.processing_error = "Webhook amount did not match the refund."
                event.processed_at = timezone.now()
                event.save(update_fields=("processing_error", "processed_at"))
                raise ValidationError({"webhook": "The refund amount did not match."})
        outcome = _webhook_outcome(payload)
        if outcome == "succeeded":
            mark_refund_result(
                refund,
                succeeded=True,
                provider_reference=str(payload.get("refundReference") or reference),
            )
        elif outcome == "failed":
            mark_refund_result(refund, succeeded=False)
        event.processed_at = timezone.now()
        event.save(update_fields=("processed_at",))
        return {"duplicate": False, "refund_status": refund.status}

    attempt = PaymentAttempt.objects.select_for_update().get(pk=attempt.pk)
    payment = Payment.objects.select_for_update().get(pk=attempt.payment_id)
    order = CustomerOrder.objects.select_for_update().get(pk=payment.order_id)
    amount = _webhook_amount_minor(payload)
    currency = str(payload.get("currency") or payment.currency).upper()
    if amount != payment.amount_minor or currency != payment.currency.upper():
        event.processing_error = "Webhook amount or currency did not match the payment."
        event.processed_at = timezone.now()
        event.save(update_fields=("processing_error", "processed_at"))
        raise ValidationError({"webhook": "The payment amount or currency did not match."})

    provider_reference = str(
        payload.get("transactionId")
        or payload.get("transaction_id")
        or payload.get("checkoutId")
        or reference
    )[:160]
    attempt.provider_reference = provider_reference
    outcome = _webhook_outcome(payload)
    if outcome == "succeeded":
        attempt.completed_at = timezone.now()
        if payment.status != Payment.Status.SUCCEEDED:
            payment.status = Payment.Status.SUCCEEDED
            payment.provider_reference = provider_reference
            payment.succeeded_at = timezone.now()
            payment.save(
                update_fields=("status", "provider_reference", "succeeded_at", "updated_at")
            )
            attempt.status = PaymentAttempt.Status.SUCCEEDED
            attempt.save(
                update_fields=("provider_reference", "status", "completed_at", "updated_at")
            )
            if order.status == CustomerOrder.Status.AWAITING_PAYMENT:
                previous = order.status
                order.status = CustomerOrder.Status.CONFIRMED
                order.paid_at = timezone.now()
                order.confirmed_at = order.paid_at
                order.save(update_fields=("status", "paid_at", "confirmed_at", "updated_at"))
                OrderStatusHistory.objects.create(
                    order=order,
                    from_status=previous,
                    to_status=order.status,
                    note="Payment verified by Hubtel webhook.",
                )
                consume_order_reservations(order)
                from apps.notifications.tasks import notify_order_status

                if order.user_id:
                    transaction.on_commit(lambda: notify_order_status.delay(str(order.pk)))
            else:
                OrderStatusHistory.objects.create(
                    order=order,
                    from_status=order.status,
                    to_status=order.status,
                    note="Late Hubtel payment confirmed after the order reservation expired; manual review required.",
                )
        else:
            attempt.status = PaymentAttempt.Status.SUCCEEDED
            attempt.save(
                update_fields=("provider_reference", "status", "completed_at", "updated_at")
            )
    elif outcome == "failed":
        attempt.completed_at = timezone.now()
        attempt.status = PaymentAttempt.Status.FAILED
        attempt.result_code = str(payload.get("responseCode") or payload.get("status") or "failed")[:80]
        attempt.save(
            update_fields=(
                "provider_reference",
                "status",
                "result_code",
                "completed_at",
                "updated_at",
            )
        )
        if payment.status != Payment.Status.SUCCEEDED:
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=("status", "updated_at"))
    else:
        attempt.status = PaymentAttempt.Status.PENDING
        attempt.save(
            update_fields=("provider_reference", "status", "updated_at")
        )
        payment.status = Payment.Status.PENDING
        payment.save(update_fields=("status", "updated_at"))
    event.processed_at = timezone.now()
    event.save(update_fields=("processed_at",))
    return {"duplicate": False, "payment_status": payment.status}


@transaction.atomic
def request_admin_refund(order, actor, reason):
    order = CustomerOrder.objects.select_for_update().get(pk=order.pk)
    if not actor.is_superuser:
        raise PermissionDenied("Only a Super Admin may cancel a paid order or request a refund.")
    if order.status == CustomerOrder.Status.AWAITING_PAYMENT:
        from apps.orders.services import release_order_reservations

        return release_order_reservations(
            order,
            final_status=CustomerOrder.Status.CANCELLED,
            actor=actor,
            note=reason,
        )
    try:
        payment = Payment.objects.select_for_update().get(order=order)
    except Payment.DoesNotExist as error:
        raise ValidationError({"payment": "No payment record exists for this order."}) from error
    if payment.status not in (
        Payment.Status.SUCCEEDED,
        Payment.Status.PARTIALLY_REFUNDED,
    ):
        raise ValidationError({"payment": "Only a paid order can be refunded."})
    if payment.refunds.filter(
        status__in=(Refund.Status.REQUESTED, Refund.Status.PENDING)
    ).exists():
        raise ValidationError({"refund": "A refund is already in progress for this payment."})
    amount_remaining = payment.amount_minor - sum(
        refund.amount_minor
        for refund in payment.refunds.filter(status__in=(Refund.Status.PENDING, Refund.Status.SUCCEEDED))
    )
    if amount_remaining <= 0:
        raise ValidationError({"payment": "This payment has already been fully refunded."})
    refund = Refund.objects.create(
        payment=payment,
        idempotency_key=f"refund-{uuid.uuid4().hex}",
        amount_minor=amount_remaining,
        reason=reason,
        requested_by=actor,
        approved_by=actor,
    )
    account = payment.branch_payment_account
    provider_error = ""
    try:
        provider = get_payment_provider(account)
        refund.provider_reference = provider.refund(refund)
        refund.status = Refund.Status.PENDING
        refund.save(update_fields=("provider_reference", "status", "updated_at"))
    except (ImproperlyConfigured, PaymentProviderError) as error:
        provider_error = str(error)
        refund.last_error = provider_error
        refund.status = Refund.Status.REQUESTED
        refund.save(update_fields=("last_error", "status", "updated_at"))
    payment.status = Payment.Status.REFUND_PENDING
    payment.save(update_fields=("status", "updated_at"))
    old_status = order.status
    order.status = CustomerOrder.Status.CANCELLED
    order.cancelled_at = timezone.now()
    order.save(update_fields=("status", "cancelled_at", "updated_at"))
    OrderStatusHistory.objects.create(
        order=order,
        from_status=old_status,
        to_status=order.status,
        actor=actor,
        note=f"Cancelled by Super Admin; refund {refund.idempotency_key} requested.",
    )
    order._refund_request = refund
    order._refund_error = provider_error
    return order


@transaction.atomic
def request_order_adjustment_refund(order, actor):
    if not actor.is_superuser:
        raise PermissionDenied("Only a Super Admin may approve an order adjustment refund.")
    order = CustomerOrder.objects.select_for_update().get(pk=order.pk)
    if not order.refund_review_required or order.refund_difference_minor <= 0:
        raise ValidationError({"refund": "This order has no outstanding adjustment refund for review."})
    payment = Payment.objects.select_for_update().select_related(
        "branch_payment_account"
    ).get(order=order)
    if payment.status not in (Payment.Status.SUCCEEDED, Payment.Status.PARTIALLY_REFUNDED):
        raise ValidationError({"payment": "Only a paid order can receive an adjustment refund."})
    if payment.refunds.filter(status__in=(Refund.Status.REQUESTED, Refund.Status.PENDING)).exists():
        raise ValidationError({"refund": "A refund is already in progress for this payment."})
    refunded_amount = sum(
        refund.amount_minor
        for refund in payment.refunds.filter(
            status__in=(Refund.Status.PENDING, Refund.Status.SUCCEEDED)
        )
    )
    remaining_difference = max(order.refund_difference_minor - refunded_amount, 0)
    amount = min(remaining_difference, payment.amount_minor - refunded_amount)
    if amount <= 0:
        raise ValidationError({"refund": "The payment has no refundable amount remaining."})

    refund = Refund.objects.create(
        payment=payment,
        idempotency_key=f"refund-{uuid.uuid4().hex}",
        amount_minor=amount,
        reason=f"Approved order adjustment: {order.stock_adjustment_note}",
        requested_by=actor,
        approved_by=actor,
    )
    provider_error = ""
    try:
        provider = get_payment_provider(payment.branch_payment_account)
        refund.provider_reference = provider.refund(refund)
        refund.status = Refund.Status.PENDING
    except (ImproperlyConfigured, PaymentProviderError) as error:
        provider_error = str(error)
        refund.last_error = provider_error
        refund.status = Refund.Status.REQUESTED
    refund.save(update_fields=("provider_reference", "status", "last_error", "updated_at"))
    payment.status = Payment.Status.REFUND_PENDING
    payment.save(update_fields=("status", "updated_at"))
    order.refund_review_required = False
    order.save(update_fields=("refund_review_required", "updated_at"))
    AuditEvent.objects.create(
        actor=actor,
        branch=order.branch,
        action="order.adjustment_refund_requested",
        resource_type="CustomerOrder",
        resource_id=str(order.pk),
        after_data={
            "refund_id": str(refund.pk),
            "amount_minor": amount,
            "status": refund.status,
        },
    )
    order._refund_request = refund
    order._refund_error = provider_error
    return refund


def mark_refund_result(refund, *, succeeded, provider_reference=""):
    refund.status = Refund.Status.SUCCEEDED if succeeded else Refund.Status.FAILED
    if provider_reference:
        refund.provider_reference = provider_reference
    refund.completed_at = timezone.now()
    refund.save(update_fields=("status", "provider_reference", "completed_at", "updated_at"))
    payment = refund.payment
    successful_amount = sum(
        item.amount_minor for item in payment.refunds.filter(status=Refund.Status.SUCCEEDED)
    )
    if successful_amount >= payment.amount_minor:
        payment.status = Payment.Status.REFUNDED
    elif successful_amount:
        payment.status = Payment.Status.PARTIALLY_REFUNDED
    elif refund.status == Refund.Status.FAILED:
        payment.status = Payment.Status.SUCCEEDED
    payment.save(update_fields=("status", "updated_at"))
    return refund


@transaction.atomic
def retry_refund(refund, actor):
    if not actor.is_superuser:
        raise PermissionDenied("Only a Super Admin may retry refunds.")
    refund = Refund.objects.select_for_update().select_related(
        "payment__branch_payment_account"
    ).get(pk=refund.pk)
    if refund.status not in (Refund.Status.REQUESTED, Refund.Status.FAILED):
        raise ValidationError({"refund": "Only requested or failed refunds can be retried."})
    try:
        provider = get_payment_provider(refund.payment.branch_payment_account)
        refund.provider_reference = provider.refund(refund)
        refund.status = Refund.Status.PENDING
        refund.last_error = ""
    except (ImproperlyConfigured, PaymentProviderError) as error:
        refund.status = Refund.Status.REQUESTED
        refund.last_error = str(error)
    refund.save(
        update_fields=("provider_reference", "status", "last_error", "updated_at")
    )
    refund.payment.status = Payment.Status.REFUND_PENDING
    refund.payment.save(update_fields=("status", "updated_at"))
    return refund
