import logging

from django.conf import settings
from django.core.mail import send_mail


logger = logging.getLogger(__name__)


class NotificationProvider:
    def deliver(self, *, channel, recipient, subject, message):
        raise NotImplementedError


class ConsoleNotificationProvider(NotificationProvider):
    def deliver(self, *, channel, recipient, subject, message):
        if channel == "email":
            sent = send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [recipient],
                fail_silently=False,
            )
            if sent != 1:
                raise RuntimeError("The configured email backend did not send the notification.")
            return ""
        logger.info("Console %s notification to %s: %s", channel, _mask_recipient(recipient), message)
        return "console"


def _mask_recipient(value):
    if "@" in value:
        local, domain = value.split("@", 1)
        return f"{local[:1]}***@{domain}"
    return f"***{value[-4:]}" if len(value) >= 4 else "***"
