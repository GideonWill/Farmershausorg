from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import OTPChallenge, User


class AccountApiTests(APITestCase):
    def test_registration_does_not_allow_privilege_escalation(self):
        response = self.client.post(
            "/api/v1/auth/register/",
            {
                "username": "new-customer",
                "phone": "+233 55 420 8447",
                "password": "Random-Password-93!",
                "is_superuser": True,
                "is_staff": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="new-customer")
        self.assertEqual(user.phone, "+233554208447")
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)

    def test_customers_can_only_retrieve_their_own_addresses(self):
        owner = User.objects.create_user(username="owner", password="random-password-93!")
        other = User.objects.create_user(username="other", password="random-password-93!")
        address = owner.addresses.create(
            recipient_name="Owner",
            phone="+233554208441",
            address_line_1="1 Example Street",
            area="Dome",
        )
        self.client.force_authenticate(user=other)

        list_response = self.client.get("/api/v1/addresses/")
        detail_response = self.client.get(f"/api/v1/addresses/{address.pk}/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data, [])
        self.assertEqual(detail_response.status_code, 404)

    def test_token_endpoint_accepts_registered_username(self):
        User.objects.create_user(username="login-customer", password="Random-Password-93!")

        response = self.client.post(
            "/api/v1/auth/token/",
            {"username": "login-customer", "password": "Random-Password-93!"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_password_login_accepts_phone_and_email_identifiers(self):
        User.objects.create_user(
            username="identity-login",
            email="identity@example.test",
            phone="+233554208445",
            password="Random-Password-93!",
        )

        for identifier in ("+233 55 420 8445", "IDENTITY@example.test"):
            response = self.client.post(
                "/api/v1/auth/token/",
                {"identifier": identifier, "password": "Random-Password-93!"},
                format="json",
            )
            self.assertEqual(response.status_code, 200)
            self.assertIn("access", response.data)

    def test_otp_request_does_not_disclose_unknown_accounts(self):
        user = User.objects.create_user(
            username="otp-customer",
            phone="+233554208446",
            password="Random-Password-93!",
        )

        with override_settings(DEBUG=True):
            with self.assertLogs("apps.accounts.otp", level="WARNING") as logs:
                response = self.client.post(
                    "/api/v1/auth/otp/request/",
                    {"identifier": user.phone},
                    format="json",
                )
        unknown = self.client.post(
            "/api/v1/auth/otp/request/",
            {"identifier": "+233554208447"},
            format="json",
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data, unknown.data)
        self.assertTrue(any("Development OTP" in message for message in logs.output))
        self.assertEqual(OTPChallenge.objects.count(), 1)

    def test_otp_verify_consumes_challenge_once(self):
        user = User.objects.create_user(
            username="otp-verify",
            email="otp@example.test",
            password="Random-Password-93!",
        )
        challenge = OTPChallenge.objects.create(
            identifier=user.email,
            code_hash=make_password("123456"),
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        payload = {"identifier": user.email, "code": "123456"}
        first = self.client.post("/api/v1/auth/otp/verify/", payload, format="json")
        replay = self.client.post("/api/v1/auth/otp/verify/", payload, format="json")

        challenge.refresh_from_db()
        self.assertEqual(first.status_code, 200)
        self.assertEqual(replay.status_code, 401)
        self.assertIsNotNone(challenge.consumed_at)
