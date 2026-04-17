import express from 'express';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256',
  });

// ── Input sanitiser ───────────────────────────────────────────────────────────
const sanitise = (str) => (typeof str === 'string' ? str.trim().slice(0, 500) : '');

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const name     = sanitise(req.body.name);
    const email    = sanitise(req.body.email).toLowerCase();
    const password = sanitise(req.body.password);

    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields are required.' });

    if (!validator.isEmail(email))
      return res.status(400).json({ error: 'Invalid email address.' });

    if (name.length < 2)
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });

    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    // Reject trivially weak passwords
    if (/^(.)\1+$/.test(password) || ['password','12345678','qwertyui'].includes(password))
      return res.status(400).json({ error: 'Password is too weak. Use a mix of letters, numbers, and symbols.' });

    const existing = await User.findOne({ email });
    // Don't reveal whether email exists — consistent timing response
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const user  = await User.create({ name, email, password });
    const token = signToken(user._id);

    // Log IP for audit
    await user.recordSuccessfulLogin(req.ip);

    res.status(201).json({ token, user: user.toPublic() });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.get('/login', (_req, res) => {
  res.status(405).json({ error: 'Method not allowed. Use POST /api/auth/login.' });
});

router.post('/login', async (req, res) => {
  try {
    const email    = sanitise(req.body.email).toLowerCase();
    const password = sanitise(req.body.password);

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    // Always fetch user with sensitive fields for auth
    const user = await User.findOne({ email }).select('+password +passwordSalt +failedLoginAttempts +lockUntil +lastLoginAt');

    // Check account lock (do this BEFORE password check to prevent timing info leak)
    if (user?.isLocked()) {
      const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(429).json({
        error: `Account temporarily locked. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`,
      });
    }

    // Constant-time: always run comparePassword even if user not found
    const passwordMatch = user ? await user.comparePassword(password) : false;

    if (!user || !passwordMatch) {
      if (user) await user.recordFailedLogin();
      // Generic message — don't reveal whether email exists
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await user.recordSuccessfulLogin(req.ip);

    const token = signToken(user._id);
    res.json({ token, user: user.toPublic() });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

export default router;
