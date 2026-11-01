from datetime import timedelta
import secrets

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.module_loading import import_string

from apps.accounts.models import OTPChallenge


OTP_LIFETIME = timedelta(minutes=5)


@transaction.atomic
def create_and_deliver_otp(identifier):
    code = f"{secrets.randbelow(1_000_000):06d}"
    OTPChallenge.objects.filter(
        identifier=identifier,
        consumed_at__isnull=True,
    ).update(consumed_at=timezone.now())
    challenge = OTPChallenge.objects.create(
        identifier=identifier,
        code_hash=make_password(code),
        expires_at=timezone.now() + OTP_LIFETIME,
    )

    if "@" in identifier:
        backend = settings.EMAIL_BACKEND
        if not settings.DEBUG and backend.endswith(".console.EmailBackend"):
            raise ImproperlyConfigured("Configure a production email backend for email OTP.")
        sent = send_mail(
            "Your FarmersHaus sign-in code",
            f"Your sign-in code is {code}. It expires in five minutes.",
            settings.DEFAULT_FROM_EMAIL,
            [identifier],
            fail_silently=False,
        )
        if sent != 1:
            raise RuntimeError("The OTP email backend did not confirm delivery.")
    else:
        backend_path = settings.FARMERSHAUS_SMS_OTP_BACKEND
        if not backend_path:
            raise ImproperlyConfigured(
                "Set FARMERSHAUS_SMS_OTP_BACKEND to deliver phone OTPs."
            )
        import_string(backend_path)().send(identifier, code)
    return challenge
