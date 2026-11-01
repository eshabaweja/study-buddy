import jwt from 'jsonwebtoken';
import { SESSION_RELOGIN_MESSAGE } from '../constants/authMessages.js';

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';

export function isAdminEmail(email) {
  return (
    typeof email === 'string' &&
    email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

export const requireAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!isAdminEmail(decoded.email)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = {
      email: decoded.email,
      isAdmin: true,
    };

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: SESSION_RELOGIN_MESSAGE });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: SESSION_RELOGIN_MESSAGE });
    }
    console.error('Admin middleware error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
};
