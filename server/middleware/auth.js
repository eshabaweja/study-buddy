import jwt from 'jsonwebtoken';
import pool from '../db/database.js';
import { SESSION_RELOGIN_MESSAGE } from '../constants/authMessages.js';
import { isAdminEmail } from './admin.js';

/** Parse JWT when present; returns { email, isInstructor } or null. */
export async function getOptionalUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT email, is_instructor FROM users WHERE email = $1',
      [decoded.email],
    );
    if (result.rows.length === 0) {
      return null;
    }
    return {
      email: result.rows[0].email,
      isInstructor: result.rows[0].is_instructor,
    };
  } catch {
    return null;
  }
}

// Middleware to verify JWT token and check if user is an instructor
export const requireInstructor = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user is an instructor in the database
    const result = await pool.query('SELECT is_instructor FROM users WHERE email = $1', [decoded.email]);
    
    if (result.rows.length === 0 || !result.rows[0].is_instructor) {
      return res.status(403).json({ error: 'Instructor access required' });
    }

    // Add user info to request object
    req.user = {
      email: decoded.email,
      isInstructor: true
    };
    
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: SESSION_RELOGIN_MESSAGE });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: SESSION_RELOGIN_MESSAGE });
    }
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Middleware to verify JWT token and check if user is a student
export const requireStudent = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user is a student (not an instructor) in the database
    const result = await pool.query('SELECT is_instructor FROM users WHERE email = $1', [decoded.email]);
    
    if (result.rows.length === 0 || result.rows[0].is_instructor) {
      return res.status(403).json({ error: 'Student access required' });
    }

    // Add user info to request object
    req.user = {
      email: decoded.email,
      isInstructor: false
    };
    
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: SESSION_RELOGIN_MESSAGE });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: SESSION_RELOGIN_MESSAGE });
    }
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/** Instructor or hardcoded admin (for analytics and shared staff routes). */
export const requireInstructorOrAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (isAdminEmail(decoded.email)) {
      req.user = { email: decoded.email, isInstructor: false, isAdmin: true };
      return next();
    }

    const result = await pool.query(
      'SELECT is_instructor FROM users WHERE email = $1',
      [decoded.email],
    );

    if (result.rows.length === 0 || !result.rows[0].is_instructor) {
      return res.status(403).json({ error: 'Instructor or admin access required' });
    }

    req.user = { email: decoded.email, isInstructor: true, isAdmin: false };
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: SESSION_RELOGIN_MESSAGE });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: SESSION_RELOGIN_MESSAGE });
    }
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
};
/** Any signed-in user (student or instructor). Sets req.user = { email, isInstructor }. */
export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT email, is_instructor FROM users WHERE email = $1',
      [decoded.email],
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: SESSION_RELOGIN_MESSAGE });
    }
    req.user = {
      email: result.rows[0].email,
      isInstructor: result.rows[0].is_instructor,
    };
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: SESSION_RELOGIN_MESSAGE });
    }
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
};
