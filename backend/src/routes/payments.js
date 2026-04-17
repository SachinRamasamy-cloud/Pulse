import express from 'express';
import stripe from '../config/stripe.js';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();
const webhookRouter = express.Router();

// Plan → Stripe price ID OR numeric monthly USD amount (set in env)
const PRICE_IDS = {
  pro:     process.env.STRIPE_PRO_PRICE_ID,
  proplus: process.env.STRIPE_PROPLUS_PRICE_ID,
};

const PLAN_NAMES = {
  pro: 'PulseBoard Pro',
  proplus: 'PulseBoard Pro Plus',
};

const CLIENT_BASE_URL = (process.env.CLIENT_URL || '').replace(/\/+$/, '');
const clientRoute = (path) => `${CLIENT_BASE_URL}/#${path.startsWith('/') ? path : `/${path}`}`;

const parseConfiguredPrice = (raw) => (raw || '').toString().split('#')[0].trim();

function buildLineItem(plan, configuredPrice) {
  const value = parseConfiguredPrice(configuredPrice);

  // Recommended mode: Stripe Dashboard price ID.
  if (value.startsWith('price_')) {
    return { price: value, quantity: 1 };
  }

  // Backward-compatible mode: numeric monthly amount (e.g. "9" => $9.00/month).
  if (/^\d+(\.\d{1,2})?$/.test(value)) {
    const unitAmount = Math.round(Number(value) * 100);
    if (unitAmount > 0) {
      return {
        quantity: 1,
        price_data: {
          currency: (process.env.STRIPE_CURRENCY || 'usd').toLowerCase(),
          recurring: { interval: 'month' },
          unit_amount: unitAmount,
          product_data: { name: PLAN_NAMES[plan] || `PulseBoard ${plan}` },
        },
      };
    }
  }

  return null;
}

const getPlanFromMetadata = (obj) => obj?.metadata?.plan || null;
const getUserIdFromMetadata = (obj) => obj?.metadata?.userId || null;

const getCustomerId = (obj) => {
  if (!obj?.customer) return null;
  return typeof obj.customer === 'string' ? obj.customer : obj.customer.id;
};

const findPlanFromSubscription = (sub) => {
  const metadataPlan = getPlanFromMetadata(sub);
  if (metadataPlan) return metadataPlan;

  const subPriceId = sub?.items?.data?.[0]?.price?.id;
  if (!subPriceId) return null;

  const configuredPro = parseConfiguredPrice(process.env.STRIPE_PRO_PRICE_ID);
  const configuredProPlus = parseConfiguredPrice(process.env.STRIPE_PROPLUS_PRICE_ID);

  if (subPriceId === configuredProPlus) return 'proplus';
  if (subPriceId === configuredPro) return 'pro';
  return null;
};

async function resolveUserId({ session = null, subscription = null, invoice = null }) {
  const metadataUserId =
    getUserIdFromMetadata(session) ||
    getUserIdFromMetadata(subscription) ||
    getUserIdFromMetadata(invoice);

  if (metadataUserId) return metadataUserId;

  const customerId =
    getCustomerId(session) ||
    getCustomerId(subscription) ||
    getCustomerId(invoice);

  if (!customerId) return null;

  const user = await User.findOne({ stripeCustomerId: customerId }).select('_id');
  return user?._id?.toString() || null;
}

// ── POST /api/payments/checkout ───────────────────────────────────────────────
router.post('/checkout', protect, async (req, res) => {
  try {
    const { plan = 'pro' } = req.body;
    const priceId = PRICE_IDS[plan];
    if (!priceId) return res.status(400).json({ error: 'Invalid plan.' });

    const lineItem = buildLineItem(plan, priceId);
    if (!lineItem) {
      console.error(`Invalid Stripe price configuration for plan "${plan}":`, priceId);
      return res.status(500).json({ error: 'Billing is temporarily misconfigured. Please contact support.' });
    }

    let customerId = req.user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name:  req.user.name,
        metadata: { userId: req.user._id.toString() },
      });
      customerId = customer.id;
      await User.findByIdAndUpdate(req.user._id, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [lineItem],
      success_url: clientRoute('/success?session_id={CHECKOUT_SESSION_ID}'),
      cancel_url:  clientRoute('/pricing'),
      allow_promotion_codes: true,
      client_reference_id: req.user._id.toString(),
      metadata: { userId: req.user._id.toString(), plan },
      subscription_data: { metadata: { userId: req.user._id.toString(), plan } },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

// ── POST /api/payments/portal ─────────────────────────────────────────────────
router.post('/portal', protect, async (req, res) => {
  try {
    if (!req.user.stripeCustomerId) return res.status(400).json({ error: 'No billing account.' });
    const session = await stripe.billingPortal.sessions.create({
      customer:   req.user.stripeCustomerId,
      return_url: clientRoute('/dashboard'),
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('portal error:', err);
    res.status(500).json({ error: 'Failed to open billing portal.' });
  }
});

// ── POST /api/payments/confirm-session ────────────────────────────────────────
router.post('/confirm-session', protect, async (req, res) => {
  try {
    const sessionId = (req.body?.sessionId || '').toString().trim();
    if (!sessionId.startsWith('cs_')) {
      return res.status(400).json({ error: 'Invalid session ID.' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (!session || session.mode !== 'subscription') {
      return res.status(400).json({ error: 'Invalid checkout session.' });
    }

    const sessionUserId = getUserIdFromMetadata(session) || session.client_reference_id || null;
    if (sessionUserId && sessionUserId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'This checkout session does not belong to your account.' });
    }

    const sessionCustomerId = getCustomerId(session);
    if (req.user.stripeCustomerId && sessionCustomerId && req.user.stripeCustomerId !== sessionCustomerId) {
      return res.status(403).json({ error: 'Stripe customer mismatch.' });
    }

    let sub = session.subscription;
    if (!sub) return res.status(400).json({ error: 'No subscription found in session.' });
    if (typeof sub === 'string') sub = await stripe.subscriptions.retrieve(sub);

    const plan = findPlanFromSubscription(sub) || getPlanFromMetadata(session) || 'pro';
    const subscriptionStatus = sub?.status || (session.payment_status === 'paid' ? 'active' : null);

    await User.findByIdAndUpdate(req.user._id, {
      plan,
      stripeCustomerId: sessionCustomerId || req.user.stripeCustomerId || null,
      stripeSubscriptionId: sub?.id || req.user.stripeSubscriptionId || null,
      subscriptionStatus,
    });

    const updatedUser = await User.findById(req.user._id).select('-password -passwordSalt');
    res.json({ ok: true, user: updatedUser?.toPublic?.() || null });
  } catch (err) {
    console.error('confirm-session error:', err);
    res.status(500).json({ error: 'Failed to confirm session.' });
  }
});

// ── POST /api/payments/webhook ────────────────────────────────────────────────
webhookRouter.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (!session.subscription) break;
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        const userId = (await resolveUserId({ session, subscription: sub })) || session.client_reference_id || null;
        const plan = findPlanFromSubscription(sub) || getPlanFromMetadata(session) || 'pro';
        if (userId) {
          await User.findByIdAndUpdate(userId, {
            plan,
            stripeCustomerId: getCustomerId(session),
            stripeSubscriptionId: sub.id,
            subscriptionStatus: sub.status,
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = await resolveUserId({ subscription: sub });
        const plan = findPlanFromSubscription(sub) || 'pro';
        const isActive = ['active', 'trialing'].includes(sub.status);
        if (userId) await User.findByIdAndUpdate(userId, { plan: isActive ? plan : 'free', subscriptionStatus: sub.status });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = await resolveUserId({ subscription: sub });
        if (userId) await User.findByIdAndUpdate(userId, { plan: 'free', subscriptionStatus: 'canceled' });
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = await resolveUserId({ invoice, subscription: sub });
        if (userId) await User.findByIdAndUpdate(userId, { subscriptionStatus: 'past_due' });
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  res.json({ received: true });
});

export default router;
export { webhookRouter };
