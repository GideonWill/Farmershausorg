from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.accounts.views import (
    CurrentUserView,
    CustomerAddressViewSet,
    OTPRequestView,
    OTPVerifyView,
    PublicTokenObtainPairView,
    PublicTokenRefreshView,
    RegistrationView,
)


router = SimpleRouter()
router.register("addresses", CustomerAddressViewSet, basename="customer-address")

urlpatterns = [
    path("auth/token/", PublicTokenObtainPairView.as_view(), name="token-obtain"),
    path("auth/token/refresh/", PublicTokenRefreshView.as_view(), name="token-refresh"),
    path("auth/otp/request/", OTPRequestView.as_view(), name="otp-request"),
    path("auth/otp/verify/", OTPVerifyView.as_view(), name="otp-verify"),
    path("auth/register/", RegistrationView.as_view(), name="register"),
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("", include(router.urls)),
]
