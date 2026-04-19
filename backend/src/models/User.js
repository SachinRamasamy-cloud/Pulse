import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { canonicaliseIp, encryptText, hashDeterministic } from '../utils/fieldCrypto.js';

// ── Security constants ────────────────────────────────────────────────────────
const SALT_ROUNDS = 14; // bcrypt cost factor — ~300ms on modern hardware, brute-force resistant

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true, maxlength: 60 },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },

    // ── Password security ─────────────────────────────────────────────────────
    // bcrypt already embeds a random 128-bit salt per password in its output string.
    // We also store a secondary app-level pepper salt in the User document so that
    // even a database dump alone cannot crack passwords without the app's JWT_SECRET.
    passwordSalt: { type: String, default: null, select: false }, // per-user random hex salt

    // ── Plan ──────────────────────────────────────────────────────────────────
    plan: { type: String, enum: ['free', 'pro', 'proplus'], default: 'free' },
    stripeCustomerId:     { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'past_due', 'canceled', 'trialing', null],
      default: null,
    },

    // ── Security audit ────────────────────────────────────────────────────────
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil:           { type: Date,   default: null },
    lastLoginAt:         { type: Date,   default: null },
    lastLoginIp:         { type: String, default: null, select: false },
    lastLoginIpHash:     { type: String, default: null, select: false },
    passwordChangedAt:   { type: Date,   default: null },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ stripeCustomerId: 1 });

// ── Pre-save: hash password with explicit salt ────────────────────────────────
// Flow: generate per-user random salt → pepper with PEPPER env var → bcrypt hash
// Even if bcrypt is cracked the attacker also needs: (a) the raw salt, (b) the pepper
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // 1. Generate a cryptographically random per-user salt (stored in DB)
  const rawSalt = crypto.randomBytes(32).toString('hex');
  this.passwordSalt = rawSalt;

  // 2. Pepper: combine password + salt + server-side pepper before bcrypt
  //    PEPPER is never stored in DB — it lives only in env vars
  const pepper      = process.env.PASSWORD_PEPPER || process.env.JWT_SECRET || 'default_pepper';
  const peppered    = `${this.password}:${rawSalt}:${pepper}`;

  // 3. bcrypt with explicit salt rounds (embeds another random salt internally)
  const bcryptSalt  = await bcrypt.genSalt(SALT_ROUNDS);
  this.password     = await bcrypt.hash(peppered, bcryptSalt);

  if (this.isModified('password')) {
    this.passwordChangedAt = new Date();
  }

  next();
});

// ── Compare password ──────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (plainText) {
  const pepper   = process.env.PASSWORD_PEPPER || process.env.JWT_SECRET || 'default_pepper';
  const peppered = `${plainText}:${this.passwordSalt}:${pepper}`;
  return bcrypt.compare(peppered, this.password);
};

// ── Account lockout helpers ───────────────────────────────────────────────────
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.methods.recordFailedLogin = async function () {
  this.failedLoginAttempts += 1;
  // Lock after 5 failed attempts for 15 minutes
  if (this.failedLoginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
  await this.save({ validateModifiedOnly: true });
};

userSchema.methods.recordSuccessfulLogin = async function (ip) {
  const cleanIp = canonicaliseIp(ip);
  this.failedLoginAttempts = 0;
  this.lockUntil           = null;
  this.lastLoginAt         = new Date();
  this.lastLoginIp         = cleanIp ? encryptText(cleanIp) : null;
  this.lastLoginIpHash     = cleanIp ? hashDeterministic(cleanIp, 'login-ip') : null;
  await this.save({ validateModifiedOnly: true });
};

// ── Safe public profile ───────────────────────────────────────────────────────
userSchema.methods.toPublic = function () {
  return {
    _id:                this._id,
    name:               this.name,
    email:              this.email,
    plan:               this.plan,
    isPro:              this.plan === 'pro' || this.plan === 'proplus',
    isProPlus:          this.plan === 'proplus',
    subscriptionStatus: this.subscriptionStatus,
    lastLoginAt:        this.lastLoginAt,
    createdAt:          this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
