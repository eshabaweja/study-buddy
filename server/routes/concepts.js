import express from 'express';
import pool from '../db/database.js';
import { requireInstructor } from '../middleware/auth.js';

const router = express.Router();

// Get all concepts
router.get('/', (req, res) => {
  const sql = 'SELECT * FROM concepts';
  pool.query(sql, [], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ concepts: result.rows });
  });
});

// Add a new concept
router.post('/', requireInstructor, (req, res) => {
  const { name, description } = req.body;
  const sql = 'INSERT INTO concepts (name, description) VALUES ($1, $2) RETURNING id';
  const params = [name, description];
  pool.query(sql, params, (err, result) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ id: result.rows[0].id });
  });
});

// Update a concept
router.put('/:id', requireInstructor, (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const sql = 'UPDATE concepts SET name = $1, description = $2 WHERE id = $3 RETURNING *';
  const params = [name, description, id];
  pool.query(sql, params, (err, result) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ id: result.rows[0].id });
  });
});

export default router; 