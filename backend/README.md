# FarmersHaus API

Django REST Framework API for the FarmersHaus multi-branch grocery platform. Implemented surfaces include customer accounts/OTP and addresses, branches, catalogue, branch inventory, carts and baskets, checkout, orders, Hubtel payment integration boundary, vouchers, notifications, staff fulfillment, refunds, reports, and audit history. See [`../docs/architecture.md`](../docs/architecture.md) for the architecture and provider onboarding conditions.

## Requirements

- Python 3.12–3.14
- PostgreSQL for production; development settings use SQLite

## Development

From the repository root, the setup script creates a local virtual environment, installs the dependencies, and prepares `.env` with a random local development key:

```powershell
npm.cmd run backend:setup
npm.cmd run backend:check
npm.cmd run backend:migrate
npm.cmd run backend:test
npm.cmd run backend:schema
npm.cmd run backend:dev
```

The dev settings are selected by default. Django admin, API schema, and API docs are mounted at `/admin/`, `/api/schema/`, and `/api/docs/`.

The public API includes:

- `POST /api/v1/auth/token/` using `identifier` (phone, email, or existing username) and password.
- `POST /api/v1/auth/otp/request/` and `/api/v1/auth/otp/verify/` for one-time-code sign-in. Email uses Django's email backend. Phone delivery uses the class configured by `FARMERSHAUS_SMS_OTP_BACKEND`; local development prints the code to the terminal.
- `GET /api/v1/site-settings/`, `GET /api/v1/branches/`, and `GET /api/v1/branches/nearest/?latitude=...&longitude=...`.
- `GET /api/v1/products/?branch=<uuid>` with `search`, `category`, `tag`, `organic`, `in_season`, `min_price`, `max_price`, `ordering`, `page`, and `page_size` query parameters. Search suggestions are at `/api/v1/search/suggestions/?branch=<uuid>&q=...`.
- `GET /api/v1/cart/`, `POST /api/v1/cart/items/`, item `PATCH/DELETE`, and `POST /api/v1/cart/validate/`. Guest requests must send an unguessable UUIDv4 in `X-Cart-Session`; authenticated login merges that guest cart into the customer's cart.
- `GET /api/v1/basket-categories/` and `GET /api/v1/basket-packages/?branch=<uuid>`. Placeholder packages are explicitly marked with `is_placeholder`.
- Authenticated addresses use the account routes: `GET/POST /api/v1/addresses/`, then `PATCH/DELETE /api/v1/addresses/<uuid>/`.
- `GET /api/v1/fulfillment-slots/?branch=<uuid>&method=delivery|pickup` lists slots with remaining capacity.
- `POST /api/v1/checkout/` creates an unpaid order and atomically reserves stock.
- `GET /api/v1/orders/`, `GET /api/v1/orders/<order-number>/`, and `/tracking/`; `POST .../cancel/` permits customer cancellation only before payment. Paid cancellations/refunds are Super Admin-only.
- `POST /api/v1/payments/orders/<order-number>/initiate/` starts hosted Mobile Money or card checkout; `/retry/` starts a new attempt. Use a new idempotency key for each new attempt. The browser return page is never treated as proof of payment.
- `POST /api/v1/payments/webhooks/hubtel/` accepts provider callbacks. Payment status changes to succeeded only after webhook signature, reference, amount, and currency checks pass.
- `GET /api/v1/payments/reconciliation/daily/?branch=<uuid>&date=YYYY-MM-DD` provides an internal per-branch daily payment summary and pending/failed items. Provider-statement matching still requires Hubtel reconciliation API/export details.
- `POST /api/v1/vouchers/validate/` checks a code against a cart. Super Admins can create up to 500 random codes per request at `POST /api/v1/vouchers/bulk/`; individual vouchers and their product, basket, and branch scopes are editable in Django admin.
- `GET /api/v1/me/` includes the signed-in user's active branch memberships and Super Admin flag. `GET /api/v1/staff/branches/` returns all branches to Super Admins and only assigned active branches to other staff.
- Staff orders are branch-scoped: `GET /api/v1/staff/orders/?branch=<uuid>` returns paid active orders; Super Admins may add `include_unpaid=true` for cancellation workflows. `PATCH /api/v1/staff/orders/<order-number>/status/` advances fulfillment, `PATCH .../rider/` assigns the delivery rider, and `POST .../items/adjust/` removes/substitutes a product line and flags any payment difference for review. The branch membership check is enforced by each API endpoint, not by client filtering.
- Staff inventory APIs at `/api/v1/branches/<branch-uuid>/inventory/` support read, per-product availability/price updates, idempotent stock adjustments, and audited `inventory/export.csv` / `inventory/import.csv` operations. CSV imports validate the full batch before applying any changes.
- Staff reports are at `/api/v1/staff/reports/?branch=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD`; they include daily paid sales/reconciliation, best sellers, payment status, voucher redemptions, and audit counts. `/api/v1/staff/reports/export/?branch=<uuid>&file_format=csv|xlsx` exports the sales reconciliation. `/api/v1/staff/audit/?branch=<uuid>` returns the 200 most recent branch audit events. Both enforce membership scoping; Super Admin may query global reports.
- Super Admin refund review is available at `GET /api/v1/payments/staff/refunds/` and `POST /api/v1/payments/staff/refunds/<order-number>/approve-adjustment/`. The endpoint requests a provider refund only for the recorded adjustment difference; unresolved provider errors remain visible for retry. Existing `/api/v1/payments/refunds/<refund-uuid>/retry/` retries requested/failed refunds. Paid-order cancellation remains Super Admin-only and requests a full refund; unpaid orders may be cancelled without a refund.
- `GET /api/v1/notifications/` and `POST /api/v1/notifications/<uuid>/read/` are customer-scoped. The staff dashboard polls the paid-order board; `/api/v1/staff/orders/paid-stream/?branch=<uuid>` remains available for streaming clients.
- `GET /api/v1/orders/<order-number>/receipt.pdf` returns a PDF receipt after confirmed payment.

Seed development data from the repository root after setting a local-only password:

```powershell
$env:FARMERSHAUS_SEED_PASSWORD = Read-Host "Choose a local seed password"
npm.cmd run backend:seed
Remove-Item Env:FARMERSHAUS_SEED_PASSWORD
```

This repeatable command creates four branches, 63 products with varied branch inventory, five ready-made example baskets (fruit, vegetables, family groceries, salad, and soup starter) with component lists and prices summed from the seeded catalogue, and `demo-customer`, `demo-staff`, `demo-manager`, and `demo-super-admin` accounts. It refuses to run outside development settings. Branch coordinates are editable geocoded landmark/area pins; verify exact storefront pins and opening hours before launch. The example baskets are editable in Django admin before launch.

Celery is configured with Redis as its broker. Start Redis, then run a worker and beat scheduler in separate terminals from `backend`:

```powershell
.\.venv\Scripts\celery.exe -A config worker --loglevel=info
.\.venv\Scripts\celery.exe -A config beat --loglevel=info
```

Beat sweeps expired stock reservations every minute. Email uses Django's configured backend, while the development SMS/WhatsApp-ready provider logs masked recipients.

## Checkout-to-payment example

Replace values with IDs from the selected branch, saved address, cart, and available time-slot API. Pass the access token obtained from the login endpoints:

```powershell
$headers = @{
  Authorization = "Bearer $accessToken"
  "Content-Type" = "application/json"
}

$checkoutBody = @{
    cart_id = $cartId
    branch_id = $branchId
    fulfillment_method = "delivery"
    address_id = $addressId
    delivery_zone_id = $deliveryZoneId
    slot_id = $slotId
    voucher_code = ""
  } | ConvertTo-Json -Compress
$orderJson = $checkoutBody | curl.exe --silent --show-error --fail `
  -X POST http://localhost:8000/api/v1/checkout/ `
  -H "Authorization: Bearer $accessToken" `
  -H "Content-Type: application/json" `
  --data-binary "@-"
$order = $orderJson | ConvertFrom-Json

$paymentBody = @{
    method = "mobile_money"
    network = "mtn"
    idempotency_key = [guid]::NewGuid().ToString()
  } | ConvertTo-Json -Compress
$paymentJson = $paymentBody | curl.exe --silent --show-error --fail `
  -X POST "http://localhost:8000/api/v1/payments/orders/$($order.order_number)/initiate/" `
  -H "Authorization: Bearer $accessToken" `
  -H "Content-Type: application/json" `
  --data-binary "@-"
$payment = $paymentJson | ConvertFrom-Json

$payment.current_attempt.checkout_url
```

The customer completes payment at the returned provider URL. Only the authenticated provider webhook can confirm payment; never mark an order paid from a frontend redirect. Retry with a **new** idempotency key after a failed attempt.

## Hubtel onboarding and production gate

The provider adapter and Mobile Money/card hosted-checkout paths are implemented, but live initiation is intentionally disabled by default (`HUBTEL_LIVE_ENABLED=false`). Hubtel technical documentation was not accessible during implementation, so the current adapter's checkout payload, response fields, raw-body HMAC-SHA256 callback header (`X-Hubtel-Signature` by default), and refund payload must be confirmed against Hubtel's current merchant specification before enabling it. Do not treat this provisional protocol as verified provider documentation.

For each branch, configure a `BranchPaymentAccount` with its Hubtel account ID and settlement business line. Keep `is_enabled` off until the account is onboarded, and set `settlement_verified` only after Hubtel confirms settlement to the intended branch. Place each branch's JSON credentials in the deployment secret manager under its existing `credentials_secret_ref`; expose the JSON at runtime through the corresponding `FH_SECRET__...` environment variable. The secret object needs the provider's checkout endpoint, client credentials, webhook secret, and refund endpoint. Never put credentials in this file, chat, or source control. Configure the public callback/return URLs, verify the provider's signature and status lookup contract, then separately enable live payment in deployment configuration.

The daily reconciliation endpoint currently reports FarmersHaus's own recorded transactions; matching against Hubtel's settlement statement/API is not claimed until that provider interface is available.

## Production

Set `DJANGO_SETTINGS_MODULE=config.settings.prod`, PostgreSQL environment variables, secure `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS`. Run `python manage.py check --deploy` and apply migrations during deployment.
