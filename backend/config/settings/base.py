import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
from corsheaders.defaults import default_headers


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
DEBUG = False
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,.vercel.app").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework_simplejwt.token_blacklist",
    "rest_framework",
    "rest_framework_simplejwt",
    "drf_spectacular",
    "corsheaders",
    "apps.accounts.apps.AccountsConfig",
    "apps.branches.apps.BranchesConfig",
    "apps.catalogue.apps.CatalogueConfig",
    "apps.inventory.apps.InventoryConfig",
    "apps.baskets.apps.BasketsConfig",
    "apps.cart.apps.CartConfig",
    "apps.orders.apps.OrdersConfig",
    "apps.payments.apps.PaymentsConfig",
    "apps.vouchers.apps.VouchersConfig",
    "apps.content.apps.ContentConfig",
    "apps.notifications.apps.NotificationsConfig",
    "apps.reports.apps.ReportsConfig",
    "apps.audit.apps.AuditConfig",
]

AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = [
    "apps.accounts.backends.IdentifierBackend",
    "django.contrib.auth.backends.ModelBackend",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-gb"
TIME_ZONE = "Africa/Accra"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {
        "otp_request": "5/hour",
        "otp_verify": "10/hour",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_TASK_IGNORE_RESULT = True
ORDER_RESERVATION_MINUTES = int(os.getenv("ORDER_RESERVATION_MINUTES", "15"))
ORDER_REQUIRE_FULFILLMENT_SLOT = os.getenv("ORDER_REQUIRE_FULFILLMENT_SLOT", "true").lower() == "true"
HUBTEL_LIVE_ENABLED = os.getenv("HUBTEL_LIVE_ENABLED", "false").lower() == "true"
HUBTEL_WEBHOOK_URL = os.getenv("HUBTEL_WEBHOOK_URL", "")
HUBTEL_RETURN_URL = os.getenv("HUBTEL_RETURN_URL", "")
NOTIFICATION_PROVIDER_CLASS = os.getenv(
    "NOTIFICATION_PROVIDER_CLASS",
    "apps.notifications.providers.ConsoleNotificationProvider",
)

SPECTACULAR_SETTINGS = {
    "TITLE": "FarmersHaus API",
    "DESCRIPTION": "Multi-branch grocery ordering platform API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,https://*.vercel.app").split(",")
    if origin.strip()
]
CORS_ALLOW_HEADERS = (*default_headers, "x-cart-session")
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "http://localhost:5173,https://*.vercel.app").split(",")
    if origin.strip()
]

EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "no-reply@farmershausgh.com")
FARMERSHAUS_SMS_OTP_BACKEND = os.getenv(
    "FARMERSHAUS_SMS_OTP_BACKEND",
    "apps.accounts.otp.ConsoleOtpDelivery" if DEBUG else "",
)
