import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Protect routes — verifies JWT and attaches req.user
 * Checks that token was issued BEFORE any password change
 */
export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer '))
    token = req.headers.authorization.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Not authenticated. Please log in.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user    = await User.findById(decoded.id).select('-password -passwordSalt');

    if (!user) return res.status(401).json({ error: 'User no longer exists.' });

    // Invalidate tokens issued before a password change
    if (user.passwordChangedAt) {
      const changedAt = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedAt) {
        return res.status(401).json({ error: 'Password was changed. Please log in again.' });
      }
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

export const requirePro = (req, res, next) => {
  const plan = req.user?.plan;
  if (plan !== 'pro' && plan !== 'proplus')
    return res.status(403).json({ error: 'Pro plan required.', code: 'PRO_REQUIRED' });
  next();
};

export const requireProPlus = (req, res, next) => {
  if (req.user?.plan !== 'proplus')
    return res.status(403).json({ error: 'Pro Plus plan required.', code: 'PROPLUS_REQUIRED' });
  next();
};
