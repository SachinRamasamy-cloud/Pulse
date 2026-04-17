import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db.js';
import paymentRoutes, { webhookRouter } from './routes/payments.js';
import authRoutes    from './routes/auth.js';
import serverRoutes  from './routes/servers.js';
import agentRoutes   from './routes/agent.js';

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security headers (helmet) ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // frontend is separate origin
  crossOriginEmbedderPolicy: false,
}));

// ── Trust proxy (Northflank sits behind a load balancer) ──────────────────────
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin (curl, Postman) in dev only
    if (!origin && process.env.NODE_ENV !== 'production') return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Stripe webhook needs raw body — BEFORE json parser ───────────────────────
app.use('/api/payments/webhook', webhookRouter);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// ── Global rate limit ─────────────────────────────────────────────────────────
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests. Please slow down.' },
}));

// ── Auth rate limit (brute-force protection) ──────────────────────────────────
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
}));
app.use('/api/auth/register', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts.' },
}));

// ── Agent rate limit (POST /api/agent/report — 2 req/min per IP) ─────────────
// Agent reports every 30s — allow 3/min for clock drift
app.use('/api/agent/report', rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.headers.authorization || req.ip,
  message: { error: 'Agent reporting too frequently.' },
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/servers',  serverRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/agent',    agentRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'PulseBoard API', env: process.env.NODE_ENV });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: 'CORS policy violation.' });
  }
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 PulseBoard API on port ${PORT} [${process.env.NODE_ENV}]`);
  });
});
