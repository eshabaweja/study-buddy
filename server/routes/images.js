import express from 'express';
import pool from '../db/database.js';
import { requireInstructor } from '../middleware/auth.js';
import {
  assertQuestionOwnedByInstructor,
  sendCourseAccessError,
} from '../db/courseOwnership.js';

const router = express.Router();

// Add a new image
router.post('/', requireInstructor, async (req, res) => {
  const { question_id, image_url, image_type } = req.body;
  
  // Validate required fields
  if (!question_id || !image_url || !image_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate image_type
  if (!['question', 'solution', 'math_solution'].includes(image_type)) {
    return res.status(400).json({ error: 'Invalid image_type. Must be one of: question, solution, math_solution' });
  }

  try {
    await assertQuestionOwnedByInstructor(question_id, req.user.email);
    const sql =
      'INSERT INTO question_images (question_id, image_url, image_type) VALUES ($1, $2, $3) RETURNING id';
    const result = await pool.query(sql, [question_id, image_url, image_type]);
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      console.error('Error uploading image:', err);
      res.status(500).json({ error: err.message });
    }
  }
});

// Delete an image by ID
router.delete('/:id', requireInstructor, async (req, res) => {
  const { id } = req.params;
  
  try {
    const checkSql = `
      SELECT qi.id, qi.question_id
      FROM question_images qi
      WHERE qi.id = $1
    `;
    const checkResult = await pool.query(checkSql, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    await assertQuestionOwnedByInstructor(checkResult.rows[0].question_id, req.user.email);

    await pool.query('DELETE FROM question_images WHERE id = $1', [id]);

    res.status(200).json({ message: 'Image deleted successfully' });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      console.error('Error deleting image:', err);
      res.status(500).json({ error: err.message });
    }
  }
});

export default router; 