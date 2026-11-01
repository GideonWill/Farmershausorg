import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403


DEBUG = False

if not SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be configured in production.")

if not os.getenv("DJANGO_ALLOWED_HOSTS") or "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("Set explicit DJANGO_ALLOWED_HOSTS values in production.")

if not os.getenv("EMAIL_BACKEND") or EMAIL_BACKEND.endswith(".console.EmailBackend"):
    raise ImproperlyConfigured("Set EMAIL_BACKEND for production email OTP delivery.")
if (
    not os.getenv("FARMERSHAUS_SMS_OTP_BACKEND")
    or FARMERSHAUS_SMS_OTP_BACKEND == "apps.accounts.otp.ConsoleOtpDelivery"
):
    raise ImproperlyConfigured(
        "Set FARMERSHAUS_SMS_OTP_BACKEND to a production SMS delivery backend."
    )

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["POSTGRES_DB"],
        "USER": os.environ["POSTGRES_USER"],
        "PASSWORD": os.environ["POSTGRES_PASSWORD"],
        "HOST": os.environ["POSTGRES_HOST"],
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,
    }
}

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
