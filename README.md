# 📡 PulseBoard — Server Intelligence Platform

A full-stack MERN application for monitoring any public server by IP. Add a server once, get instant geolocation, ISP, ASN, ping, and live status. Upgrade to Pro to unlock port scanning, SSL inspection, HTTP headers, and 7-day uptime history.

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 18 + Vite, Tailwind CSS, React Router v6  |
| Backend    | Node.js + Express (ESM)                          |
| Database   | MongoDB Atlas (Mongoose)                         |
| Cache      | Upstash Redis (REST via `@upstash/redis`)        |
| Payments   | Stripe (Checkout + Webhooks + Customer Portal)   |
| Deployment | Frontend: Vercel / Netlify · Backend: Northflank |

---

## Project Structure

```
pulseboard/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js          # MongoDB connection
│   │   │   ├── redis.js       # Upstash Redis + cache helpers
│   │   │   └── stripe.js      # Stripe client
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT protect + requirePro
│   │   ├── models/
│   │   │   ├── User.js        # User schema (auth + subscription)
│   │   │   ├── Server.js      # Server schema (IP, geo cache, status)
│   │   │   └── ServerSnapshot.js  # Uptime history (TTL 30d)
│   │   ├── routes/
│   │   │   ├── auth.js        # POST /register, POST /login, GET /me
│   │   │   ├── servers.js     # CRUD + /refresh + /pro-stats + /uptime
│   │   │   └── payments.js    # /checkout, /portal, /webhook
│   │   ├── services/
│   │   │   └── serverMonitor.js  # TCP ping, ip-api.com, port scan, SSL, HTTP
│   │   └── index.js           # Express app entry
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── AddServerModal.jsx
    │   │   ├── ServerCard.jsx
    │   │   ├── StatusBadge.jsx
    │   │   ├── MetricCard.jsx
    │   │   ├── PortTable.jsx
    │   │   ├── UptimeBar.jsx
    │   │   ├── ProGate.jsx        # Blur gate for locked Pro sections
    │   │   └── LoadingSpinner.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── Landing.jsx
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── ServerDetail.jsx
    │   │   ├── Pricing.jsx
    │   │   └── Success.jsx
    │   ├── utils/
    │   │   └── api.js             # Axios instance + all API calls
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── tailwind.config.js
    ├── vite.config.js
    ├── .env.example
    └── package.json
```

---

## Quick Start (Local)

### Prerequisites
- Node.js ≥ 18
- MongoDB Atlas cluster (free tier is fine)
- Upstash Redis database (free tier)
- Stripe account

### 1. Clone & install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure environment variables

**Backend** — copy `.env.example` → `.env` and fill in:
```
MONGO_URI=mongodb+srv://...
JWT_SECRET=<32+ char random string>
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
CLIENT_URL=http://localhost:5173
```

**Frontend** — copy `.env.example` → `.env.local`:
```
VITE_STRIPE_PRICE_ID=price_...
```
*(Leave `VITE_API_URL` unset in dev — Vite proxies `/api` to `localhost:5000`)*

### 3. Run

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Visit `http://localhost:5173`

---

## Stripe Setup

1. Create a **Product** in Stripe Dashboard → name it "PulseBoard Pro"
2. Add a **Price**: $9/month recurring
3. Copy the `price_...` ID into both env files
4. For webhooks (local): install [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:
   ```bash
   stripe listen --forward-to localhost:5000/api/payments/webhook
   ```
   Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`
5. For production: add `https://your-backend.northflank.app/api/payments/webhook` in Stripe Dashboard → Webhooks
   - Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

---

## Deployment

### Backend → Northflank

1. Push `backend/` to a Git repo
2. Create a new **Service** in Northflank → Docker build
3. Set all env vars from `.env.example` in Northflank's **Environment** tab
4. Northflank auto-injects `PORT` — the app reads `process.env.PORT`
5. Note the public URL: `https://xxx.northflank.app`

### Frontend → Vercel / Netlify

1. Push `frontend/` to a Git repo
2. Set env vars:
   - `VITE_API_URL=https://xxx.northflank.app/api`
   - `VITE_STRIPE_PRICE_ID=price_...`
3. Build command: `npm run build` · Output directory: `dist`
4. Add your Vercel/Netlify domain to `CLIENT_URL` in the Northflank backend env

### Upstash Redis

1. Go to [console.upstash.com](https://console.upstash.com) → Create database
2. Copy **REST URL** and **REST Token** into backend env vars
3. No extra setup needed — the `@upstash/redis` SDK uses HTTP REST

---

## API Reference

### Auth
| Method | Endpoint               | Auth | Description         |
|--------|------------------------|------|---------------------|
| POST   | `/api/auth/register`   | —    | Create account      |
| POST   | `/api/auth/login`      | —    | Sign in, get JWT    |
| GET    | `/api/auth/me`         | JWT  | Get current user    |

### Servers
| Method | Endpoint                        | Auth | Pro | Description                    |
|--------|---------------------------------|------|-----|--------------------------------|
| GET    | `/api/servers`                  | JWT  | —   | List all servers                |
| POST   | `/api/servers`                  | JWT  | —   | Add server (free: max 3)        |
| GET    | `/api/servers/:id`              | JWT  | —   | Get single server               |
| PUT    | `/api/servers/:id`              | JWT  | —   | Update name/tags/notes          |
| DELETE | `/api/servers/:id`              | JWT  | —   | Delete server                   |
| POST   | `/api/servers/:id/refresh`      | JWT  | —   | Re-ping + re-fetch geo (30s RL) |
| GET    | `/api/servers/:id/pro-stats`    | JWT  | ✓   | Port scan + SSL + HTTP          |
| GET    | `/api/servers/:id/uptime`       | JWT  | ✓   | 7-day snapshot history          |

### Payments
| Method | Endpoint                      | Auth | Description                     |
|--------|-------------------------------|------|---------------------------------|
| POST   | `/api/payments/checkout`      | JWT  | Create Stripe Checkout session  |
| POST   | `/api/payments/portal`        | JWT  | Open Stripe billing portal      |
| POST   | `/api/payments/webhook`       | —    | Stripe webhook (raw body)       |

---

## Plan Limits

| Feature              | Free  | Pro       |
|----------------------|-------|-----------|
| Servers              | 3     | Unlimited |
| Ping / status        | ✓     | ✓         |
| Geolocation          | ✓     | ✓         |
| Port scanner         | —     | ✓ (25 ports) |
| SSL inspector        | —     | ✓         |
| HTTP headers         | —     | ✓         |
| Uptime history       | —     | ✓ (7 days) |
| Refresh rate limit   | 30s   | 30s       |

---

## Redis Usage

| Key pattern          | TTL    | Purpose                              |
|----------------------|--------|--------------------------------------|
| `geo:<ip>`           | 10 min | Cached ip-api.com geolocation result |
| `pro:<serverId>`     | 5 min  | Cached port scan + SSL + HTTP        |
| `rl:refresh:<id>`    | 30 sec | Rate-limit per-server refresh        |
