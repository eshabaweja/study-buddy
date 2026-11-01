import express from 'express';
import argon2 from 'argon2';
import pool from '../db/database.js';
import { createUser } from '../db/users.js';
import jwt from 'jsonwebtoken';
import { isAdminEmail } from '../middleware/admin.js';
import { DEMO_USERS } from '../config/demo.js';
import { isDemoMode } from '../config/env.js';
import { validateBody, signupSchema, loginSchema } from '../middleware/validate.js';

const router = express.Router();

router.post('/signup', validateBody(signupSchema), async (req, res) => {
  try {
    const { email, full_name, password } = req.body;

    // Check if user already exists
    const existingUser = await pool.query('SELECT email FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const passwordHash = await argon2.hash(password);  // Using default settings
    await createUser(email, full_name, passwordHash, false);
    res.status(201).json({ message: 'Signup successful!' });
  } catch (err) {
    console.error('Signup error:', err);
    if (err.code === '23505') { // PostgreSQL unique violation error code
      res.status(400).json({ message: 'User already exists' });
    } else {
      res.status(500).json({ message: 'Signup failed. Please try again.' });
    }
  }
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  try {
    // Get user from database
    const sql = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(sql, [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare password using argon2
    const passwordMatch = await argon2.verify(user.password_hash, password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create JWT token
    const token = jwt.sign(
      { email: user.email, isInstructor: user.is_instructor },
      process.env.JWT_SECRET,
      { expiresIn: '14d' }
    );

    res.json({
      token,
      user: {
        email: user.email,
        full_name: user.full_name,
        isInstructor: user.is_instructor,
        isAdmin: isAdminEmail(user.email),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'An error occurred during login' });
  }
});

// Tells the client whether to show the "try the demo" buttons.
router.get('/config', (req, res) => {
  res.json({ demoMode: isDemoMode() });
});

// One-click demo login. Exists only when DEMO_MODE=true, and only ever signs in
// the two fixed synthetic demo accounts, never a real user.
router.post('/demo', async (req, res) => {
  if (!isDemoMode()) {
    return res.status(404).json({ error: 'Not found' });
  }
  const demo = DEMO_USERS[req.body?.role];
  if (!demo) {
    return res.status(400).json({ error: 'role must be "student" or "instructor"' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [demo.email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(503).json({ error: 'Demo data has not been seeded (npm run db:seed)' });
    }
    // Demo sessions are short: nobody should stay signed in to a shared account for two weeks.
    const token = jwt.sign(
      { email: user.email, isInstructor: user.is_instructor },
      process.env.JWT_SECRET,
      { expiresIn: '4h' },
    );
    res.json({
      token,
      user: {
        email: user.email,
        full_name: user.full_name,
        isInstructor: user.is_instructor,
        isAdmin: false,
      },
    });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ error: 'An error occurred during demo login' });
  }
});

export default router;
