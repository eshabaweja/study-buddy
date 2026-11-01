import express from 'express';
import pool from '../db/database.js';
import { requireInstructor } from '../middleware/auth.js';
import {
  assertQuestionOwnedByInstructor,
  sendCourseAccessError,
} from '../db/courseOwnership.js';

const router = express.Router();

router.post('/', requireInstructor, async (req, res) => {
  const { question_id, data_text } = req.body;
  try {
    await assertQuestionOwnedByInstructor(question_id, req.user.email);
    const result = await pool.query(
      'INSERT INTO explicit_data (question_id, data_text) VALUES ($1, $2) RETURNING id',
      [question_id, data_text],
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  }
});

router.get('/:question_id', (req, res) => {
  const questionId = req.params.question_id;
  const sql = 'SELECT * FROM explicit_data WHERE question_id = $1';
  pool.query(sql, [questionId], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ explicit_data: result.rows });
  });
});

router.delete('/:question_id', requireInstructor, async (req, res) => {
  const questionId = req.params.question_id;
  try {
    await assertQuestionOwnedByInstructor(questionId, req.user.email);
    const result = await pool.query(
      'DELETE FROM explicit_data WHERE question_id = $1',
      [questionId],
    );
    res.json({ message: 'Explicit data deleted successfully', deletedCount: result.rowCount });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
