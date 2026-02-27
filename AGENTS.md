# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**Scan & Go Checkout** — a scan-and-pay retail checkout system where users scan product barcodes in-store, pay via Razorpay, and walk out through an RFID-verified gate. Built with a React SPA frontend, Supabase backend (Postgres + Edge Functions), and companion hardware services for RFID gate checking.

## Build & Development Commands

- `npm run dev` — Start Vite dev server on port 8080
- `npm run build` — Production build
- `npm run build:dev` — Development build
- `npm run lint` — ESLint
- `npm run test` — Run all Vitest tests once (`vitest run`)
- `npm run test:watch` — Run Vitest in watch mode
- Run a single test: `npx vitest run src/test/example.test.ts`
- Run tests matching a pattern: `npx vitest run -t "pattern"`

### Backend (Python/FastAPI)

The `Backend/` directory contains a FastAPI service for RFID payment checking:
- Requires Python 3.11+ and the `supabase` Python package
- Run with: `uvicorn main:app` from the `Backend/` directory

The `backend-gate/` directory contains an alternative RFID gate service using SQLAlchemy + PostgreSQL:
- Install deps: `pip install -r requirements.txt`
- Docker support via `docker-compose.yml`

### Supabase

- Config in `supabase/config.toml`; migrations in `supabase/migrations/`
- Edge Functions in `supabase/functions/` (Deno runtime):
  - `create-razorpay-order` — Creates a Razorpay payment order
  - `verify-razorpay-payment` — Verifies payment, marks products as paid, deactivates cart
  - `rfid-gate-check` — Checks RFID tags against product payment status for gate exit

## Architecture

### Frontend (React SPA)

Path alias `@/` maps to `src/`. Uses shadcn/ui (Radix + Tailwind) for UI components.

**Routing** (`src/App.tsx`): React Router with three route groups:
- **User routes**: `/` (Home), `/scan` (Scanner), `/cart`, `/payment-success`, `/history`
- **Super admin routes**: `/admin/dashboard`, `/admin/stores`
- **Store admin routes**: `/store/dashboard`, `/store/products`, `/store/add-product`

**Provider hierarchy** (order matters): `QueryClientProvider` → `TooltipProvider` → `BrowserRouter` → `AuthProvider` → `CartProvider` → `Layout` → `Routes`

**Key context providers** (in `src/hooks/`):
- `useAuth` — Manages Supabase auth session, profile, role (`super_admin` | `admin` | `user`), and associated `storeId` for admin users. Auto-creates default profile and `user` role if missing.
- `useCart` — Cart state, store selection, add/remove items. Cart is scoped to a single store. Products can only be added from the selected store. Has logic to remove a product from other users' carts when one user adds it.

**Supabase client** is initialized in `src/integrations/supabase/client.ts` (auto-generated, do not edit) and re-exported from `src/lib/supabase.ts` which also contains auth helper functions (`signUp`, `signIn`, `signOut`, etc.).

### Database Schema (Supabase/Postgres)

Core tables (typed in `src/integrations/supabase/types.ts`):
- `profiles` — User profile (full_name, email, phone); keyed on `user_id`
- `user_roles` — Role assignment; enum: `super_admin`, `admin`, `user`
- `stores` — Store with `admin_id` linking to its admin user
- `products` — Products with `barcode_id`, `rfid_id`, `is_paid` flag, scoped to a `store_id`
- `carts` / `cart_items` — Active shopping carts per user/store, with product references
- `transactions` — Payment records with `product_ids[]`, `product_names[]`, `payment_status`

RPC functions: `assign_role_to_user`, `has_role`, `is_admin`, `is_super_admin`, `is_store_admin`, `can_add_product_to_cart`

### Payment Flow

1. Frontend creates a Razorpay order via the `create-razorpay-order` Edge Function (amount in paise)
2. Razorpay checkout opens in the browser
3. On success, frontend calls `verify-razorpay-payment` Edge Function which verifies the payment with Razorpay API, marks products as `is_paid = true`, and deactivates the cart

### RFID Gate Flow

Products have an optional `rfid_id`. The `rfid-gate-check` Edge Function (or `Backend/main.py`) accepts an array of RFID tags and returns whether all are paid, with lists of missing and unpaid tags.

## Key Conventions

- TypeScript strict mode is **off** (`strict: false`, `noImplicitAny: false`, `strictNullChecks: false` in tsconfig)
- `@typescript-eslint/no-unused-vars` is disabled
- Supabase types in `src/integrations/supabase/types.ts` are auto-generated — do not edit manually
- UI components live in `src/components/ui/` (shadcn/ui); use `cn()` from `@/lib/utils` for class merging
- Environment variables for the frontend are prefixed with `VITE_` (e.g. `VITE_SUPABASE_URL`)
- Tests use Vitest + jsdom + React Testing Library; test setup in `src/test/setup.ts`
- The app registers a service worker for PWA support (`src/main.tsx`)
- Deployed to Vercel with SPA rewrites configured in `vercel.json`
