from .base import *  # noqa: F403
import os


DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", *ALLOWED_HOSTS]
FARMERSHAUS_SMS_OTP_BACKEND = os.getenv(
    "FARMERSHAUS_SMS_OTP_BACKEND",
    "apps.accounts.otp.ConsoleOtpDelivery",
)

CORS_ALLOWED_ORIGINS = [
    *CORS_ALLOWED_ORIGINS,
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
]
