import logging

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


logger = logging.getLogger(__name__)


class ConsoleOtpDelivery:
    def send(self, destination, code):
        if not settings.DEBUG:
            raise ImproperlyConfigured(
                "Configure FARMERSHAUS_SMS_OTP_BACKEND before enabling phone OTP in production."
            )
        logger.warning("Development OTP for %s: %s", destination, code)
