from django.contrib.auth.hashers import check_password
from django.db import transaction
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.generics import CreateAPIView, RetrieveUpdateAPIView
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view

from apps.accounts.models import BranchMembership, OTPChallenge, User
from apps.accounts.serializers import (
    CustomerAddressSerializer,
    IdentifierTokenObtainPairSerializer,
    OTPRequestSerializer,
    OTPRequestResponseSerializer,
    OTPVerifySerializer,
    RegistrationSerializer,
    TokenPairResponseSerializer,
    UserProfileSerializer,
)
from apps.accounts.services import create_and_deliver_otp
from apps.cart.services import merge_guest_carts
from apps.orders.models import CustomerAddress


class PublicTokenObtainPairView(TokenObtainPairView):
    permission_classes = (AllowAny,)
    serializer_class = IdentifierTokenObtainPairSerializer


class PublicTokenRefreshView(TokenRefreshView):
    permission_classes = (AllowAny,)


class RegistrationView(CreateAPIView):
    permission_classes = (AllowAny,)
    serializer_class = RegistrationSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        merge_guest_carts(user, self.request.headers.get("X-Cart-Session"))
        branch_id = self.request.data.get("branch_id")
        if branch_id:
            from apps.branches.models import Branch
            branch = Branch.objects.filter(id=branch_id).first()
            if branch:
                user.is_staff = True
                user.save(update_fields=["is_staff"])
                BranchMembership.objects.get_or_create(
                    user=user,
                    branch=branch,
                    defaults={"role": self.request.data.get("role", "staff"), "is_active": True},
                )


class OTPRequestView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "otp_request"

    @extend_schema(
        request=OTPRequestSerializer,
        responses={202: OTPRequestResponseSerializer},
    )
    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]
        lookup = (
            User.objects.filter(phone=identifier)
            if identifier.startswith("+")
            else User.objects.filter(email__iexact=identifier)
        )
        user = lookup.filter(is_active=True).first()
        if user:
            create_and_deliver_otp(identifier)
        return Response(
            {"detail": "If an active account matches, a sign-in code has been sent."},
            status=status.HTTP_202_ACCEPTED,
        )


class OTPVerifyView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "otp_verify"

    @extend_schema(
        request=OTPVerifySerializer,
        responses={200: TokenPairResponseSerializer},
    )
    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]
        now = timezone.now()
        is_valid = False
        with transaction.atomic():
            challenge = (
                OTPChallenge.objects.select_for_update()
                .filter(
                    identifier=identifier,
                    consumed_at__isnull=True,
                    expires_at__gt=now,
                    attempts__lt=5,
                )
                .first()
            )
            is_valid = challenge is not None and check_password(
                serializer.validated_data["code"], challenge.code_hash
            )
            if not is_valid:
                if challenge is not None:
                    challenge.attempts += 1
                    challenge.save(update_fields=("attempts", "updated_at"))
            else:
                challenge.consumed_at = now
                challenge.save(update_fields=("consumed_at", "updated_at"))
        if not is_valid:
            raise AuthenticationFailed("The sign-in code is invalid or expired.")

        user_query = (
            User.objects.filter(phone=identifier)
            if identifier.startswith("+")
            else User.objects.filter(email__iexact=identifier)
        )
        user = user_query.filter(is_active=True).first()
        if user is None:
            raise AuthenticationFailed("The sign-in code is invalid or expired.")

        merge_guest_carts(user, request.headers.get("X-Cart-Session"))
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        return Response({"refresh": str(refresh), "access": str(refresh.access_token)})


class CurrentUserView(RetrieveUpdateAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user


@extend_schema_view(
    retrieve=extend_schema(
        parameters=[OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH)]
    ),
    update=extend_schema(
        parameters=[OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH)]
    ),
    partial_update=extend_schema(
        parameters=[OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH)]
    ),
    destroy=extend_schema(
        parameters=[OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH)]
    ),
)
class CustomerAddressViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated,)
    serializer_class = CustomerAddressSerializer

    def get_queryset(self):
        return CustomerAddress.objects.filter(user=self.request.user).order_by("-is_default", "-created_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
