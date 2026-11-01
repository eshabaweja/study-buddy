import express from 'express';
import pool from '../db/database.js';
import { requireInstructor } from '../middleware/auth.js';
import {
  assertQuestionOwnedByInstructor,
  sendCourseAccessError,
} from '../db/courseOwnership.js';

const router = express.Router();

router.get('/', (req, res) => {
  const sql = 'SELECT * FROM questions_concepts';
  pool.query(sql, [], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ questions_concepts: result.rows });
  });
});

router.post('/', requireInstructor, async (req, res) => {
  const { question_id, concept_id } = req.body;
  try {
    await assertQuestionOwnedByInstructor(question_id, req.user.email);
    const result = await pool.query(
      'INSERT INTO questions_concepts (question_id, concept_id) VALUES ($1, $2) RETURNING id',
      [question_id, concept_id],
    );
    res.json({ qc_id: result.rows[0].id });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  }
});

router.put('/:questionId', requireInstructor, async (req, res) => {
  const { questionId } = req.params;
  const rawIds = req.body?.concept_ids;
  if (!Array.isArray(rawIds)) {
    return res.status(400).json({ error: 'concept_ids array is required' });
  }

  const conceptIds = [...new Set(
    rawIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0),
  )];

  const client = await pool.connect();
  try {
    await assertQuestionOwnedByInstructor(questionId, req.user.email);
    await client.query('BEGIN');
    const deleteResult = await client.query(
      'DELETE FROM questions_concepts WHERE question_id = $1',
      [questionId],
    );
    for (const conceptId of conceptIds) {
      await client.query(
        'INSERT INTO questions_concepts (question_id, concept_id) VALUES ($1, $2)',
        [questionId, conceptId],
      );
    }
    await client.query('COMMIT');
    res.json({
      question_id: Number(questionId),
      concept_ids: conceptIds,
      deleted: deleteResult.rowCount,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (!sendCourseAccessError(res, err)) {
      res.status(400).json({ error: err.message });
    }
  } finally {
    client.release();
  }
});

router.delete('/:questionId', requireInstructor, async (req, res) => {
  const { questionId } = req.params;
  try {
    await assertQuestionOwnedByInstructor(questionId, req.user.email);
    const result = await pool.query(
      'DELETE FROM questions_concepts WHERE question_id = $1 RETURNING id',
      [questionId],
    );
    res.json({
      message: 'Concept associations deleted',
      deleted: result.rows.length,
    });
  } catch (err) {
    if (!sendCourseAccessError(res, err)) {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
