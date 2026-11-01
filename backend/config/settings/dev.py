from .base import *  # noqa: F403
import os


DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", *ALLOWED_HOSTS]
FARMERSHAUS_SMS_OTP_BACKEND = os.getenv(
    "FARMERSHAUS_SMS_OTP_BACKEND",
    "apps.accounts.otp.ConsoleOtpDelivery",
)
