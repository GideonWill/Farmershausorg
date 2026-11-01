from celery import shared_task
from django.conf import settings
from django.utils import timezone
from django.utils.module_loading import import_string

from apps.notifications.models import DeliveryAttempt, Notification
from apps.orders.models import CustomerOrder


def _order_message(order):
    return (
        f"FarmersHaus order {order.order_number} is now "
        f"{order.get_status_display().lower()}. "
        f"Total: {order.currency} {order.total_amount_minor / 100:.2f}."
    )


def _recipient_for(user, channel):
    if channel == Notification.Channel.EMAIL:
        return user.email
    if channel in (Notification.Channel.SMS, Notification.Channel.WHATSAPP):
        return user.phone
    return ""


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def notify_order_status(self, order_id):
    order = CustomerOrder.objects.select_related("user").filter(pk=order_id).first()
    if not order or not order.user_id:
        return
    user = order.user
    message = _order_message(order)
    channels = [Notification.Channel.IN_APP]
    if user.email:
        channels.append(Notification.Channel.EMAIL)
    if user.phone:
        channels.extend((Notification.Channel.SMS, Notification.Channel.WHATSAPP))

    provider_class = import_string(settings.NOTIFICATION_PROVIDER_CLASS)
    provider = provider_class()
    for channel in channels:
        notification, _ = Notification.objects.get_or_create(
            user=user,
            order=order,
            channel=channel,
            template_key=f"order_{order.status}",
            defaults={
                "redacted_metadata": {
                    "order_number": order.order_number,
                    "status": order.status,
                }
            },
        )
        if notification.status == Notification.Status.SENT:
            continue
        attempt = DeliveryAttempt.objects.create(notification=notification)
        try:
            if channel == Notification.Channel.IN_APP:
                provider_reference = ""
            else:
                provider_reference = provider.deliver(
                    channel=channel,
                    recipient=_recipient_for(user, channel),
                    subject=f"FarmersHaus order {order.order_number}",
                    message=message,
                )
            attempt.status = DeliveryAttempt.Status.SUCCEEDED
            attempt.provider_reference = provider_reference
            attempt.completed_at = timezone.now()
            attempt.save(
                update_fields=("status", "provider_reference", "completed_at", "updated_at")
            )
            notification.status = Notification.Status.SENT
            notification.sent_at = timezone.now()
            notification.save(update_fields=("status", "sent_at", "updated_at"))
        except Exception as error:
            attempt.status = DeliveryAttempt.Status.FAILED
            attempt.retry_count = self.request.retries
            attempt.last_error = str(error)[:2000]
            attempt.completed_at = timezone.now()
            attempt.save(
                update_fields=(
                    "status",
                    "retry_count",
                    "last_error",
                    "completed_at",
                    "updated_at",
                )
            )
            notification.status = Notification.Status.FAILED
            notification.save(update_fields=("status", "updated_at"))
            raise


@shared_task
def retry_failed_notification(notification_id):
    notification = Notification.objects.filter(
        pk=notification_id,
        status=Notification.Status.FAILED,
        order__isnull=False,
    ).first()
    if notification:
        notify_order_status.delay(str(notification.order_id))
