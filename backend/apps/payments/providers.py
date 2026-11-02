import base64
import hashlib
import hmac
import json
import logging
import os
import re
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


logger = logging.getLogger(__name__)


class PaymentProviderError(Exception):
    pass


def resolve_credentials(account):
    secret_ref = account.credentials_secret_ref
    if not secret_ref.startswith("secret://"):
        raise ImproperlyConfigured("Payment credentials must use a secret:// reference.")
    env_key = "FH_SECRET__" + re.sub(r"[^A-Za-z0-9]+", "__", secret_ref.removeprefix("secret://")).upper()
    value = os.getenv(env_key)
    if not value:
        raise ImproperlyConfigured(f"Payment secret environment variable {env_key} is not configured.")
    try:
        credentials = json.loads(value)
    except json.JSONDecodeError as error:
        raise ImproperlyConfigured(f"{env_key} must contain a JSON object.") from error
    if not isinstance(credentials, dict):
        raise ImproperlyConfigured(f"{env_key} must contain a JSON object.")
    return credentials


class PaymentProvider:
    provider_code = None

    def __init__(self, account, credentials=None):
        self.account = account
        self.credentials = credentials or resolve_credentials(account)

    def initiate(self, payment, attempt, *, customer_name, phone, email):
        if not getattr(settings, "HUBTEL_LIVE_ENABLED", False):
            return {
                "checkout_url": f"/orders/{payment.order.order_number}?sandbox_payment=1",
                "provider_reference": f"sandbox-{attempt.idempotency_key[:12]}",
                "is_sandbox": True,
            }
        raise NotImplementedError

    def verify_webhook(self, raw_body, headers):
        raise NotImplementedError

    def refund(self, refund):
        raise NotImplementedError


class HubtelProvider(PaymentProvider):
    provider_code = "hubtel"

    def _request(self, endpoint, payload):
        if not isinstance(endpoint, str) or not endpoint.startswith("https://"):
            raise ImproperlyConfigured("Hubtel endpoints must use HTTPS.")
        client_id = self.credentials.get("client_id")
        client_secret = self.credentials.get("client_secret")
        if not client_id or not client_secret:
            raise ImproperlyConfigured("Hubtel client_id and client_secret must be configured.")
        token = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode("ascii")
        request = Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Basic {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=20) as response:
                body = response.read()
        except HTTPError as error:
            logger.warning("Hubtel request rejected with HTTP %s", error.code)
            raise PaymentProviderError(f"Hubtel request failed with HTTP {error.code}.") from error
        except (URLError, TimeoutError) as error:
            raise PaymentProviderError("Hubtel is temporarily unreachable.") from error
        try:
            result = json.loads(body)
        except json.JSONDecodeError as error:
            raise PaymentProviderError("Hubtel returned a non-JSON response.") from error
        if not isinstance(result, dict):
            raise PaymentProviderError("Hubtel returned an invalid response.")
        return result

    def initiate(self, payment, attempt, *, customer_name, phone, email):
        if not getattr(settings, "HUBTEL_LIVE_ENABLED", False):
            return {
                "checkout_url": f"/orders/{payment.order.order_number}?sandbox_payment=1",
                "provider_reference": f"sandbox-{attempt.idempotency_key[:12]}",
                "is_sandbox": True,
            }
        endpoint = self.credentials.get("checkout_endpoint")
        if not endpoint:
            raise ImproperlyConfigured("Hubtel checkout_endpoint is not configured.")
        if not self.account.settlement_verified:
            raise ImproperlyConfigured("This branch's Hubtel settlement destination is not verified.")
        callback_url = getattr(settings, "HUBTEL_WEBHOOK_URL", "")
        return_url = getattr(settings, "HUBTEL_RETURN_URL", "")
        if not callback_url or not return_url:
            raise ImproperlyConfigured("Hubtel callback and return URLs must be configured.")
        amount = Decimal(payment.amount_minor) / Decimal(100)
        payload = {
            "totalAmount": str(amount.quantize(Decimal("0.01"))),
            "description": f"FarmersHaus order {payment.order.order_number}",
            "callbackUrl": callback_url,
            "returnUrl": return_url,
            "cancellationUrl": return_url,
            "merchantAccountNumber": self.account.momo_business_line,
            "clientReference": attempt.idempotency_key,
            "payeeName": customer_name,
            "payeeMobileNumber": phone,
            "payeeEmail": email,
            "paymentMethod": payment.method,
            "network": payment.network,
        }
        response = self._request(endpoint, payload)
        data = response.get("data") if isinstance(response.get("data"), dict) else response
        checkout_url = data.get("checkoutUrl") or data.get("checkout_url")
        reference = data.get("checkoutId") or data.get("reference") or data.get("transactionId")
        if not isinstance(checkout_url, str) or not checkout_url.startswith("https://"):
            raise PaymentProviderError("Hubtel did not return a secure checkout URL.")
        return {"checkout_url": checkout_url, "provider_reference": str(reference or "")}

    def verify_webhook(self, raw_body, headers):
        secret = self.credentials.get("webhook_secret")
        signature_header = self.credentials.get(
            "signature_header",
            "X-Hubtel-Signature",
        )
        signature = headers.get(signature_header) or headers.get(signature_header.lower())
        if not secret or not signature:
            return False
        expected = hmac.new(
            str(secret).encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        candidate = signature.removeprefix("sha256=").strip()
        return hmac.compare_digest(expected, candidate)

    def refund(self, refund):
        endpoint = self.credentials.get("refund_endpoint")
        if not endpoint:
            raise ImproperlyConfigured("Hubtel refund_endpoint is not configured.")
        response = self._request(
            endpoint,
            {
                "transactionReference": refund.payment.provider_reference,
                "clientReference": refund.idempotency_key,
                "amount": str((Decimal(refund.amount_minor) / Decimal(100)).quantize(Decimal("0.01"))),
                "reason": refund.reason,
            },
        )
        data = response.get("data") if isinstance(response.get("data"), dict) else response
        return str(data.get("refundReference") or data.get("reference") or refund.idempotency_key)


def get_payment_provider(account):
    if account.provider == "hubtel":
        return HubtelProvider(account)
    raise ImproperlyConfigured(f"Payment provider {account.provider!r} is not implemented.")
