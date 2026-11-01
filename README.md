# FarmersHaus

FarmersHaus is a multi-branch grocery ordering platform for Accra, Ghana. This repository contains the Django API scaffold, the React storefront scaffold, and the proposed system architecture.

## Project layout

- [`backend/`](./backend/README.md): Django REST Framework API scaffold.
- [`frontend/`](./frontend/README.md): Vite, React, TypeScript, Tailwind CSS, and router scaffold.
- [`docs/architecture.md`](./docs/architecture.md): proposed data model, API, authorization, order lifecycle, and payment design.

## Launch branches

These are initial database records, not hard-coded frontend choices:

1. FarmersHaus Dome — Aggrey Street, Dome, Accra
2. FarmersHaus Westland — 14 Ato Ahwoi Ave, Westland Junction, Accra
3. FarmersHaus North Legon — Wisconsin Road, Adjacent Antis, North Legon, Accra
4. FarmersHaus East Legon — ARS Roundabout, East Legon, Accra

Branch MoMo business lines must be configured per branch during provider onboarding; they are not inferred from the public support phone numbers.

## Prerequisites

- Python 3.12, 3.13, or 3.14
- Node.js 20.19 or newer and npm

## Quick start

From the repository root, in PowerShell or Command Prompt:

```powershell
npm.cmd run setup
npm.cmd run dev
```

`setup` installs the frontend dependencies, creates a backend virtual environment, installs Django dependencies, and creates a local `.env` with a generated development key. `dev` starts the API and frontend together. Use `npm.cmd run frontend:dev` or `npm.cmd run backend:dev` to start either service separately. `npm.cmd run backend:check`, `npm.cmd run backend:makemigrations`, `npm.cmd run backend:migrate`, `npm.cmd run backend:test`, and `npm.cmd run backend:schema` run the corresponding Django commands.

On shells where `npm` scripts are permitted, use `npm` instead of `npm.cmd`. The `.cmd` executable avoids PowerShell execution-policy errors when `npm` resolves to `npm.ps1`.

The backend includes phone/email password login, OTP login with a configurable SMS gateway, customer profile/addresses, public site settings, branch lookup, searchable branch-aware catalogue, branch-scoped inventory, guest/customer carts, checkout, orders, payments, vouchers, and food baskets. Staff operations are at `/staff` in the React app and include a branch-isolated order board, inventory workflows, reports, audit logs, rider assignment, and Super Admin refund review; use Django Admin for global branch/catalogue/content/user management. Live payment activation remains gated pending provider sandbox and branch settlement verification.

The frontend is a customer storefront connected to the branch, catalogue, basket, account, checkout, order, and payment APIs. See [`frontend/README.md`](./frontend/README.md) for implemented scope, integration limitations, environment configuration, and validation commands.

To load the four launch branches, a 63-product demo catalogue, per-branch stock differences, and test accounts, set a local-only seed password and run the development command:

```powershell
$env:FARMERSHAUS_SEED_PASSWORD = Read-Host "Choose a local seed password"
npm.cmd run backend:seed
Remove-Item Env:FARMERSHAUS_SEED_PASSWORD
```

The test usernames are `demo-customer`, `demo-staff`, `demo-manager`, and `demo-super-admin`; all use the temporary password entered above. Demo seeding is disabled outside development settings. Launch coordinates are geocoded neighborhood/landmark pins editable in Django admin; confirm exact storefront pins and replace placeholder hours before launch.

Phone OTP uses a provider-agnostic backend class configured with `FARMERSHAUS_SMS_OTP_BACKEND`; development logs codes to the terminal only. Production requires a real SMS backend and email backend in environment configuration.

## Brand

Use the supplied FarmersHaus logo at `frontend/public/brand/farmershaus-logo.png` and FCH sister-company brand system: green `#028940`, yellow `#FFC20D`, white `#FFFFFF`, Naveid Upright Variable for headlines, Footlong Office for subheads, and Bw Modelica SS01 for body copy. The font files should be supplied/licensed before they are added to the frontend.

Contact settings are managed as one admin-editable record: +233 55 420 8446, +233 55 048 8906, WhatsApp on both numbers, and info@farmershausgh.com.
