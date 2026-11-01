from celery import shared_task
from django.utils import timezone

from apps.orders.models import CustomerOrder
from apps.orders.services import release_order_reservations


@shared_task
def expire_order_reservation(order_id):
    order = CustomerOrder.objects.filter(pk=order_id).first()
    if not order or order.status != CustomerOrder.Status.AWAITING_PAYMENT:
        return
    latest_expiry = order.stock_reservations.filter(
        status="active"
    ).order_by("-expires_at").values_list("expires_at", flat=True).first()
    if latest_expiry and latest_expiry > timezone.now():
        expire_order_reservation.apply_async(args=(str(order.pk),), eta=latest_expiry)
        return
    release_order_reservations(
        order,
        final_status=CustomerOrder.Status.EXPIRED,
        note="Payment was not confirmed before the reservation expired.",
    )


@shared_task
def expire_due_order_reservations():
    due_order_ids = (
        CustomerOrder.objects.filter(
            status=CustomerOrder.Status.AWAITING_PAYMENT,
            stock_reservations__status="active",
            stock_reservations__expires_at__lte=timezone.now(),
        )
        .values_list("pk", flat=True)
        .distinct()
    )
    for order_id in due_order_ids.iterator():
        expire_order_reservation.delay(str(order_id))
