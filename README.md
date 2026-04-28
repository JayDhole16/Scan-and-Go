# Scan & Go — Checkout System

![CI](https://github.com/your-username/scan-and-go/actions/workflows/ci.yml/badge.svg)
![Docker](https://github.com/your-username/scan-and-go/actions/workflows/docker.yml/badge.svg)

A scan-and-pay retail checkout system. Customers scan product barcodes with their phone, pay via Razorpay, and walk out through an RFID-verified gate — no cashier, no queue.

Built as a TE Mini Project at A.P. Shah Institute of Technology, Department of CS & Engineering (AI & ML), Academic Year 2025–2026.

---

## Features

- Barcode scanning via device camera (no dedicated hardware needed for customers)
- Razorpay payment integration with server-side verification
- RFID gate exit control — gate only opens when all items are paid
- Role-based access: customer, store admin, super admin
- Store admin dashboard — manage products, view revenue and transaction stats
- Super admin dashboard — create stores, assign admins, view platform analytics
- Purchase history with receipt and QR code
- PWA support — installable on mobile, works offline for cached pages
- Fully Dockerized for local development and deployment

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, shadcn/ui, Tailwind CSS |
| Auth & Database | Supabase (PostgreSQL + Row Level Security) |
| Payments | Razorpay |
| Backend API | Supabase Edge Functions (Deno) |
| RFID Gate Service | FastAPI (Python 3.11) |
| Gate Hardware | ESP32 + MFRC522 RFID reader |
| Containerization | Docker, Docker Compose |
| Deployment | Vercel (frontend) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Customer's Phone                      │
│   React SPA (PWA)  ──►  Supabase Auth  ──►  Razorpay SDK   │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
                ┌────────────▼────────────┐
                │     Supabase Platform    │
                │  ┌──────────────────┐   │
                │  │   PostgreSQL DB   │   │
                │  │  (RLS policies)  │   │
                │  └──────────────────┘   │
                │  ┌──────────────────┐   │
                │  │  Edge Functions  │   │
                │  │ create-order     │   │
                │  │ verify-payment   │   │
                │  │ rfid-gate-check  │   │
                │  └──────────────────┘   │
                └─────────────────────────┘
                             │
                ┌────────────▼────────────┐
                │   FastAPI RFID Service   │
                │   (Backend/main.py)      │
                └────────────┬────────────┘
                             │ HTTP
                ┌────────────▼────────────┐
                │   ESP32 + MFRC522        │
                │   (Physical Gate)        │
                └─────────────────────────┘
```

### Payment Flow

```
User scans items → Cart → create-razorpay-order (Edge Fn)
  → Razorpay modal → User pays
  → verify-razorpay-payment (Edge Fn)
      → Verify with Razorpay API
      → Mark products is_paid = true
      → Deactivate cart
  → Payment Success page + QR receipt
```

### RFID Gate Flow

```
Customer approaches gate
  → ESP32 reads RFID tag(s)
  → POST /check-payment to FastAPI (or rfid-gate-check Edge Fn)
  → Check products.is_paid in Supabase
  → All paid? → Open gate (relay/servo)
  → Any unpaid? → Deny, alert
```

---

## Project Structure

```
scan-and-go/
├── src/                          # React frontend
│   ├── pages/                    # Route-level components
│   ├── components/               # Shared UI components (shadcn/ui)
│   ├── hooks/                    # useAuth, useCart context providers
│   ├── integrations/supabase/    # Auto-generated client & types
│   └── lib/                      # Supabase helpers, utils
├── supabase/
│   ├── functions/                # Deno Edge Functions
│   │   ├── create-razorpay-order/
│   │   ├── verify-razorpay-payment/
│   │   └── rfid-gate-check/
│   └── migrations/               # SQL migrations
├── Backend/                      # FastAPI RFID gate service
│   ├── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── backend-gate/                 # Alternative gate service (SQLAlchemy + local Postgres)
│   ├── database.py
│   ├── database_schema.sql
│   ├── Dockerfile
│   └── docker-compose.yml
├── esp32-gate/                   # ESP32 Arduino firmware
│   ├── main.ino
│   └── README.md
├── public/                       # PWA assets, icons, manifest
├── Dockerfile                    # Frontend multi-stage build
├── docker-compose.yml            # Full stack local dev
├── nginx.conf                    # SPA routing for nginx
└── .env.example                  # Environment variable template
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Razorpay](https://razorpay.com) account (test keys work)
- Docker & Docker Compose (optional, for containerized setup)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/scan-and-go.git
cd scan-and-go
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in your values in `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_RAZORPAY_KEY_ID=rzp_test_your_key
```

### 3. Set Up Database

Apply migrations to your Supabase project:

```bash
npx supabase db push
```

Or run the SQL files manually in the Supabase SQL editor:
- `supabase/migrations/20260116183001_*.sql` — full schema
- `supabase/migrations/20260116183014_*.sql` — function fix
- `supabase/migrations/20260117000000_*.sql` — role policies

### 4. Deploy Edge Functions

```bash
npx supabase functions deploy create-razorpay-order
npx supabase functions deploy verify-razorpay-payment
npx supabase functions deploy rfid-gate-check
```

Set secrets in Supabase Dashboard → Edge Functions → Secrets:

```
RAZORPAY_KEY_ID      = rzp_test_your_key
RAZORPAY_KEY_SECRET  = your_secret
SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
```

### 5. Run Locally

```bash
npm run dev
```

App runs at `http://localhost:8080`

---

## Docker Setup

### Run Everything with One Command

```bash
cp .env.example .env
cp Backend/.env.example Backend/.env
# fill in both .env files

docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend (nginx) | http://localhost:3000 |
| RFID Gate API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

### Build Frontend Only

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your_anon_key \
  --build-arg VITE_RAZORPAY_KEY_ID=rzp_test_your_key \
  -t scan-and-go-frontend .
```

### RFID Gate Service Only

```bash
cd Backend
cp .env.example .env
docker build -t rfid-gate .
docker run -p 8000:8000 --env-file .env rfid-gate
```

---

## RFID Gate Hardware Build

This section covers building the physical exit gate using an ESP32 and MFRC522 RFID reader.

### Components

| Component | Approx. Cost |
|-----------|-------------|
| ESP32-WROOM-32 dev board | ₹350 |
| MFRC522 RFID reader module | ₹150 |
| 5V relay module (1-channel) | ₹80 |
| 12V solenoid lock or servo motor | ₹300–600 |
| Green + Red LEDs | ₹20 |
| Piezo buzzer | ₹30 |
| Jumper wires + breadboard | ₹100 |
| 5V power supply (USB or adapter) | ₹150 |

### Wiring Diagram

```
MFRC522 Module → ESP32
  SDA  (SS)  → GPIO 5
  SCK        → GPIO 18
  MOSI       → GPIO 23
  MISO       → GPIO 19
  RST        → GPIO 22
  3.3V       → 3.3V
  GND        → GND

Relay module
  IN         → GPIO 13
  VCC        → 5V
  GND        → GND
  NO/COM     → Solenoid lock circuit

LEDs (with 220Ω resistors)
  Green      → GPIO 2
  Red        → GPIO 4

Buzzer
  +          → GPIO 15
  -          → GND
```

### Flashing the Firmware

1. Install [Arduino IDE 2.x](https://www.arduino.cc/en/software)

2. Add ESP32 board support — go to File → Preferences → Additional Board URLs:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```

3. Install boards: Tools → Board Manager → search "esp32" → install by Espressif

4. Install libraries via Tools → Library Manager:
   - `MFRC522` by GithubCommunity
   - `ArduinoJson` by Benoit Blanchon

5. Open `esp32-gate/main.ino`

6. Update the config at the top of the file:
   ```cpp
   const char* WIFI_SSID     = "YourWiFiName";
   const char* WIFI_PASSWORD = "YourWiFiPassword";
   const char* BACKEND_URL   = "http://192.168.1.100:8000/check-payment";
   ```
   Replace `192.168.1.100` with the IP of the machine running the FastAPI service.

7. Select board: Tools → Board → ESP32 Arduino → ESP32 Dev Module

8. Select port: Tools → Port → (your ESP32 COM port)

9. Click Upload

### How the Gate Works

1. ESP32 boots, connects to WiFi, initializes MFRC522
2. Red LED stays on (gate closed, idle)
3. Customer approaches gate — MFRC522 detects RFID tag on product
4. ESP32 reads the tag UID (e.g. `A1B2C3D4`)
5. Sends `POST /check-payment` with `{"rfid_id": "A1B2C3D4"}` to FastAPI
6. FastAPI queries Supabase: `SELECT is_paid FROM products WHERE rfid_id = 'A1B2C3D4'`
7. If `is_paid = true`:
   - Relay activates → gate/lock opens
   - Green LED on, short beep
   - Gate stays open for 3 seconds, then closes
8. If `is_paid = false` or tag not found:
   - Gate stays closed
   - Red LED flashes, 3 error beeps

### Connecting to Supabase Edge Function Instead

If you don't want to run the FastAPI service locally, point the ESP32 directly at the Supabase Edge Function:

```cpp
const char* BACKEND_URL = "https://your-project.supabase.co/functions/v1/rfid-gate-check";
const char* SUPABASE_ANON_KEY = "your_anon_key";
```

The Edge Function accepts `{"rfid_ids": ["A1B2C3D4"]}` and returns `{"allowed": true/false, ...}`. The firmware handles both response formats automatically.

### Assigning RFID Tags to Products

When adding a product in the store admin dashboard, fill in the `RFID ID` field with the tag's UID. You can read a tag's UID using the Serial Monitor after flashing — the ESP32 prints the UID of every scanned tag.

---

## API Endpoints

### FastAPI RFID Gate Service (`Backend/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/check-payment` | Check single RFID tag |
| POST | `/check-payment/bulk` | Check multiple RFID tags |
| GET | `/docs` | Swagger UI |

**POST /check-payment**
```json
// Request
{ "rfid_id": "A1B2C3D4" }

// Response
{ "paid": true, "name": "Product Name" }
```

**POST /check-payment/bulk**
```json
// Request
{ "rfid_ids": ["A1B2C3D4", "E5F6G7H8"] }

// Response
{
  "allowed": false,
  "missing": [],
  "unpaid": ["E5F6G7H8"],
  "products": [...]
}
```

### Supabase Edge Functions

| Function | Trigger | Description |
|----------|---------|-------------|
| `create-razorpay-order` | Frontend checkout | Creates Razorpay order |
| `verify-razorpay-payment` | After payment | Verifies + marks products paid |
| `rfid-gate-check` | ESP32 / gate hardware | Bulk RFID payment check |

---

## Environment Variables

| Variable | Where Used | Description |
|----------|-----------|-------------|
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anon/public key |
| `VITE_RAZORPAY_KEY_ID` | Frontend | Razorpay publishable key |
| `SUPABASE_URL` | Backend, Edge Fns | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend, Edge Fns | Supabase service role key (keep secret) |
| `RAZORPAY_KEY_ID` | Edge Functions | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Edge Functions | Razorpay secret (keep secret) |
| `ALLOWED_ORIGINS` | FastAPI | CORS allowed origins |

See `.env.example` for the full template.

---

## User Roles

| Role | Capabilities |
|------|-------------|
| `user` | Scan products, manage cart, pay, view history |
| `admin` | Manage products for their store, view store stats |
| `super_admin` | Create stores, assign admins, view platform analytics |

Roles are stored in the `user_roles` table and enforced via Supabase Row Level Security policies.

---

## Local Development

```bash
npm run dev          # Start Vite dev server on :8080
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run Vitest tests once
npm run test:watch   # Vitest in watch mode
```

For the FastAPI service:
```bash
cd Backend
pip install -r requirements.txt
uvicorn main:app --reload
# API at http://localhost:8000
# Docs at http://localhost:8000/docs
```

---

## Deployment

### Frontend → Vercel

```bash
vercel deploy
```

SPA rewrites are configured in `vercel.json`. Set environment variables in the Vercel dashboard under Project → Settings → Environment Variables.

### Frontend → Docker + Any VPS

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=... \
  --build-arg VITE_SUPABASE_ANON_KEY=... \
  --build-arg VITE_RAZORPAY_KEY_ID=... \
  -t scan-and-go .

docker run -p 80:80 scan-and-go
```

### RFID Gate Service → VPS / Raspberry Pi

```bash
cd Backend
docker build -t rfid-gate .
docker run -d -p 8000:8000 --env-file .env --restart unless-stopped rfid-gate
```

---

## CI/CD

Three GitHub Actions workflows run automatically:

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | Every push / PR to `main` | Lint → Typecheck → Test → Build |
| `docker.yml` | Push to `main` or version tag | Builds and pushes Docker images to GitHub Container Registry |
| `deploy.yml` | Push to `main` | Deploys frontend to Vercel |

### Required GitHub Secrets

Go to your repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Description |
|--------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_RAZORPAY_KEY_ID` | Razorpay publishable key |
| `VERCEL_TOKEN` | Vercel API token (Account Settings → Tokens) |
| `VERCEL_ORG_ID` | Found in `.vercel/project.json` or Vercel dashboard |
| `VERCEL_PROJECT_ID` | Found in `.vercel/project.json` or Vercel dashboard |

The Docker workflow uses `GITHUB_TOKEN` (automatic, no setup needed) to push images to `ghcr.io`.

### Pulling Docker Images (after first push)

```bash
# Frontend
docker pull ghcr.io/your-username/scan-and-go/frontend:main

# RFID Gate Service
docker pull ghcr.io/your-username/scan-and-go/rfid-gate:main
```

---

## Screenshots

> Add screenshots here after deployment.

| Home / Store Selection | Barcode Scanner | Cart & Payment |
|------------------------|-----------------|----------------|
| _screenshot_ | _screenshot_ | _screenshot_ |

| Payment Success | Admin Dashboard | Super Admin |
|-----------------|-----------------|-------------|
| _screenshot_ | _screenshot_ | _screenshot_ |

---

## Future Improvements

- Webhook-based payment confirmation (more reliable than polling)
- Push notifications after successful payment
- Multi-RFID scanning (read all tags at once before gate check)
- Offline-first cart with sync on reconnect
- Admin analytics with charts (revenue over time, top products)
- CI/CD pipeline with GitHub Actions
- Rate limiting on Edge Functions
- TypeScript strict mode enabled

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[MIT](LICENSE)
#   S c a n - a n d - G o 
 
 