import re

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed

from apps.accounts.models import User
from apps.accounts.models import BranchMembership
from apps.orders.models import CustomerAddress


def normalize_phone(value):
    normalized = re.sub(r"[\s()-]", "", value)
    if not re.fullmatch(r"\+[1-9]\d{7,14}", normalized):
        raise serializers.ValidationError("Enter a phone number in international format, such as +233XXXXXXXXX.")
    return normalized


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, min_length=8)

    class Meta:
        model = User
        fields = ("id", "username", "email", "phone", "display_name", "password")
        read_only_fields = ("id",)
        extra_kwargs = {
            "email": {"required": False, "allow_blank": True},
            "phone": {"required": True, "allow_null": False},
        }

    def validate_phone(self, value):
        return normalize_phone(value)

    def validate_email(self, value):
        email = value.strip().lower()
        if email and User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account already uses this email.")
        return email

    def validate(self, attrs):
        candidate = User(
            username=attrs.get("username"),
            email=attrs.get("email", ""),
            phone=attrs.get("phone"),
        )
        validate_password(attrs["password"], user=candidate)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class IdentifierTokenObtainPairSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=False, allow_blank=False)
    username = serializers.CharField(required=False, allow_blank=False)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        identifier = attrs.get("identifier") or attrs.get("username")
        if not identifier:
            raise serializers.ValidationError(
                {"identifier": "Enter a phone number, email, or username."}
            )
        user = authenticate(
            request=self.context.get("request"),
            username=identifier,
            password=attrs["password"],
        )
        if user is None:
            raise AuthenticationFailed(
                "No active account found with the supplied credentials."
            )

        from apps.cart.services import merge_guest_carts

        merge_guest_carts(
            user,
            self.context["request"].headers.get("X-Cart-Session"),
        )
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        return {"refresh": str(refresh), "access": str(refresh.access_token)}


class OTPRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254)

    def validate_identifier(self, value):
        value = value.strip()
        if "@" in value:
            return value.lower()
        return normalize_phone(value)


class OTPVerifySerializer(OTPRequestSerializer):
    code = serializers.RegexField(r"^\d{6}$", write_only=True)


class OTPRequestResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()


class TokenPairResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class UserProfileSerializer(serializers.ModelSerializer):
    is_super_admin = serializers.SerializerMethodField()
    branch_memberships = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "phone",
            "display_name",
            "first_name",
            "last_name",
            "is_staff",
            "is_super_admin",
            "branch_memberships",
        )
        read_only_fields = ("id", "username")
        extra_kwargs = {"email": {"required": False, "allow_blank": True}}

    def get_is_super_admin(self, user):
        return user.is_superuser

    def get_branch_memberships(self, user):
        return [
            {
                "branch_id": str(membership.branch_id),
                "branch_name": membership.branch.name,
                "branch_slug": membership.branch.slug,
                "role": membership.role,
            }
            for membership in BranchMembership.objects.filter(
                user=user,
                is_active=True,
                branch__is_active=True,
            ).select_related("branch")
        ]

    def validate_phone(self, value):
        if value in ("", None):
            return value
        return normalize_phone(value)

    def validate_email(self, value):
        email = value.strip().lower()
        if email and User.objects.filter(email__iexact=email).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("An account already uses this email.")
        return email


class CustomerAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = (
            "id",
            "recipient_name",
            "phone",
            "address_line_1",
            "address_line_2",
            "area",
            "directions",
            "latitude",
            "longitude",
            "is_default",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_phone(self, value):
        return normalize_phone(value)

    def validate(self, attrs):
        latitude = attrs.get("latitude", getattr(self.instance, "latitude", None))
        longitude = attrs.get("longitude", getattr(self.instance, "longitude", None))
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError("Latitude and longitude must be provided together.")
        return attrs
