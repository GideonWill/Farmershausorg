# FarmersHaus storefront

The customer storefront is built with Vite, React, TypeScript, Tailwind CSS, React Router, TanStack Query, Zustand, Framer Motion, and Leaflet. It uses the Django API for branch-aware shopping, accounts, checkout, orders, payments, and location data.

## Requirements

- Node.js 20.19+ and npm

## Development

Run from the repository root:

```powershell
npm.cmd install
npm.cmd run frontend:dev
```

The API base URL defaults to `http://localhost:8000/api/v1`. Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` when the API runs elsewhere. The API must allow the storefront origin through CORS.

On first visit, the storefront requests browser location permission and automatically selects the nearest branch when available. If location access or the nearest-branch lookup fails, it selects an active branch from the API instead; customers can change the branch from the header at any time. Browsers may show their own location permission prompt, but the storefront does not block onboarding with a branch-selection dialog. The branch and guest cart session are persisted in local storage. Product browsing, availability, pricing, baskets, and cart contents are loaded from the API; product and category imagery falls back to the centralized `src/lib/images.ts` map.

## Validation

```powershell
npm.cmd run frontend:build
npm.cmd run frontend:lint
```

## Current scope

- Staff operations are available at `/staff` in the same React app. Team members sign in with their existing account; active branch memberships determine the branch list, while the API independently enforces branch access. The live paid-order board polls every 10 seconds, can sound/notify on newly paid orders after alerts are enabled, supports status changes, customer and address details, map links, print pick-lists, PDF receipts, rider assignment, and item removal/substitution. Removed or substituted items that create a payment difference are queued for Super Admin refund review.
- The staff inventory tab edits branch stock, availability, and price overrides, and supports audited CSV import/export. Reports show daily reconciliation, best sellers, payment statuses, and voucher use with CSV/XLSX downloads; the audit tab shows recent branch changes. Super Admins also get refund review/retry controls and a link to Django Admin for branches, products/categories, branch payment accounts/delivery zones, baskets, vouchers/redemptions, users/roles, banners, site content, and contact settings. Start the backend and frontend with the root quick-start commands; sign in using a seeded `demo-staff`, `demo-manager`, or `demo-super-admin` account. Enable browser notifications from the dashboard after signing in.
- Implemented: responsive storefront shell, branch selection and nearest-branch lookup, search suggestions, category/product browsing, product details, wishlist, baskets, cart drawer/full cart, availability handling, and responsive navigation. Customer pages include saved addresses, OTP/password authentication, authenticated checkout, voucher validation, order tracking, payment initiation/retry, cancellation rules, and receipts. A floating WhatsApp contact button stays fixed along the right side of the viewport. The homepage product showcase is a native horizontal carousel with touch/trackpad scrolling, arrow controls, centered focus, and no pinned or scroll-hijacking behavior.
- The Food Baskets page shows all API basket packages in one ready-made list, including unavailable packages with their add action disabled. Basket data refetches on page mount so newly added admin packages appear when returning to the page. The backend development seed command creates five editable example ready-made baskets from seeded catalogue products; run `npm.cmd run backend:seed` to populate them. The supplied FarmersHaus tote artwork remains visible in the ready-made empty state. Ready-made cards list their package components and branch price; prices come from the API, with no discount implied unless provided by the backend. Custom selections are added as individual cart items. Add actions use a reduced-motion-aware fly-to-basket animation and a short Web Audio confirmation sound. Tote artwork is at `public/brand/farmershaus-produce-tote.png`.
- The Find Us page uses OpenStreetMap/Leaflet and the branch coordinates returned by the API. Configure real branch coordinates and opening hours in Django admin before launch. The address form supports manual entry and a browser location pin; Google Places autocomplete is not configured.
- The checkout API currently requires authentication, so guest checkout is not available. Delivery zones are selected by the customer; the backend does not verify that a saved address falls inside a zone. The payment screen supports the API's Mobile Money and card flows, but branch/provider configuration determines which methods and network codes are accepted.
- Recipe pages are editorial frontend content because no recipe API exists. “Add available ingredients” matches recipe ingredient names against the selected branch's current product catalogue and only adds available matches. Contact forms and newsletter signup open a prefilled email draft because no submission endpoints exist.
- Reorder is best-effort: it matches order-line name snapshots against current products and adds available matches at the selected branch. The current order API does not expose product/package IDs, so unavailable matches and basket packages cannot be recreated exactly.
- Informational/legal pages summarize the known order and cancellation behavior. Have the business review and approve Terms and Privacy copy before launch.
- The homepage opens with `FarmToBasketExperience`, which plays the existing `src/assets/Farmers_harvesting_and_washing_p…_796fecb2.mp4` asset as a muted, inline looping hero video. Playback is not tied to page scrolling. Autoplay may be blocked by browser policy; in that case, or when reduced motion is enabled, visitors can start it with the on-video play control. The source is an MP4, 1280×720 at 24 fps, approximately 10.03 seconds and 7.58 MB.
- The source video is already a modest 720p clip. If page-load budgets require it, prepare and visually QA a smaller 720p web rendition (or a compatible alternate format) separately; keep the supplied source unchanged.
- The backend does not currently offer newsletter or contact-submission endpoints, so those forms open an email draft to the configured contact address. Testimonials are marked as coming soon rather than presenting fabricated customer reviews.

## Brand assets

Tailwind tokens and CSS font stacks follow the FCH sister-company primary palette: green `#028940`, yellow `#FFC20D`, and white `#FFFFFF`. The supplied FarmersHaus logo is at `public/brand/farmershaus-logo.png`. Add licensed font files to `public/brand/fonts/` when they are available; current type stacks use system fallbacks until then.
