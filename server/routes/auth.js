import express from 'express';
import argon2 from 'argon2';
import pool from '../db/database.js';
import { createUser } from '../db/users.js';
import jwt from 'jsonwebtoken';
import { isAdminEmail } from '../middleware/admin.js';

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, full_name, password } = req.body;

    // Validate required fields
    if (!email || !full_name || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

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

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

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

export default router;
