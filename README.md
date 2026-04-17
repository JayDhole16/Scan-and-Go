# Scan & Go Checkout System

A scan-and-pay retail checkout system where users scan product barcodes in-store, pay via Razorpay, and walk out through an RFID-verified gate.

## Tech Stack

- **Frontend**: React + Vite + TypeScript + shadcn/ui + Tailwind CSS
- **Backend**: Supabase (Postgres + Edge Functions)
- **Payments**: Razorpay
- **Gate Service**: FastAPI (Python) + RFID hardware
- **Deployment**: Vercel (frontend)

## Project Structure

```
├── src/                    # React frontend
│   ├── pages/              # Route pages
│   ├── components/         # UI components (shadcn/ui)
│   ├── hooks/              # useAuth, useCart context hooks
│   └── integrations/       # Supabase client & types
├── supabase/
│   ├── functions/          # Edge Functions (Deno)
│   │   ├── create-razorpay-order/
│   │   ├── verify-razorpay-payment/
│   │   └── rfid-gate-check/
│   └── migrations/         # Database migrations
├── Backend/                # FastAPI RFID gate service (Python)
└── backend-gate/           # Alternative gate service with Docker
```

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Razorpay](https://razorpay.com) account (test keys work fine)

### Frontend Setup

1. Clone the repo:
   ```bash
   git clone <your-repo-url>
   cd <repo-name>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example env file and fill in your values:
   ```bash
   cp .env.example .env
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```
   App runs at `http://localhost:8080`

### Backend (FastAPI) Setup

```bash
cd Backend
cp .env.example .env
# fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
pip install -r requirements.txt
uvicorn main:app --reload
```

### Supabase Edge Functions

Deploy edge functions using the Supabase CLI:

```bash
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
supabase functions deploy rfid-gate-check
```

Set the required secrets in your Supabase project dashboard under **Settings > Edge Functions**:

```
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
SUPABASE_SERVICE_ROLE_KEY
```

### Database Migrations

```bash
supabase db push
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. See `.env.example` for all required variables.

> **Never commit your `.env` file.** It is gitignored by default.

## User Roles

| Role | Access |
|------|--------|
| `user` | Scan products, manage cart, pay |
| `admin` | Store admin — manage products for their store |
| `super_admin` | Manage all stores and users |

## Payment Flow

1. User scans products and adds them to cart
2. Frontend calls `create-razorpay-order` Edge Function
3. Razorpay checkout opens in browser
4. On success, `verify-razorpay-payment` marks products as paid and deactivates cart

## RFID Gate Flow

Products have an optional `rfid_id`. On exit, the gate hardware sends RFID tags to the `rfid-gate-check` Edge Function (or FastAPI service), which returns whether all items are paid.

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
```

## Deployment

The frontend is deployed to Vercel. SPA rewrites are configured in `vercel.json`.

```bash
vercel deploy
```
